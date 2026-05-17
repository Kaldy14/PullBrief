import { NextResponse } from "next/server";

import { ForbiddenError, requireApiAccess, UnauthorizedError } from "@/lib/auth/guard";
import { publishReportCheckRun, publishStickyComment, publishPullRequestReview } from "@/lib/github/writeback";
import { getReportRecord } from "@/lib/storage/report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WritebackRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

type WritebackBody = {
  checkRun?: boolean;
  stickyComment?: boolean;
  pullRequestReview?: boolean;
};

export async function POST(request: Request, { params }: WritebackRouteProps) {
  try {
    const access = await requireApiAccess(request.headers);

    if (access.role === "viewer") {
      throw new ForbiddenError("Reviewer access required.");
    }

    const { id } = await params;
    const record = await getReportRecord(id, access.tenantId);

    if (!record) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const body = (await request.json()) as WritebackBody;
    const publishCheckRun = body.checkRun ?? true;
    const publishComment = body.stickyComment ?? true;
    const publishReview = body.pullRequestReview ?? false;
    const results = [];

    if (publishCheckRun) {
      results.push(await publishReportCheckRun(record));
    }

    if (publishComment) {
      results.push(await publishStickyComment(record));
    }

    if (publishReview) {
      results.push(await publishPullRequestReview(record));
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to publish report to GitHub." },
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
