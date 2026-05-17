import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { githubInstallations, prReports, pullRequests, repositories } from "@/db/schema";
import { allowGitHubFallbackFetch, getAllowedGitHubAccounts } from "@/lib/github/app-config";
import type { PullBriefReport, PullRequestContext, ReportRecord } from "@/lib/reports/types";

export async function saveReportRecord(record: ReportRecord): Promise<ReportRecord> {
  const repository = await upsertRepository(record.tenantId, record.context);
  const pullRequest = await upsertPullRequest(record.tenantId, repository.id, record.context);
  const now = new Date(record.updatedAt);

  await db
    .insert(prReports)
    .values({
      id: record.id,
      tenantId: record.tenantId,
      pullRequestId: pullRequest.id,
      headSha: record.headSha,
      status: record.status,
      modelProvider: record.report?.generator.provider || null,
      modelName: record.report?.generator.model || null,
      contextJson: record.context,
      reportJson: record.report,
      errorMessage: record.errorMessage,
      createdAt: new Date(record.createdAt),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: prReports.id,
      set: {
        pullRequestId: pullRequest.id,
        status: record.status,
        modelProvider: record.report?.generator.provider || null,
        modelName: record.report?.generator.model || null,
        contextJson: record.context,
        reportJson: record.report,
        errorMessage: record.errorMessage,
        updatedAt: now,
      },
    });

  return record;
}

export async function getReportRecord(id: string, tenantId: string): Promise<ReportRecord | null> {
  const [row] = await reportQuery()
    .where(and(eq(prReports.id, id), eq(prReports.tenantId, tenantId), reportVisibilityCondition()))
    .limit(1);

  return row ? rowToRecord(row) : null;
}

export async function findReportByHeadSha(input: {
  tenantId: string;
  owner: string;
  repo: string;
  number: number;
  headSha: string;
}): Promise<ReportRecord | null> {
  const [row] = await reportQuery()
    .where(and(
      eq(prReports.tenantId, input.tenantId),
      eq(repositories.owner, input.owner.toLowerCase()),
      eq(repositories.name, input.repo.toLowerCase()),
      eq(pullRequests.number, input.number),
      eq(prReports.headSha, input.headSha),
      reportVisibilityCondition(),
    ))
    .limit(1);

  return row ? rowToRecord(row) : null;
}

export async function findLatestReport(input: {
  tenantId: string;
  owner: string;
  repo: string;
  number: number;
}): Promise<ReportRecord | null> {
  const [row] = await reportQuery()
    .where(and(
      eq(prReports.tenantId, input.tenantId),
      eq(repositories.owner, input.owner.toLowerCase()),
      eq(repositories.name, input.repo.toLowerCase()),
      eq(pullRequests.number, input.number),
      reportVisibilityCondition(),
    ))
    .orderBy(desc(prReports.updatedAt))
    .limit(1);

  return row ? rowToRecord(row) : null;
}

export async function listReportsForPullRequest(input: {
  tenantId: string;
  owner: string;
  repo: string;
  number: number;
  limit?: number;
}): Promise<ReportRecord[]> {
  const rows = await reportQuery()
    .where(and(
      eq(prReports.tenantId, input.tenantId),
      eq(repositories.owner, input.owner.toLowerCase()),
      eq(repositories.name, input.repo.toLowerCase()),
      eq(pullRequests.number, input.number),
      reportVisibilityCondition(),
    ))
    .orderBy(desc(prReports.updatedAt))
    .limit(input.limit ?? 10);

  return rows.map(rowToRecord);
}

export async function listRecentReports(tenantId: string, limit = 10): Promise<ReportRecord[]> {
  const rows = await reportQuery()
    .where(and(eq(prReports.tenantId, tenantId), reportVisibilityCondition()))
    .orderBy(desc(prReports.updatedAt))
    .limit(limit);

  return rows.map(rowToRecord);
}

export function buildReportId(input: {
  tenantId: string;
  owner: string;
  repo: string;
  number: number;
  headSha: string;
}) {
  return createHash("sha256")
    .update(`${input.tenantId}:${input.owner.toLowerCase()}/${input.repo.toLowerCase()}#${input.number}:${input.headSha}`)
    .digest("hex")
    .slice(0, 20);
}

function reportVisibilityCondition() {
  const allowedAccounts = getAllowedGitHubAccounts();
  const accountAllowedCondition = allowedAccounts.length > 0
    ? inArray(githubInstallations.accountLogin, allowedAccounts)
    : process.env.NODE_ENV === "production"
      ? eq(githubInstallations.accountLogin, "__pullbrief_no_allowed_accounts__")
      : undefined;
  const activeInstallation = and(
    eq(repositories.enabled, true),
    isNotNull(repositories.installationId),
    isNull(githubInstallations.deletedAt),
    isNull(githubInstallations.suspendedAt),
    accountAllowedCondition,
  );

  if (allowGitHubFallbackFetch()) {
    return or(
      activeInstallation,
      and(eq(repositories.enabled, true), isNull(repositories.installationId)),
    );
  }

  return activeInstallation;
}

function reportQuery() {
  return db
    .select({
      report: prReports,
      pullRequest: pullRequests,
      repository: repositories,
      installation: githubInstallations,
    })
    .from(prReports)
    .innerJoin(pullRequests, eq(prReports.pullRequestId, pullRequests.id))
    .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
    .leftJoin(githubInstallations, eq(repositories.installationId, githubInstallations.id));
}

async function upsertRepository(tenantId: string, context: PullRequestContext) {
  const [repository] = await db
    .insert(repositories)
    .values({
      id: randomUUID(),
      tenantId,
      owner: context.owner.toLowerCase(),
      name: context.repo.toLowerCase(),
      fullName: `${context.owner}/${context.repo}`.toLowerCase(),
      githubRepositoryId: null,
      defaultBranch: context.baseRef,
      htmlUrl: `https://github.com/${context.owner}/${context.repo}`,
      enabled: true,
      settingsJson: {},
    })
    .onConflictDoUpdate({
      target: [repositories.tenantId, repositories.owner, repositories.name],
      set: {
        fullName: `${context.owner}/${context.repo}`.toLowerCase(),
        defaultBranch: context.baseRef,
        htmlUrl: `https://github.com/${context.owner}/${context.repo}`,
        updatedAt: new Date(),
      },
    })
    .returning();

  return repository;
}

async function upsertPullRequest(
  tenantId: string,
  repositoryId: string,
  context: PullRequestContext,
) {
  const [pullRequest] = await db
    .insert(pullRequests)
    .values({
      id: randomUUID(),
      tenantId,
      repositoryId,
      number: context.number,
      title: context.title,
      authorLogin: context.authorLogin,
      baseRef: context.baseRef,
      headRef: context.headRef,
      headSha: context.headSha,
      state: context.state,
      htmlUrl: context.htmlUrl,
      githubCreatedAt: new Date(context.createdAt),
      githubUpdatedAt: new Date(context.updatedAt),
    })
    .onConflictDoUpdate({
      target: [pullRequests.repositoryId, pullRequests.number],
      set: {
        title: context.title,
        authorLogin: context.authorLogin,
        baseRef: context.baseRef,
        headRef: context.headRef,
        headSha: context.headSha,
        state: context.state,
        htmlUrl: context.htmlUrl,
        githubUpdatedAt: new Date(context.updatedAt),
        updatedAt: new Date(),
      },
    })
    .returning();

  return pullRequest;
}

function rowToRecord(row: {
  report: typeof prReports.$inferSelect;
  pullRequest: typeof pullRequests.$inferSelect;
  repository: typeof repositories.$inferSelect;
  installation: typeof githubInstallations.$inferSelect | null;
}): ReportRecord {
  return {
    id: row.report.id,
    tenantId: row.report.tenantId,
    owner: row.repository.owner,
    repo: row.repository.name,
    number: row.pullRequest.number,
    sourceUrl: row.pullRequest.htmlUrl,
    headSha: row.report.headSha,
    status: row.report.status,
    createdAt: row.report.createdAt.toISOString(),
    updatedAt: row.report.updatedAt.toISOString(),
    context: row.report.contextJson,
    report: normalizeReportJson(row.report.reportJson),
    errorMessage: row.report.errorMessage,
  };
}

function normalizeReportJson(report: PullBriefReport | null): PullBriefReport | null {
  return report ?? null;
}
