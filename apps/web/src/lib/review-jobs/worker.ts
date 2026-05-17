import "server-only";

import { hostname } from "node:os";
import { randomUUID } from "node:crypto";

import { createReportForPullRequest } from "@/lib/reports/service";
import {
  claimNextReviewJob,
  getReportLinks,
  heartbeatReviewJob,
  markReviewJobFailed,
  isPendingReviewJobHeadSha,
  markReviewJobReady,
  rescueStaleReviewJobs,
  type ReviewJob,
} from "@/lib/review-jobs/queue";

export type ReviewWorkerOptions = {
  once?: boolean;
  pollIntervalMs?: number;
  workerId?: string;
};

export type ReviewWorkerStats = {
  processed: number;
  succeeded: number;
  failed: number;
  idle: boolean;
};

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 20_000;

export async function runReviewWorker(options: ReviewWorkerOptions = {}): Promise<ReviewWorkerStats> {
  const workerId = options.workerId || defaultWorkerId();
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const stats: ReviewWorkerStats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    idle: false,
  };

  await rescueStaleReviewJobs();

  while (true) {
    const result = await processNextReviewJob(workerId);

    if (result === "none") {
      stats.idle = true;

      if (options.once) {
        return stats;
      }

      await sleep(pollIntervalMs);
      continue;
    }

    stats.idle = false;
    stats.processed += 1;

    if (result === "ready") {
      stats.succeeded += 1;
    } else {
      stats.failed += 1;
    }

    if (options.once) {
      return stats;
    }
  }
}

export async function processNextReviewJob(workerId = defaultWorkerId()): Promise<"ready" | "failed" | "none"> {
  const job = await claimNextReviewJob(workerId);

  if (!job) {
    return "none";
  }

  return processClaimedReviewJob(job, workerId);
}

async function processClaimedReviewJob(job: ReviewJob, workerId: string): Promise<"ready" | "failed"> {
  const heartbeat = setInterval(() => {
    void heartbeatReviewJob(job.id, workerId).catch((error: unknown) => {
      console.error("review-worker heartbeat failed", error);
    });
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const report = await createReportForPullRequest(
      { owner: job.owner, repo: job.repo, number: job.number },
      job.tenantId,
      { force: job.trigger === "rerun" },
    );
    const links = await getReportLinks(report.id, job.tenantId);
    await markReviewJobReady({
      jobId: job.id,
      workerId,
      reportId: report.id,
      headSha: report.headSha,
      preserveHeadSha: isPendingReviewJobHeadSha(job.headSha),
      repositoryId: links?.repositoryId ?? job.repositoryId,
      pullRequestId: links?.pullRequestId ?? job.pullRequestId,
    });
    return "ready";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review job failed.";
    await markReviewJobFailed({ job, workerId, errorMessage: message });
    return "failed";
  } finally {
    clearInterval(heartbeat);
  }
}

function defaultWorkerId() {
  return `${hostname()}:${process.pid}:${randomUUID()}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
