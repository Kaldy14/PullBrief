import { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError, requireApiAccess, UnauthorizedError } from "@/lib/auth/guard";
import { submitReviewDraft } from "@/lib/review-drafts/service";
import { getReportRecord } from "@/lib/storage/report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitReviewDraftRouteProps = {
  params: Promise<{ id: string }>;
};

const submitReviewDraftPayloadSchema = z.object({
  reviewEvent: z.enum(["COMMENT", "REQUEST_CHANGES", "APPROVE"]),
  body: z.string().trim().min(1).max(64_000),
  comments: z.array(z.object({
    path: z.string().trim().min(1).max(1_000),
    body: z.string().trim().min(1).max(64_000),
    side: z.enum(["LEFT", "RIGHT"]),
    line: z.number().int().positive().nullable(),
    startLine: z.number().int().positive().nullable().optional(),
    startSide: z.enum(["LEFT", "RIGHT"]).nullable().optional(),
    source: z.enum(["manual", "ai_suggested"]).optional(),
  })).max(100),
});

export async function POST(request: Request, { params }: SubmitReviewDraftRouteProps) {
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

    const payload = submitReviewDraftPayloadSchema.parse(await request.json());
    const draft = await submitReviewDraft({
      record,
      reportId: id,
      tenantId: access.tenantId,
      userId: access.userId,
      reviewEvent: payload.reviewEvent,
      body: payload.body,
      comments: payload.comments,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit PR review." },
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
