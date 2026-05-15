import { NextResponse } from "next/server";

import { ForbiddenError, requireApiAdminAccess, UnauthorizedError } from "@/lib/auth/guard";
import { GitHubAppConfigError } from "@/lib/github/app-config";
import { createGitHubInstallRedirect } from "@/lib/github/installations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await requireApiAdminAccess(request.headers);
    const url = new URL(request.url);
    const redirectUrl = await createGitHubInstallRedirect(access, url.searchParams.get("returnTo") || "/settings/github");

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const status = statusForError(error);
    const url = new URL("/settings/github", request.url);
    url.searchParams.set("error", error instanceof Error ? error.message : "Unable to start GitHub App install.");

    if (status === 401) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("next", "/settings/github");
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.redirect(url);
  }
}

function statusForError(error: unknown) {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof GitHubAppConfigError) {
    return error.status;
  }

  return 500;
}
