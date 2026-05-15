import "server-only";

import { buildGitHubPullRequestUrl, parseGitHubPullRequestUrl, type GitHubPullRequestRef } from "@/lib/github/pr-url";
import { fetchPullRequestContext } from "@/lib/github/client";
import { resolvePullRequestRepositoryAuth } from "@/lib/github/repository-access";
import { generatePullBriefReport } from "@/lib/reports/generator";
import type { ReportRecord } from "@/lib/reports/types";
import { buildReportId, findReportByHeadSha, saveReportRecord } from "@/lib/storage/report-store";

export type GenerateReportOptions = {
  force?: boolean;
};

export async function createReportFromUrl(
  input: string,
  tenantId: string,
  options: GenerateReportOptions = {},
) {
  const ref = parseGitHubPullRequestUrl(input);
  return createReportForPullRequest(ref, tenantId, {
    ...options,
    sourceUrl: buildGitHubPullRequestUrl(ref),
  });
}

export async function createReportForPullRequest(
  ref: GitHubPullRequestRef,
  tenantId: string,
  options: GenerateReportOptions & { sourceUrl?: string } = {},
): Promise<ReportRecord> {
  const repositoryAuth = await resolvePullRequestRepositoryAuth(tenantId, ref);
  const context = await fetchPullRequestContext(ref, { token: repositoryAuth.token });
  const id = buildReportId({ ...ref, tenantId, headSha: context.headSha });

  if (!options.force) {
    const existing = await findReportByHeadSha({ ...ref, tenantId, headSha: context.headSha });
    if (existing?.status === "ready") {
      return existing;
    }
  }

  const now = new Date().toISOString();
  const sourceUrl = options.sourceUrl || buildGitHubPullRequestUrl(ref);

  try {
    const report = await generatePullBriefReport(context);
    return saveReportRecord({
      id,
      tenantId,
      owner: ref.owner,
      repo: ref.repo,
      number: ref.number,
      sourceUrl,
      headSha: context.headSha,
      status: "ready",
      createdAt: now,
      updatedAt: now,
      context,
      report,
      errorMessage: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed.";
    const failedRecord: ReportRecord = {
      id,
      tenantId,
      owner: ref.owner,
      repo: ref.repo,
      number: ref.number,
      sourceUrl,
      headSha: context.headSha,
      status: "failed",
      createdAt: now,
      updatedAt: now,
      context,
      report: null,
      errorMessage: message,
    };

    await saveReportRecord(failedRecord);
    throw error;
  }
}
