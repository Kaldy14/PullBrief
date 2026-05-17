import { NextResponse } from "next/server";

import { ForbiddenError, requireApiAccess, UnauthorizedError } from "@/lib/auth/guard";
import { retryReviewJobForTenant } from "@/lib/review-jobs/queue";
import { buildReviewJobRoute } from "@/lib/review-jobs/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetryReviewJobRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RetryReviewJobRouteProps) {
  try {
    const access = await requireApiAccess(request.headers);
    const { id } = await params;
    const job = await retryReviewJobForTenant({
      id,
      tenantId: access.tenantId,
      requestedByUserId: access.userId,
    });

    if (!job) {
      return NextResponse.json({ error: "Review job not found." }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      url: buildReviewJobRoute(job),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to retry review job." },
      { status: statusForError(error) },
    );
  }
}

function statusForError(error: unknown) {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return error.status;
  }

  return 500;
}
