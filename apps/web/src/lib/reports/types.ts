import type { GitHubPullRequestRef } from "@/lib/github/pr-url";

export type RiskLevel = "low" | "medium" | "high";
export type ReviewMode = "read" | "check" | "skim";
export type ReportRecommendation = "approve" | "comment" | "request_changes" | "review_carefully";

export type PullRequestLabel = {
  name: string;
  color: string;
};

export type PullRequestReviewer = {
  login: string;
  type: string;
};

export type PullRequestContextFile = {
  path: string;
  previousPath: string | null;
  status: string;
  sha: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
  blobUrl: string;
  rawUrl: string;
};

export type PullRequestContextCommit = {
  sha: string;
  htmlUrl: string;
  message: string;
  authorName: string | null;
  authorLogin: string | null;
  authoredAt: string | null;
};

export type PullRequestCheckRun = {
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type PullRequestStatus = {
  context: string;
  state: string;
  description: string | null;
  targetUrl: string | null;
};

export type PullRequestChecks = {
  state: string | null;
  checkRuns: PullRequestCheckRun[];
  statuses: PullRequestStatus[];
  fetchWarnings: string[];
};

export type PullRequestContext = GitHubPullRequestRef & {
  schemaVersion: "pullbrief.pr_context.v1";
  fetchedAt: string;
  htmlUrl: string;
  title: string;
  body: string | null;
  state: string;
  draft: boolean;
  authorLogin: string;
  baseRef: string;
  baseSha: string;
  baseRepoFullName: string;
  headRef: string;
  headSha: string;
  headRepoFullName: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  labels: PullRequestLabel[];
  requestedReviewers: PullRequestReviewer[];
  stats: {
    filesChanged: number;
    additions: number;
    deletions: number;
    commits: number;
  };
  files: PullRequestContextFile[];
  commits: PullRequestContextCommit[];
  checks: PullRequestChecks;
};

export type ReportGenerator = {
  provider: "pi" | "heuristic";
  model: string;
  mode: "print-cli" | "deterministic";
  warnings: string[];
};

export type ReportSummary = {
  intent: string;
  businessImpact: string;
  technicalImpact: string;
  reviewerFocus: string[];
};

export type ReportDecision = {
  recommendation: ReportRecommendation;
  summary: string;
  blockingIssues: string[];
};

export type ReportRiskArea = {
  level: RiskLevel;
  title: string;
  reason: string;
  files: string[];
};

export type ReportChangeGroup = {
  title: string;
  summary: string;
  files: string[];
  reviewNotes: string[];
  riskLevel: RiskLevel;
};

export type ReportRankedFile = {
  path: string;
  rank: number;
  reason: string;
  summary: string;
  riskLevel: RiskLevel;
  reviewMode: ReviewMode;
};

export type ReportVerification = {
  suggestedCommands: string[];
  manualChecks: string[];
  missingTests: string[];
};

export type PullBriefReport = {
  schemaVersion: "pullbrief.report.v1";
  generatedAt: string;
  generator: ReportGenerator;
  prSummary: ReportSummary;
  decision: ReportDecision;
  riskAreas: ReportRiskArea[];
  changeGroups: ReportChangeGroup[];
  rankedFiles: ReportRankedFile[];
  verification: ReportVerification;
  openQuestions: string[];
};

export type ReportRecordStatus = "ready" | "failed";

export type ReportRecord = GitHubPullRequestRef & {
  id: string;
  tenantId: string;
  sourceUrl: string;
  headSha: string;
  status: ReportRecordStatus;
  createdAt: string;
  updatedAt: string;
  context: PullRequestContext;
  report: PullBriefReport | null;
  errorMessage: string | null;
};
