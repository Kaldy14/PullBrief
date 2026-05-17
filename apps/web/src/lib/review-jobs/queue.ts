import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, lte, or } from "drizzle-orm";

import { db } from "@/db";
import { prReports, pullRequests, repositories, reviewJobs } from "@/db/schema";
import { parseGitHubPullRequestUrl, type GitHubPullRequestRef } from "@/lib/github/pr-url";
import { buildPullBriefRoute } from "@/lib/github/pr-url";

const PENDING_HEAD_SHA = "__pending__";
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_PRIORITY = 0;
const STALE_JOB_TIMEOUT_MS = 15 * 60 * 1000;

export type ReviewJob = typeof reviewJobs.$inferSelect;
export type ReviewJobStatus = ReviewJob["status"];
export type ReviewJobTrigger = ReviewJob["trigger"];

export type ReviewJobView = ReviewJob & {
  reportUrl: string | null;
};

export type EnqueueReviewJobInput = GitHubPullRequestRef & {
  tenantId: string;
  trigger: ReviewJobTrigger;
  headSha?: string | null;
  repositoryId?: string | null;
  pullRequestId?: string | null;
  reportId?: string | null;
  requestedByUserId?: string | null;
  githubDeliveryId?: string | null;
  priority?: number;
  maxAttempts?: number;
  runAt?: Date;
};

export async function enqueueReviewJob(input: EnqueueReviewJobInput): Promise<ReviewJob> {
  const now = new Date();
  const headSha = input.headSha || pendingHeadSha(input.trigger);
  const existing = await findDedupeJob({ ...input, headSha });

  if (existing) {
    if (existing.status === "failed" || existing.status === "cancelled" || shouldRequeueExistingPendingJob(existing, headSha, input.trigger)) {
      const [requeued] = await db
        .update(reviewJobs)
        .set({
          repositoryId: input.repositoryId ?? existing.repositoryId,
          pullRequestId: input.pullRequestId ?? existing.pullRequestId,
          reportId: input.reportId ?? existing.reportId,
          requestedByUserId: input.requestedByUserId ?? existing.requestedByUserId,
          githubDeliveryId: input.githubDeliveryId ?? existing.githubDeliveryId,
          priority: input.priority ?? existing.priority,
          maxAttempts: input.maxAttempts ?? existing.maxAttempts,
          status: "queued",
          attempts: 0,
          runAt: input.runAt ?? now,
          lockedAt: null,
          lockedBy: null,
          lastHeartbeatAt: null,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
          updatedAt: now,
        })
        .where(eq(reviewJobs.id, existing.id))
        .returning();

      return requeued;
    }

    return existing;
  }

  const [inserted] = await db
    .insert(reviewJobs)
    .values({
      id: randomUUID(),
      tenantId: input.tenantId,
      repositoryId: input.repositoryId ?? null,
      pullRequestId: input.pullRequestId ?? null,
      reportId: input.reportId ?? null,
      requestedByUserId: input.requestedByUserId ?? null,
      githubDeliveryId: input.githubDeliveryId ?? null,
      owner: input.owner.toLowerCase(),
      repo: input.repo.toLowerCase(),
      number: input.number,
      headSha,
      trigger: input.trigger,
      status: "queued",
      priority: input.priority ?? DEFAULT_PRIORITY,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      runAt: input.runAt ?? now,
    })
    .onConflictDoNothing({
      target: [reviewJobs.tenantId, reviewJobs.owner, reviewJobs.repo, reviewJobs.number, reviewJobs.headSha, reviewJobs.trigger],
    })
    .returning();

  if (inserted) {
    return inserted;
  }

  const raced = await findDedupeJob({ ...input, headSha });

  if (!raced) {
    throw new Error("Unable to enqueue or find review job.");
  }

  return raced;
}

export async function enqueueReviewJobFromUrl(input: {
  tenantId: string;
  prUrl: string;
  trigger?: ReviewJobTrigger;
  requestedByUserId?: string | null;
  priority?: number;
}) {
  const ref = parseGitHubPullRequestUrl(input.prUrl);
  return enqueueReviewJob({
    ...ref,
    tenantId: input.tenantId,
    trigger: input.trigger ?? "manual",
    requestedByUserId: input.requestedByUserId ?? null,
    priority: input.priority,
  });
}

export async function claimNextReviewJob(workerId: string): Promise<ReviewJob | null> {
  const now = new Date();

  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(reviewJobs)
      .where(and(eq(reviewJobs.status, "queued"), lte(reviewJobs.runAt, now)))
      .orderBy(desc(reviewJobs.priority), asc(reviewJobs.runAt), asc(reviewJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!job) {
      return null;
    }

    const [claimed] = await tx
      .update(reviewJobs)
      .set({
        status: "running",
        attempts: job.attempts + 1,
        lockedAt: now,
        lockedBy: workerId,
        lastHeartbeatAt: now,
        startedAt: job.startedAt ?? now,
        completedAt: null,
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(reviewJobs.id, job.id))
      .returning();

    return claimed;
  });
}

export async function rescueStaleReviewJobs(timeoutMs = STALE_JOB_TIMEOUT_MS) {
  const cutoff = new Date(Date.now() - timeoutMs);
  const rows = await db
    .update(reviewJobs)
    .set({
      status: "queued",
      lockedAt: null,
      lockedBy: null,
      lastHeartbeatAt: null,
      errorMessage: "Worker heartbeat timed out; job was requeued.",
      runAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(
      eq(reviewJobs.status, "running"),
      or(lte(reviewJobs.lastHeartbeatAt, cutoff), lte(reviewJobs.lockedAt, cutoff)),
    ))
    .returning({ id: reviewJobs.id });

  return rows.length;
}

export async function markReviewJobReady(input: {
  jobId: string;
  workerId: string;
  reportId: string;
  headSha: string;
  preserveHeadSha?: boolean;
  repositoryId?: string | null;
  pullRequestId?: string | null;
}) {
  const [job] = await db
    .update(reviewJobs)
    .set({
      status: "ready",
      reportId: input.reportId,
      headSha: input.preserveHeadSha ? undefined : input.headSha,
      repositoryId: input.repositoryId ?? undefined,
      pullRequestId: input.pullRequestId ?? undefined,
      lockedAt: null,
      lockedBy: null,
      lastHeartbeatAt: null,
      errorMessage: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(reviewJobs.id, input.jobId), eq(reviewJobs.lockedBy, input.workerId), eq(reviewJobs.status, "running")))
    .returning();

  return job;
}

export async function markReviewJobFailed(input: {
  job: ReviewJob;
  workerId: string;
  errorMessage: string;
}) {
  const shouldRetry = input.job.attempts < input.job.maxAttempts;
  const now = new Date();
  const [job] = await db
    .update(reviewJobs)
    .set({
      status: shouldRetry ? "queued" : "failed",
      runAt: shouldRetry ? nextRetryAt(input.job.attempts) : input.job.runAt,
      lockedAt: null,
      lockedBy: null,
      lastHeartbeatAt: null,
      errorMessage: input.errorMessage,
      completedAt: shouldRetry ? null : now,
      updatedAt: now,
    })
    .where(and(eq(reviewJobs.id, input.job.id), eq(reviewJobs.lockedBy, input.workerId), eq(reviewJobs.status, "running")))
    .returning();

  return job;
}

export async function heartbeatReviewJob(jobId: string, workerId: string) {
  await db
    .update(reviewJobs)
    .set({
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(reviewJobs.id, jobId), eq(reviewJobs.lockedBy, workerId), eq(reviewJobs.status, "running")));
}

export async function retryReviewJobForTenant(input: {
  id: string;
  tenantId: string;
  requestedByUserId?: string | null;
}): Promise<ReviewJob | null> {
  const [job] = await db
    .select()
    .from(reviewJobs)
    .where(and(eq(reviewJobs.id, input.id), eq(reviewJobs.tenantId, input.tenantId)))
    .limit(1);

  if (!job) {
    return null;
  }

  if (job.status !== "failed" && job.status !== "cancelled") {
    return job;
  }

  const [retried] = await db
    .update(reviewJobs)
    .set({
      status: "queued",
      attempts: 0,
      requestedByUserId: input.requestedByUserId ?? job.requestedByUserId,
      runAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastHeartbeatAt: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(reviewJobs.id, input.id), eq(reviewJobs.tenantId, input.tenantId)))
    .returning();

  return retried;
}

export async function getReviewJobForTenant(id: string, tenantId: string): Promise<ReviewJobView | null> {
  const [job] = await db
    .select()
    .from(reviewJobs)
    .where(and(eq(reviewJobs.id, id), eq(reviewJobs.tenantId, tenantId)))
    .limit(1);

  return job ? withReportUrl(job) : null;
}

export async function listReviewJobsForTenant(tenantId: string, limit = 20): Promise<ReviewJobView[]> {
  const rows = await db
    .select()
    .from(reviewJobs)
    .where(eq(reviewJobs.tenantId, tenantId))
    .orderBy(desc(reviewJobs.updatedAt))
    .limit(limit);

  return rows.map(withReportUrl);
}

export async function getReportLinks(reportId: string, tenantId: string) {
  const [row] = await db
    .select({
      reportId: prReports.id,
      repositoryId: repositories.id,
      pullRequestId: pullRequests.id,
      owner: repositories.owner,
      repo: repositories.name,
      number: pullRequests.number,
    })
    .from(prReports)
    .innerJoin(pullRequests, eq(prReports.pullRequestId, pullRequests.id))
    .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
    .where(and(eq(prReports.id, reportId), eq(prReports.tenantId, tenantId)))
    .limit(1);

  return row || null;
}

function withReportUrl(job: ReviewJob): ReviewJobView {
  return {
    ...job,
    reportUrl: job.status === "ready" && job.reportId
      ? buildPullBriefRoute({ owner: job.owner, repo: job.repo, number: job.number })
      : null,
  };
}

async function findDedupeJob(input: EnqueueReviewJobInput & { headSha: string }) {
  const [row] = await db
    .select()
    .from(reviewJobs)
    .where(and(
      eq(reviewJobs.tenantId, input.tenantId),
      eq(reviewJobs.owner, input.owner.toLowerCase()),
      eq(reviewJobs.repo, input.repo.toLowerCase()),
      eq(reviewJobs.number, input.number),
      eq(reviewJobs.headSha, input.headSha),
      eq(reviewJobs.trigger, input.trigger),
    ))
    .limit(1);

  return row || null;
}

function shouldRequeueExistingPendingJob(job: ReviewJob, headSha: string, trigger: ReviewJobTrigger) {
  return job.status === "ready" && headSha.startsWith(PENDING_HEAD_SHA) && (trigger === "manual" || trigger === "rerun");
}

export function isPendingReviewJobHeadSha(headSha: string | null) {
  return Boolean(headSha?.startsWith(PENDING_HEAD_SHA));
}

function pendingHeadSha(trigger: ReviewJobTrigger) {
  return `${PENDING_HEAD_SHA}:${trigger}`;
}

function nextRetryAt(attempts: number) {
  const delaySeconds = Math.min(900, 30 * (2 ** Math.max(0, attempts - 1)));
  return new Date(Date.now() + delaySeconds * 1000);
}
