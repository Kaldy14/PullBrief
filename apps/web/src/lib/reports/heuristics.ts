import type {
  PullBriefReport,
  PullRequestContext,
  PullRequestContextFile,
  ReportChangeGroup,
  ReportRankedFile,
  ReportRiskArea,
  RiskLevel,
  ReviewMode,
} from "@/lib/reports/types";

type FileScore = {
  file: PullRequestContextFile;
  score: number;
  reasons: string[];
  category: FileCategory;
};

type FileCategory =
  | "auth"
  | "database"
  | "jobs"
  | "payments"
  | "integrations"
  | "api"
  | "config"
  | "infra"
  | "tests"
  | "docs"
  | "frontend"
  | "generated"
  | "application";

type CategoryDefinition = {
  title: string;
  summary: string;
  reviewNote: string;
  riskBoost: number;
};

const CATEGORY_DEFINITIONS: Record<FileCategory, CategoryDefinition> = {
  auth: {
    title: "Authentication and authorization",
    summary: "Changes files that can affect identity, permissions, sessions, roles, or audit boundaries.",
    reviewNote: "Verify that the intended caller, tenant, and privilege boundaries are explicit in the changed code.",
    riskBoost: 55,
  },
  database: {
    title: "Data model and persistence",
    summary: "Changes schema, migrations, queries, transactions, or persistent report data.",
    reviewNote: "Check migration safety, rollback behavior, transactional boundaries, and compatibility with existing rows.",
    riskBoost: 50,
  },
  jobs: {
    title: "Background jobs and queues",
    summary: "Changes worker, queue, scheduling, retry, or asynchronous execution behavior.",
    reviewNote: "Confirm idempotency, retry behavior, locking, and observability around failure paths.",
    riskBoost: 42,
  },
  payments: {
    title: "Billing and payment paths",
    summary: "Changes billing, checkout, subscription, or payment provider code.",
    reviewNote: "Review money movement, duplicate handling, webhooks, and reconciliation paths manually.",
    riskBoost: 58,
  },
  integrations: {
    title: "External integrations and webhooks",
    summary: "Changes provider calls, webhook receivers, OAuth, or integration boundary code.",
    reviewNote: "Check signatures, retries, rate limits, and provider error handling.",
    riskBoost: 44,
  },
  api: {
    title: "API and contract surface",
    summary: "Changes route handlers, controllers, GraphQL, REST contracts, request validation, or public API types.",
    reviewNote: "Check backwards compatibility, auth gates, validation, status codes, and documented response shapes.",
    riskBoost: 36,
  },
  config: {
    title: "Runtime configuration",
    summary: "Changes environment, package, build, dependency, or security-sensitive configuration files.",
    reviewNote: "Confirm defaults are safe and no secret material or production-only assumptions are introduced.",
    riskBoost: 28,
  },
  infra: {
    title: "Infrastructure and deployment",
    summary: "Changes CI, deployment, container, cloud, or infrastructure definitions.",
    reviewNote: "Review permissions, deployment order, secret handling, and rollback behavior.",
    riskBoost: 35,
  },
  tests: {
    title: "Tests",
    summary: "Adds or changes automated tests and fixtures that prove expected behavior.",
    reviewNote: "Confirm the tests cover the highest-risk files rather than only snapshots or happy paths.",
    riskBoost: -12,
  },
  docs: {
    title: "Docs and runbooks",
    summary: "Changes documentation, runbooks, product notes, or release text.",
    reviewNote: "Skim for operator-facing contract changes and make sure docs match the code path.",
    riskBoost: -18,
  },
  frontend: {
    title: "Frontend and review UI",
    summary: "Changes UI components, screens, styles, or browser-side behavior.",
    reviewNote: "Check accessibility, loading/error states, responsive behavior, and server/client data boundaries.",
    riskBoost: 16,
  },
  generated: {
    title: "Generated or lockfile output",
    summary: "Generated output, lockfiles, snapshots, or build artifacts changed alongside source changes.",
    reviewNote: "Do not lead with these unless the generated contract is the behavior being reviewed.",
    riskBoost: -25,
  },
  application: {
    title: "Application logic",
    summary: "General application code changed outside a higher-risk subsystem.",
    reviewNote: "Review the changed behavior and follow imports into callers when the file has broad fan-out.",
    riskBoost: 10,
  },
};

const HIGH_RISK_REASON_LIMIT = 4;

export function buildHeuristicReport(context: PullRequestContext, warnings: string[] = []): PullBriefReport {
  const scoredFiles = rankFiles(context.files);
  const rankedFiles = scoredFiles.map<ReportRankedFile>((scored, index) => ({
    path: scored.file.path,
    rank: index + 1,
    reason: scored.reasons.join(" "),
    summary: summarizeFile(scored),
    riskLevel: riskLevelFromScore(scored.score),
    reviewMode: reviewModeFromRankAndRisk(index + 1, riskLevelFromScore(scored.score)),
  }));

  const changeGroups = buildChangeGroups(scoredFiles);
  const riskAreas = buildRiskAreas(scoredFiles);
  const topFiles = rankedFiles.slice(0, 3).map((file) => file.path);
  const primaryGroups = changeGroups.slice(0, 3).map((group) => group.title.toLowerCase());
  const testsChanged = scoredFiles.some((file) => file.category === "tests");
  const highRiskCount = rankedFiles.filter((file) => file.riskLevel === "high").length;

  return {
    schemaVersion: "pullbrief.report.v1",
    generatedAt: new Date().toISOString(),
    generator: {
      provider: "heuristic",
      model: "deterministic-risk-ranker-v1",
      mode: "deterministic",
      warnings,
    },
    prSummary: {
      intent: buildIntent(context, primaryGroups),
      businessImpact: "Not inferred from an issue tracker in phase 1. Use the PR title, body, labels, and changed surface area to decide product impact.",
      technicalImpact: `Touches ${context.stats.filesChanged} files with ${context.stats.additions} additions and ${context.stats.deletions} deletions. Main review areas: ${primaryGroups.join(", ") || "application logic"}.`,
      reviewerFocus: topFiles.length > 0
        ? topFiles.map((path) => `Start with ${path}.`)
        : ["No changed files were returned by GitHub."],
    },
    decision: {
      recommendation: recommendationFor(highRiskCount, testsChanged),
      summary: buildDecisionSummary(highRiskCount, testsChanged, rankedFiles),
      blockingIssues: highRiskCount > 0 && !testsChanged
        ? ["High-risk files changed without test files in the diff. Confirm coverage before approving."]
        : [],
    },
    riskAreas,
    changeGroups,
    rankedFiles,
    verification: {
      suggestedCommands: inferSuggestedCommands(scoredFiles),
      manualChecks: inferManualChecks(scoredFiles, context),
      missingTests: testsChanged
        ? []
        : ["No test files were changed. Verify whether existing coverage exercises the highest-risk paths."],
    },
    openQuestions: inferOpenQuestions(scoredFiles, context, testsChanged),
  };
}

export function rankFiles(files: PullRequestContextFile[]): FileScore[] {
  return files
    .map(scoreFile)
    .sort((a, b) => b.score - a.score || b.file.changes - a.file.changes || a.file.path.localeCompare(b.file.path));
}

function scoreFile(file: PullRequestContextFile): FileScore {
  const path = file.path.toLowerCase();
  const category = categorizePath(path);
  const reasons: string[] = [];
  let score = CATEGORY_DEFINITIONS[category].riskBoost;

  if (category !== "docs" && category !== "generated" && category !== "tests") {
    reasons.push(CATEGORY_DEFINITIONS[category].reviewNote);
  } else {
    reasons.push(CATEGORY_DEFINITIONS[category].summary);
  }

  if (file.status === "removed") {
    score += 14;
    reasons.push("Deletion can remove behavior or a contract entirely.");
  }

  if (file.status === "renamed") {
    score += 8;
    reasons.push("Rename requires checking callers and imports, not only the new filename.");
  }

  if (file.changes > 600) {
    score += 32;
    reasons.push("Very large delta raises review risk.");
  } else if (file.changes > 250) {
    score += 22;
    reasons.push("Large delta deserves early review.");
  } else if (file.changes > 80) {
    score += 10;
    reasons.push("Moderate line count change.");
  }

  if (path.includes("secret") || path.includes("credential") || path.includes("token")) {
    score += 35;
    reasons.push("Path references secrets, credentials, or tokens.");
  }

  if (path.includes("tenant") || path.includes("org") || path.includes("installation")) {
    score += 18;
    reasons.push("Tenant or installation boundary appears in the path.");
  }

  if (path.includes("schema") || path.includes("migration")) {
    score += 18;
    reasons.push("Schema or migration behavior can affect existing data.");
  }

  if (path.includes("webhook")) {
    score += 18;
    reasons.push("Webhook paths require signature, replay, and retry review.");
  }

  if (path.includes("auth") || path.includes("permission") || path.includes("role")) {
    score += 28;
    reasons.push("Authorization behavior appears in the path.");
  }

  return {
    file,
    score: Math.max(0, score + Math.min(file.changes / 12, 30)),
    reasons: dedupe(reasons).slice(0, HIGH_RISK_REASON_LIMIT),
    category,
  };
}

function categorizePath(path: string): FileCategory {
  if (/(^|\/)(pnpm-lock|package-lock|yarn.lock|bun.lockb|generated|dist|build|snapshot|__snapshots__)/.test(path)) {
    return "generated";
  }

  if (/(^|\/)(docs?|readme|changelog|runbooks?)(\/|\.|$)/.test(path) || /\.(md|mdx|adoc|rst)$/.test(path)) {
    return "docs";
  }

  if (/(__tests__|\.test\.|\.spec\.|tests?\/|fixtures?\/|mocks?\/)/.test(path)) {
    return "tests";
  }

  if (/(auth|oauth|session|permission|rbac|role|policy|impersonat|audit)/.test(path)) {
    return "auth";
  }

  if (/(schema|migration|drizzle|prisma|sequelize|database|db\/|sql|transaction|repository)/.test(path)) {
    return "database";
  }

  if (/(queue|worker|job|cron|schedule|bullmq|task)/.test(path)) {
    return "jobs";
  }

  if (/(payment|billing|stripe|checkout|invoice|subscription)/.test(path)) {
    return "payments";
  }

  if (/(webhook|integration|github|jira|linear|slack|provider|callback)/.test(path)) {
    return "integrations";
  }

  if (/(api|route|router|controller|graphql|schema\.graphql|openapi|contract|handler)/.test(path)) {
    return "api";
  }

  if (/(docker|k8s|helm|terraform|pulumi|cloudformation|\.github\/workflows|deploy|infra|nginx)/.test(path)) {
    return "infra";
  }

  if (/(^|\/)(\.env|env\.|next\.config|vite\.config|tsconfig|eslint|prettier|package\.json|pnpm-workspace|turbo\.json)/.test(path)) {
    return "config";
  }

  if (/(app\/|components\/|pages\/|styles?\/|css|tsx$|jsx$|ui\/)/.test(path)) {
    return "frontend";
  }

  return "application";
}

function buildChangeGroups(scoredFiles: FileScore[]): ReportChangeGroup[] {
  const grouped = new Map<FileCategory, FileScore[]>();

  for (const file of scoredFiles) {
    const current = grouped.get(file.category) || [];
    current.push(file);
    grouped.set(file.category, current);
  }

  return Array.from(grouped.entries())
    .map(([category, files]) => {
      const definition = CATEGORY_DEFINITIONS[category];
      const highestRisk = files.reduce<RiskLevel>((risk, file) => maxRisk(risk, riskLevelFromScore(file.score)), "low");
      return {
        title: definition.title,
        summary: `${definition.summary} ${files.length} file${files.length === 1 ? "" : "s"} in this group.`,
        files: files.map((file) => file.file.path),
        reviewNotes: dedupe(files.flatMap((file) => file.reasons)).slice(0, 4),
        riskLevel: highestRisk,
      };
    })
    .sort((a, b) => riskWeight(b.riskLevel) - riskWeight(a.riskLevel) || b.files.length - a.files.length);
}

function buildRiskAreas(scoredFiles: FileScore[]): ReportRiskArea[] {
  const highAndMedium = scoredFiles.filter((file) => riskLevelFromScore(file.score) !== "low");
  const groupedByCategory = new Map<FileCategory, FileScore[]>();

  for (const file of highAndMedium) {
    const current = groupedByCategory.get(file.category) || [];
    current.push(file);
    groupedByCategory.set(file.category, current);
  }

  return Array.from(groupedByCategory.entries())
    .map<ReportRiskArea>(([category, files]) => {
      const highestRisk = files.reduce<RiskLevel>((risk, file) => maxRisk(risk, riskLevelFromScore(file.score)), "low");
      const topReasons = dedupe(files.flatMap((file) => file.reasons)).slice(0, 2).join(" ");
      return {
        level: highestRisk,
        title: CATEGORY_DEFINITIONS[category].title,
        reason: topReasons || CATEGORY_DEFINITIONS[category].reviewNote,
        files: files.slice(0, 8).map((file) => file.file.path),
      };
    })
    .sort((a, b) => riskWeight(b.level) - riskWeight(a.level) || b.files.length - a.files.length)
    .slice(0, 6);
}

function buildIntent(context: PullRequestContext, primaryGroups: string[]) {
  const bodySentence = context.body?.split(/\n+/).map((line) => line.trim()).find(Boolean);
  const sourceText = bodySentence && bodySentence.length > 12 ? bodySentence : context.title;
  const areas = primaryGroups.length > 0 ? ` The main changed areas are ${primaryGroups.join(", ")}.` : "";

  return `${sourceText}${areas}`;
}

function summarizeFile(scored: FileScore) {
  const definition = CATEGORY_DEFINITIONS[scored.category];
  const changeText = `${scored.file.additions} additions, ${scored.file.deletions} deletions`;
  return `${definition.title}. ${changeText}. ${scored.reasons[0]}`;
}

function recommendationFor(highRiskCount: number, testsChanged: boolean) {
  if (highRiskCount > 0 && !testsChanged) {
    return "review_carefully";
  }

  if (highRiskCount > 2) {
    return "review_carefully";
  }

  return "comment";
}

function buildDecisionSummary(highRiskCount: number, testsChanged: boolean, rankedFiles: ReportRankedFile[]) {
  const leadFile = rankedFiles[0]?.path;

  if (!leadFile) {
    return "GitHub returned no changed files. Confirm the PR state before reviewing.";
  }

  if (highRiskCount > 0 && !testsChanged) {
    return `Start with ${leadFile}. There are ${highRiskCount} high-risk file${highRiskCount === 1 ? "" : "s"} and no changed test files, so do not treat this as a low-risk approval path yet.`;
  }

  if (highRiskCount > 0) {
    return `Start with ${leadFile}. High-risk files are present, but test files also changed. Review whether those tests prove the risky behavior.`;
  }

  return `Start with ${leadFile}. No high-risk files were detected by the deterministic ranker, but the reviewer should still verify the main contract and checks.`;
}

function inferSuggestedCommands(scoredFiles: FileScore[]) {
  const commands = new Set<string>();

  commands.add("Run the repository's normal test suite for the touched packages.");

  if (scoredFiles.some((file) => file.category === "frontend")) {
    commands.add("Run the frontend typecheck and lint commands.");
  }

  if (scoredFiles.some((file) => file.category === "database")) {
    commands.add("Run migration/schema checks against a disposable database.");
  }

  if (scoredFiles.some((file) => file.category === "api" || file.category === "integrations")) {
    commands.add("Run API contract or integration tests for changed endpoints.");
  }

  return Array.from(commands);
}

function inferManualChecks(scoredFiles: FileScore[], context: PullRequestContext) {
  const checks = new Set<string>();

  checks.add("Open files in ranked order instead of GitHub's alphabetical order.");
  checks.add("Compare the PR title/body intent with the highest-risk changed files.");

  if (context.checks.checkRuns.length > 0 || context.checks.statuses.length > 0) {
    checks.add("Inspect failing, skipped, or still-pending GitHub checks before approving.");
  }

  if (scoredFiles.some((file) => file.category === "auth")) {
    checks.add("Manually verify authentication, authorization, tenant, and role boundaries.");
  }

  if (scoredFiles.some((file) => file.category === "infra" || file.category === "config")) {
    checks.add("Check secret handling, environment defaults, and rollback behavior.");
  }

  return Array.from(checks);
}

function inferOpenQuestions(scoredFiles: FileScore[], context: PullRequestContext, testsChanged: boolean) {
  const questions = new Set<string>();

  if (!testsChanged) {
    questions.add("Which existing tests prove the highest-risk changed paths?");
  }

  if (context.body === null || context.body.trim().length < 40) {
    questions.add("What behavior is intentionally out of scope for this PR? The PR body is sparse.");
  }

  if (scoredFiles.some((file) => file.category === "database")) {
    questions.add("What is the rollback or backfill plan if the persistence change fails after merge?");
  }

  if (scoredFiles.some((file) => file.category === "integrations")) {
    questions.add("How are provider retries, duplicate events, and signature failures handled?");
  }

  return Array.from(questions).slice(0, 6);
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 82) {
    return "high";
  }

  if (score >= 42) {
    return "medium";
  }

  return "low";
}

function reviewModeFromRankAndRisk(rank: number, risk: RiskLevel): ReviewMode {
  if (risk === "high" || rank <= 3) {
    return "read";
  }

  if (risk === "medium" || rank <= 8) {
    return "check";
  }

  return "skim";
}

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return riskWeight(a) >= riskWeight(b) ? a : b;
}

function riskWeight(risk: RiskLevel) {
  switch (risk) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}
