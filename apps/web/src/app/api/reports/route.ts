import { NextResponse } from "next/server";

import { requireApiAccess, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { buildPullBriefRoute, parsePositivePullNumber } from "@/lib/github/pr-url";
import { createReportForPullRequest, createReportFromUrl } from "@/lib/reports/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateReportRequest = {
  prUrl?: string;
  owner?: string;
  repo?: string;
  number?: number | string;
  force?: boolean;
};

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(request.headers);
    const payload = (await request.json()) as CreateReportRequest;
    const force = Boolean(payload.force);
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
