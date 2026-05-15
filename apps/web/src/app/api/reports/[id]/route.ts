import { NextResponse } from "next/server";

import { requireApiAccess, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { getReportRecord } from "@/lib/storage/report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, { params }: ReportRouteProps) {
  try {
    const access = await requireApiAccess(request.headers);
    const { id } = await params;
    const record = await getReportRecord(id, access.tenantId);

    if (!record) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const includeContext = url.searchParams.get("includeContext") === "1";

    return NextResponse.json({
      id: record.id,
      status: record.status,
      owner: record.owner,
      repo: record.repo,
      number: record.number,
      sourceUrl: record.sourceUrl,
      headSha: record.headSha,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      report: record.report,
      errorMessage: record.errorMessage,
      context: includeContext ? record.context : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch report." },
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
