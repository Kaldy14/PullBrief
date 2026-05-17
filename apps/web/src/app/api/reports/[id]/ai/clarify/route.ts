import { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError, requireApiAccess, UnauthorizedError } from "@/lib/auth/guard";
import { answerPullBriefQuestion } from "@/lib/reports/assistant";
import { getReportRecord } from "@/lib/storage/report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClarifyRouteProps = {
  params: Promise<{ id: string }>;
};

const clarifyPayloadSchema = z.object({
  question: z.string().trim().min(1).max(4_000),
  path: z.string().trim().min(1).max(1_000).nullable().optional(),
  selectedLine: z.number().int().positive().nullable().optional(),
});

export async function POST(request: Request, { params }: ClarifyRouteProps) {
  try {
    const access = await requireApiAccess(request.headers);
    const { id } = await params;
    const record = await getReportRecord(id, access.tenantId);

    if (!record) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const payload = clarifyPayloadSchema.parse(await request.json());
    const answer = await answerPullBriefQuestion({
      record,
      question: payload.question,
      path: payload.path,
      selectedLine: payload.selectedLine,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to ask PullBrief AI." },
      { status: statusForError(error) },
    );
  }
}

function statusForError(error: unknown) {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return error.status;
  }

  if (error instanceof z.ZodError) {
    return 400;
  }

  return 500;
}
