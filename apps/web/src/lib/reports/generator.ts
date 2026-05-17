import "server-only";

import { spawn } from "node:child_process";

import { buildHeuristicReport } from "@/lib/reports/heuristics";
import { buildPullBriefReportPrompt, REPORT_PROMPT_VERSION } from "@/lib/reports/prompts";
import { pullBriefReportJsonSchema } from "@/lib/reports/report-schema";
import type { PullBriefReport, PullRequestContext, RiskLevel, ReviewMode } from "@/lib/reports/types";

const DEFAULT_MAX_PATCH_CHARS = 80_000;
const DEFAULT_MAX_PATCH_CHARS_PER_FILE = 8_000;
const DEFAULT_PI_COMMAND = "pi";
const DEFAULT_PI_TIMEOUT_MS = 180_000;
const ENV_EXECUTABLE = "/usr/bin/env";
const MAX_CLI_OUTPUT_CHARS = 2_000_000;

export async function generatePullBriefReport(context: PullRequestContext): Promise<PullBriefReport> {
  if (process.env.PULLBRIEF_AI_BACKEND === "heuristic") {
    return buildHeuristicReport(context, ["PULLBRIEF_AI_BACKEND=heuristic; skipped pi CLI generation."]);
  }

  try {
    const report = await generateWithPiCli(context);
    return {
      ...report,
      schemaVersion: "pullbrief.report.v1",
      generatedAt: new Date().toISOString(),
      generator: {
        provider: "pi",
        model: piModelLabel(),
        mode: "print-cli",
        warnings: addPromptVersionWarning(report.generator.warnings),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "pi CLI report generation failed.";
    const allowFallback = process.env.PULLBRIEF_ALLOW_HEURISTIC_FALLBACK !== "false";

    if (!allowFallback) {
      throw error;
    }

    return buildHeuristicReport(context, [`pi CLI generation failed; used deterministic heuristic report. ${message}`]);
  }
}

async function generateWithPiCli(context: PullRequestContext): Promise<PullBriefReport> {
  const output = await runPiPrint({
    prompt: buildPullBriefReportPrompt(pullBriefReportJsonSchema),
    stdin: JSON.stringify(compactContextForModel(context), null, 2),
  });
  const parsed = parseJsonFromCliOutput(output.stdout);

  return normalizeReport(assertPullBriefReport(parsed));
}

export async function runPiPrint(input: { prompt: string; stdin: string }): Promise<{ stdout: string; stderr: string }> {
  const command = process.env.PULLBRIEF_PI_COMMAND?.trim() || DEFAULT_PI_COMMAND;
  const args = [command, ...buildPiArgs(input.prompt)];
  const timeoutMs = numberFromEnv("PULLBRIEF_PI_TIMEOUT_MS", DEFAULT_PI_TIMEOUT_MS);

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn(ENV_EXECUTABLE, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    timer.unref();

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdin.on("error", () => {
      // If pi exits before reading stdin, the close handler reports the actual failure.
    });

    child.stdout.on("data", (chunk: string) => {
      stdout = appendBounded(stdout, chunk);
    });

    child.stderr.on("data", (chunk: string) => {
      stderr = appendBounded(stderr, chunk);
    });

    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Unable to start pi CLI through ${ENV_EXECUTABLE} ${command}. ${error.message}`));
      }
    });

    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);

      if (timedOut) {
        reject(new Error(`pi CLI timed out after ${timeoutMs}ms.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`pi CLI exited with ${code ?? signal ?? "unknown"}. ${stderr.trim()}`.trim()));
        return;
      }

      resolve({ stdout, stderr });
    });

    child.stdin.end(input.stdin);
  });
}

function buildPiArgs(prompt: string) {
  const args = [
    "--no-session",
    "--no-tools",
    "--no-context-files",
    "--no-skills",
    "--no-prompt-templates",
    "--no-extensions",
  ];
  const model = process.env.PULLBRIEF_PI_MODEL?.trim();
  const thinking = process.env.PULLBRIEF_PI_THINKING?.trim();

  if (model) {
    args.push("--model", model);
  }

  if (thinking) {
    args.push("--thinking", thinking);
  }

  args.push("-p", prompt);
  return args;
}

function compactContextForModel(context: PullRequestContext) {
  const maxPatchChars = numberFromEnv("PULLBRIEF_MAX_PATCH_CHARS", DEFAULT_MAX_PATCH_CHARS);
  const maxPatchCharsPerFile = numberFromEnv("PULLBRIEF_MAX_PATCH_CHARS_PER_FILE", DEFAULT_MAX_PATCH_CHARS_PER_FILE);
  let remainingPatchChars = maxPatchChars;

  return {
    schemaVersion: context.schemaVersion,
    fetchedAt: context.fetchedAt,
    repository: {
      owner: context.owner,
      repo: context.repo,
      baseRepoFullName: context.baseRepoFullName,
      headRepoFullName: context.headRepoFullName,
    },
    pullRequest: {
      number: context.number,
      title: context.title,
      body: context.body,
      state: context.state,
      draft: context.draft,
      authorLogin: context.authorLogin,
      htmlUrl: context.htmlUrl,
      baseRef: context.baseRef,
      baseSha: context.baseSha,
      headRef: context.headRef,
      headSha: context.headSha,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      mergedAt: context.mergedAt,
      labels: context.labels,
      requestedReviewers: context.requestedReviewers,
      stats: context.stats,
    },
    commits: context.commits.slice(0, 80),
    checks: context.checks,
    files: context.files.map((file) => {
      const patch = truncatePatch(file.patch, Math.min(maxPatchCharsPerFile, remainingPatchChars));
      remainingPatchChars -= patch.includedChars;

      return {
        path: file.path,
        previousPath: file.previousPath,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        blobUrl: file.blobUrl,
        patch: patch.text,
        patchTruncated: patch.truncated,
      };
    }),
  };
}

function truncatePatch(patch: string | null, limit: number) {
  if (!patch || limit <= 0) {
    return { text: null, truncated: Boolean(patch), includedChars: 0 };
  }

  if (patch.length <= limit) {
    return { text: patch, truncated: false, includedChars: patch.length };
  }

  const suffix = "\n[patch truncated by PullBrief phase 1 context budget]";
  const text = `${patch.slice(0, Math.max(0, limit - suffix.length))}${suffix}`;
  return { text, truncated: true, includedChars: limit };
}

function parseJsonFromCliOutput(output: string): unknown {
  const normalized = stripAnsi(output).trim();
  const candidates = dedupe([
    normalized,
    stripMarkdownFence(normalized),
    extractJsonObject(normalized),
  ].filter((candidate): candidate is string => Boolean(candidate)));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("pi CLI did not return parseable report JSON.");
}

function stripMarkdownFence(value: string) {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() || value;
}

function extractJsonObject(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return null;
  }

  return value.slice(start, end + 1).trim();
}

function normalizeReport(report: PullBriefReport): PullBriefReport {
  return {
    ...report,
    riskAreas: report.riskAreas.slice(0, 8),
    changeGroups: report.changeGroups.slice(0, 12),
    rankedFiles: report.rankedFiles
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((file, index) => ({ ...file, rank: index + 1 })),
    verification: {
      suggestedCommands: report.verification.suggestedCommands.slice(0, 8),
      manualChecks: report.verification.manualChecks.slice(0, 10),
      missingTests: report.verification.missingTests.slice(0, 8),
    },
    openQuestions: report.openQuestions.slice(0, 8),
  };
}

function assertPullBriefReport(value: unknown): PullBriefReport {
  if (!isRecord(value)) {
    throw new Error("pi CLI report was not a JSON object.");
  }

  const report = value as Partial<PullBriefReport>;

  if (report.schemaVersion !== "pullbrief.report.v1") {
    throw new Error("pi CLI report used an unsupported schema version.");
  }

  if (!isRecord(report.generator) || !Array.isArray(report.generator.warnings)) {
    throw new Error("pi CLI report missed generator metadata.");
  }

  if (!isRecord(report.prSummary) || !isRecord(report.decision) || !isRecord(report.verification)) {
    throw new Error("pi CLI report missed required sections.");
  }

  if (!Array.isArray(report.riskAreas) || !Array.isArray(report.changeGroups) || !Array.isArray(report.rankedFiles) || !Array.isArray(report.openQuestions)) {
    throw new Error("pi CLI report missed required arrays.");
  }

  for (const file of report.rankedFiles) {
    if (!isRecord(file) || typeof file.path !== "string" || typeof file.rank !== "number") {
      throw new Error("pi CLI report contained an invalid ranked file.");
    }

    if (!isRiskLevel(file.riskLevel) || !isReviewMode(file.reviewMode)) {
      throw new Error("pi CLI report contained an invalid ranked file risk or review mode.");
    }
  }

  return report as PullBriefReport;
}

function addPromptVersionWarning(warnings: string[]) {
  const marker = `prompt:${REPORT_PROMPT_VERSION}`;
  return warnings.includes(marker) ? warnings : [...warnings, marker];
}

function piModelLabel() {
  return process.env.PULLBRIEF_PI_MODEL?.trim() || "pi-default";
}

function numberFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function appendBounded(current: string, chunk: string) {
  const next = current + chunk;
  return next.length > MAX_CLI_OUTPUT_CHARS ? next.slice(0, MAX_CLI_OUTPUT_CHARS) : next;
}

function stripAnsi(value: string) {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "low" || value === "medium" || value === "high";
}

function isReviewMode(value: unknown): value is ReviewMode {
  return value === "read" || value === "check" || value === "skim";
}
