import { NextResponse } from "next/server";

import { requireApiAccess, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { buildPullBriefRoute, parsePositivePullNumber } from "@/lib/github/pr-url";
import { createReportForPullRequest, createReportFromUrl } from "@/lib/reports/service";
import { enqueueReviewJob, enqueueReviewJobFromUrl } from "@/lib/review-jobs/queue";
import { buildReviewJobRoute } from "@/lib/review-jobs/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateReportRequest = {
  prUrl?: string;
  owner?: string;
  repo?: string;
  number?: number | string;
  force?: boolean;
  async?: boolean;
};

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(request.headers);
    const payload = (await request.json()) as CreateReportRequest;
    const force = Boolean(payload.force);

    if (payload.async !== false) {
      const job = payload.prUrl
        ? await enqueueReviewJobFromUrl({
            tenantId: access.tenantId,
            requestedByUserId: access.userId,
            prUrl: payload.prUrl,
            trigger: force ? "rerun" : "manual",
            priority: force ? 10 : undefined,
          })
        : await enqueueReviewJob({
            tenantId: access.tenantId,
            requestedByUserId: access.userId,
            owner: stringValue(payload.owner, "owner"),
            repo: stringValue(payload.repo, "repo"),
            number: numberValue(payload.number),
            trigger: force ? "rerun" : "manual",
            priority: force ? 10 : undefined,
          });

      return NextResponse.json({
        jobId: job.id,
        status: job.status,
        owner: job.owner,
        repo: job.repo,
        number: job.number,
        url: buildReviewJobRoute(job),
      }, { status: 202 });
    }

    const record = payload.prUrl
      ? await createReportFromUrl(payload.prUrl, access.tenantId, { force })
      : await createReportForPullRequest({
          owner: stringValue(payload.owner, "owner"),
          repo: stringValue(payload.repo, "repo"),
          number: numberValue(payload.number),
        }, access.tenantId, { force });

    return NextResponse.json({
      id: record.id,
      status: record.status,
      owner: record.owner,
      repo: record.repo,
      number: record.number,
      headSha: record.headSha,
      url: buildPullBriefRoute(record),
      generatedAt: record.report?.generatedAt || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate report.",
      },
      { status: statusForError(error) },
    );
  }
}

function stringValue(value: unknown, name: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing ${name}.`);
  }

  return value.trim();
}

function numberValue(value: unknown) {
  if (typeof value === "number") {
    return parsePositivePullNumber(String(value));
  }

  if (typeof value === "string") {
    return parsePositivePullNumber(value);
  }

  throw new Error("Missing pull request number.");
}

function statusForError(error: unknown) {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return error.status;
  }

  return 400;
}
