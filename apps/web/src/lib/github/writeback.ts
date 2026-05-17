import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { githubReportWritebacks, pullRequests } from "@/db/schema";
import { resolvePullRequestRepositoryAuth } from "@/lib/github/repository-access";
import { buildPullBriefRoute } from "@/lib/github/pr-url";
import type { PullBriefReport, ReportRecord, ReportRecommendation } from "@/lib/reports/types";

const API_VERSION = "2022-11-28";
const STICKY_MARKER = "<!-- pullbrief:sticky-review -->";

export type GitHubWritebackKind = "check_run" | "sticky_comment" | "pull_request_review";
export type PullRequestReviewEvent = "COMMENT" | "REQUEST_CHANGES" | "APPROVE";

export type PullRequestReviewCommentInput = {
  path: string;
  body: string;
  line: number;
  side: "LEFT" | "RIGHT";
  startLine?: number | null;
  startSide?: "LEFT" | "RIGHT" | null;
};

export type GitHubWritebackResult = {
  kind: GitHubWritebackKind;
  status: "published" | "failed";
  htmlUrl: string | null;
  githubDatabaseId: string | null;
  errorMessage: string | null;
};

export type GitHubWritebackView = {
  kind: GitHubWritebackKind;
  status: "pending" | "published" | "failed";
  htmlUrl: string | null;
  githubDatabaseId: string | null;
  errorMessage: string | null;
  updatedAt: string;
};

export async function listReportWritebacksForTenant(input: {
  reportId: string;
  tenantId: string;
}): Promise<GitHubWritebackView[]> {
  const rows = await db
    .select()
    .from(githubReportWritebacks)
    .where(and(eq(githubReportWritebacks.reportId, input.reportId), eq(githubReportWritebacks.tenantId, input.tenantId)))
    .orderBy(desc(githubReportWritebacks.updatedAt));

  return rows.map((row) => ({
    kind: row.kind,
    status: row.status,
    htmlUrl: row.githubHtmlUrl,
    githubDatabaseId: row.githubDatabaseId,
    errorMessage: row.errorMessage,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function publishReportCheckRun(record: ReportRecord): Promise<GitHubWritebackResult> {
  return publishWriteback(record, "check_run", async ({ token, existing }) => {
    if (!record.report) {
      throw new Error("Cannot publish a failed report as a check run.");
    }

    const payload = {
      name: "PullBrief AI review",
      head_sha: record.headSha,
      status: "completed",
      conclusion: checkConclusion(record.report.decision.recommendation),
      details_url: absoluteAppUrl(buildPullBriefRoute(record)),
      output: {
        title: checkTitle(record.report),
        summary: record.report.decision.summary,
        text: markdownReportSummary(record),
      },
    };

    const path = existing?.githubDatabaseId
      ? `/repos/${encodeURIComponent(record.owner)}/${encodeURIComponent(record.repo)}/check-runs/${encodeURIComponent(existing.githubDatabaseId)}`
      : `/repos/${encodeURIComponent(record.owner)}/${encodeURIComponent(record.repo)}/check-runs`;
    const response = await githubJson(path, {
      method: existing?.githubDatabaseId ? "PATCH" : "POST",
      token,
      body: payload,
    });

    return responseToArtifact(response);
  });
}

export async function publishStickyComment(record: ReportRecord): Promise<GitHubWritebackResult> {
  return publishWriteback(record, "sticky_comment", async ({ token, existing }) => {
    if (!record.report) {
      throw new Error("Cannot publish a failed report as a sticky comment.");
    }

    const body = `${STICKY_MARKER}\n${markdownReportSummary(record)}`;
    const response = await githubJson(
      existing?.githubDatabaseId
        ? `/repos/${encodeURIComponent(record.owner)}/${encodeURIComponent(record.repo)}/issues/comments/${encodeURIComponent(existing.githubDatabaseId)}`
        : `/repos/${encodeURIComponent(record.owner)}/${encodeURIComponent(record.repo)}/issues/${record.number}/comments`,
      {
        method: existing?.githubDatabaseId ? "PATCH" : "POST",
        token,
        body: { body },
      },
    );

    return responseToArtifact(response);
  });
}

export async function publishPullRequestReview(
  record: ReportRecord,
  input: {
    event?: PullRequestReviewEvent;
    body?: string;
    comments?: PullRequestReviewCommentInput[];
  } = {},
): Promise<GitHubWritebackResult> {
  return publishWriteback(record, "pull_request_review", async ({ token }) => {
    if (!record.report) {
      throw new Error("Cannot publish a failed report as a pull request review.");
    }

    const response = await githubJson(
      `/repos/${encodeURIComponent(record.owner)}/${encodeURIComponent(record.repo)}/pulls/${record.number}/reviews`,
      {
        method: "POST",
        token,
        body: {
          event: input.event ?? reviewEvent(record.report.decision.recommendation),
          body: input.body ?? markdownReportSummary(record),
          commit_id: record.headSha,
          ...(input.comments && input.comments.length > 0
            ? { comments: input.comments.map(toGitHubReviewComment) }
            : {}),
        },
      },
    );

    return responseToArtifact(response);
  });
}

async function publishWriteback(
  record: ReportRecord,
  kind: GitHubWritebackKind,
  publish: (input: {
    token: string;
    existing: typeof githubReportWritebacks.$inferSelect | null;
  }) => Promise<{ githubDatabaseId: string | null; githubNodeId: string | null; githubHtmlUrl: string | null }>,
): Promise<GitHubWritebackResult> {
  const repositoryAuth = await resolvePullRequestRepositoryAuth(record.tenantId, record);

  if (repositoryAuth.mode !== "installation") {
    throw new Error("GitHub App installation is required for writeback.");
  }

  const [existing] = await db
    .select()
    .from(githubReportWritebacks)
    .where(and(eq(githubReportWritebacks.reportId, record.id), eq(githubReportWritebacks.kind, kind)))
    .limit(1);

  try {
    const artifact = await publish({ token: repositoryAuth.token, existing: existing || null });
    const bodyHash = record.report ? hashText(markdownReportSummary(record)) : null;
    await upsertWriteback({
      record,
      kind,
      repositoryId: repositoryAuth.repository.id,
      githubDatabaseId: artifact.githubDatabaseId,
      githubNodeId: artifact.githubNodeId,
      githubHtmlUrl: artifact.githubHtmlUrl,
      status: "published",
      bodyHash,
      errorMessage: null,
    });

    return {
      kind,
      status: "published",
      htmlUrl: artifact.githubHtmlUrl,
      githubDatabaseId: artifact.githubDatabaseId,
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub writeback failed.";
    await upsertWriteback({
      record,
      kind,
      repositoryId: repositoryAuth.repository.id,
      githubDatabaseId: existing?.githubDatabaseId || null,
      githubNodeId: existing?.githubNodeId || null,
      githubHtmlUrl: existing?.githubHtmlUrl || null,
      status: "failed",
      bodyHash: existing?.bodyHash || null,
      errorMessage: message,
    });

    return {
      kind,
      status: "failed",
      htmlUrl: existing?.githubHtmlUrl || null,
      githubDatabaseId: existing?.githubDatabaseId || null,
      errorMessage: message,
    };
  }
}

async function upsertWriteback(input: {
  record: ReportRecord;
  kind: GitHubWritebackKind;
  repositoryId: string;
  githubDatabaseId: string | null;
  githubNodeId: string | null;
  githubHtmlUrl: string | null;
  status: "published" | "failed";
  bodyHash: string | null;
  errorMessage: string | null;
}) {
  const pullRequestId = await findPullRequestId(input.repositoryId, input.record.number);
  await db
    .insert(githubReportWritebacks)
    .values({
      id: randomUUID(),
      tenantId: input.record.tenantId,
      reportId: input.record.id,
      repositoryId: input.repositoryId,
      pullRequestId,
      kind: input.kind,
      githubDatabaseId: input.githubDatabaseId,
      githubNodeId: input.githubNodeId,
      githubHtmlUrl: input.githubHtmlUrl,
      status: input.status,
      bodyHash: input.bodyHash,
      errorMessage: input.errorMessage,
    })
    .onConflictDoUpdate({
      target: [githubReportWritebacks.reportId, githubReportWritebacks.kind],
      set: {
        repositoryId: input.repositoryId,
        pullRequestId,
        githubDatabaseId: input.githubDatabaseId,
        githubNodeId: input.githubNodeId,
        githubHtmlUrl: input.githubHtmlUrl,
        status: input.status,
        bodyHash: input.bodyHash,
        errorMessage: input.errorMessage,
        updatedAt: new Date(),
      },
    });
}

async function findPullRequestId(repositoryId: string, number: number) {
  const [row] = await db
    .select({ id: pullRequests.id })
    .from(pullRequests)
    .where(and(eq(pullRequests.repositoryId, repositoryId), eq(pullRequests.number, number)))
    .limit(1);

  return row?.id || null;
}

async function githubJson(path: string, input: {
  method: "POST" | "PATCH";
  token: string;
  body: Record<string, unknown>;
}) {
  const url = new URL(path, process.env.PULLBRIEF_GITHUB_API_BASE_URL?.trim() || "https://api.github.com");
  const response = await fetch(url, {
    method: input.method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      "User-Agent": "pullbrief-github-app",
      "X-GitHub-Api-Version": process.env.PULLBRIEF_GITHUB_API_VERSION?.trim() || API_VERSION,
    },
    body: JSON.stringify(input.body),
    cache: "no-store",
  });

  const data = await response.json() as unknown;

  if (!response.ok) {
    throw new Error(gitHubErrorMessage(data, response.status));
  }

  return data;
}

function responseToArtifact(value: unknown) {
  if (!isRecord(value)) {
    return { githubDatabaseId: null, githubNodeId: null, githubHtmlUrl: null };
  }

  return {
    githubDatabaseId: value.id === null || value.id === undefined ? null : String(value.id),
    githubNodeId: typeof value.node_id === "string" ? value.node_id : null,
    githubHtmlUrl: typeof value.html_url === "string" ? value.html_url : null,
  };
}

function gitHubErrorMessage(value: unknown, status: number) {
  if (isRecord(value) && typeof value.message === "string") {
    return `GitHub writeback failed (${status}): ${value.message}`;
  }

  return `GitHub writeback failed with HTTP ${status}.`;
}

function markdownReportSummary(record: ReportRecord) {
  const report = record.report;

  if (!report) {
    return `## PullBrief report failed\n\n${record.errorMessage || "No error was saved."}`;
  }

  const blocking = report.decision.blockingIssues.length > 0
    ? report.decision.blockingIssues.map((issue) => `- ${suppressMentions(issue)}`).join("\n")
    : "- None detected by PullBrief.";
  const topFiles = report.rankedFiles.slice(0, 5).map((file) => `- ${file.riskLevel}: ${file.path} — ${suppressMentions(file.reason)}`).join("\n");

  return [
    `## PullBrief AI review`,
    ``,
    `**Recommendation:** ${report.decision.recommendation.replace("_", " ")}`,
    ``,
    suppressMentions(report.decision.summary),
    ``,
    `### Blocking issues`,
    blocking,
    ``,
    `### Highest-risk files`,
    topFiles || "- None ranked.",
    ``,
    `[Open full PullBrief report](${absoluteAppUrl(buildPullBriefRoute(record))})`,
  ].join("\n");
}

function suppressMentions(value: string) {
  return value.replace(/@/g, "@\u200B");
}

function checkTitle(report: PullBriefReport) {
  return `PullBrief recommends ${report.decision.recommendation.replace("_", " ")}`;
}

function checkConclusion(recommendation: ReportRecommendation) {
  if (recommendation === "request_changes") {
    return "failure";
  }

  if (recommendation === "review_carefully") {
    return "neutral";
  }

  return "success";
}

function toGitHubReviewComment(comment: PullRequestReviewCommentInput) {
  return {
    path: comment.path,
    body: comment.body,
    line: comment.line,
    side: comment.side,
    ...(comment.startLine && comment.startLine !== comment.line
      ? { start_line: comment.startLine, start_side: comment.startSide ?? comment.side }
      : {}),
  };
}

function reviewEvent(recommendation: ReportRecommendation): PullRequestReviewEvent {
  if (recommendation === "approve") {
    return "APPROVE";
  }

  if (recommendation === "request_changes") {
    return "REQUEST_CHANGES";
  }

  return "COMMENT";
}

function absoluteAppUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";
  return new URL(path, baseUrl).toString();
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
