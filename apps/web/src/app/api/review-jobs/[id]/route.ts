import { NextResponse } from "next/server";

import { ForbiddenError, requireApiAccess, UnauthorizedError } from "@/lib/auth/guard";
import { getReviewJobForTenant } from "@/lib/review-jobs/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewJobRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: ReviewJobRouteProps) {
  try {
    const access = await requireApiAccess(request.headers);
    const { id } = await params;
    const job = await getReviewJobForTenant(id, access.tenantId);

    if (!job) {
      return NextResponse.json({ error: "Review job not found." }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch review job." },
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
