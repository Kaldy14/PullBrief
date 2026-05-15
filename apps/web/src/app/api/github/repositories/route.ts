import { NextResponse } from "next/server";

import { ForbiddenError, requireApiAccess, requireApiAdminAccess, UnauthorizedError } from "@/lib/auth/guard";
import { listTenantRepositories, setRepositoryEnabled } from "@/lib/github/installations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  repositoryId?: string;
  enabled?: boolean;
};

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(request.headers);
    const repositories = await listTenantRepositories(access.tenantId);

    return NextResponse.json({ repositories });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list repositories." },
      { status: statusForError(error) },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireApiAdminAccess(request.headers);
    const body = (await request.json()) as PatchBody;

    if (typeof body.repositoryId !== "string" || body.repositoryId.length === 0) {
      return NextResponse.json({ error: "repositoryId is required." }, { status: 400 });
    }

    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled boolean is required." }, { status: 400 });
    }

    const repository = await setRepositoryEnabled({
      tenantId: access.tenantId,
      repositoryId: body.repositoryId,
      enabled: body.enabled,
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found." }, { status: 404 });
    }

    return NextResponse.json({ repository });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update repository." },
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
