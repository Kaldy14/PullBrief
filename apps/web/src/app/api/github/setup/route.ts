import { NextResponse } from "next/server";

import { requireApiAdminAccess, UnauthorizedError } from "@/lib/auth/guard";
import { buildGitHubUserAuthorizationUrl, githubUserInstallVerificationRequired } from "@/lib/github/app-config";
import {
  GitHubInstallationStateError,
  markGitHubInstallStateConsumed,
  prepareGitHubInstallUserVerification,
  syncGitHubInstallation,
  validateGitHubInstallState,
} from "@/lib/github/installations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const access = await requireApiAdminAccess(request.headers);
    const installationId = requiredParam(url, "installation_id");
    const state = requiredParam(url, "state");
    const setupAction = url.searchParams.get("setup_action");
    const installState = await validateGitHubInstallState({
      state,
      access,
    });

    if (githubUserInstallVerificationRequired()) {
      const verification = await prepareGitHubInstallUserVerification({
        installStateId: installState.id,
        installationId,
        setupAction,
      });
      return NextResponse.redirect(buildGitHubUserAuthorizationUrl(verification.oauthState));
    }

    const result = await syncGitHubInstallation({
      tenantId: access.tenantId,
      githubInstallationId: installationId,
    });

    await markGitHubInstallStateConsumed({
      installStateId: installState.id,
      installationId,
      setupAction,
    });

    const redirectUrl = new URL(installState.returnPath, request.url);
    redirectUrl.searchParams.set("github", "installed");
    redirectUrl.searchParams.set("installation", result.installation.githubInstallationId);
    redirectUrl.searchParams.set("repos", String(result.repositories.length));
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("next", "/settings/github");
      return NextResponse.redirect(signInUrl);
    }

    const redirectUrl = new URL("/settings/github", request.url);
    redirectUrl.searchParams.set("error", error instanceof Error ? error.message : "Unable to complete GitHub setup.");
    return NextResponse.redirect(redirectUrl);
  }
}

function requiredParam(url: URL, name: string) {
  const value = url.searchParams.get(name)?.trim();

  if (!value) {
    throw new GitHubInstallationStateError(`Missing GitHub ${name}.`);
  }

  return value;
}
