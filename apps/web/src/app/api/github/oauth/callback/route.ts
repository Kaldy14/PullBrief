import { NextResponse } from "next/server";

import { requireApiAdminAccess, UnauthorizedError } from "@/lib/auth/guard";
import {
  markGitHubInstallStateConsumed,
  markGitHubInstallStateOAuthVerified,
  syncGitHubInstallation,
  validateGitHubOAuthInstallState,
} from "@/lib/github/installations";
import { exchangeGitHubUserCode, userTokenCanAccessInstallation } from "@/lib/github/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const access = await requireApiAdminAccess(request.headers);
    const code = requiredParam(url, "code");
    const oauthState = requiredParam(url, "state");
    const installState = await validateGitHubOAuthInstallState({ oauthState, access });
    const githubInstallationId = installState.githubInstallationId;

    if (!githubInstallationId) {
      throw new Error("GitHub installation id is missing from setup verification state.");
    }

    const token = await exchangeGitHubUserCode(code);
    const verified = await userTokenCanAccessInstallation({
      token,
      githubInstallationId,
    });

    if (!verified) {
      throw new Error("The authorized GitHub user cannot access this GitHub App installation.");
    }

    await markGitHubInstallStateOAuthVerified(installState.id);
    const result = await syncGitHubInstallation({
      tenantId: access.tenantId,
      githubInstallationId,
    });
    await markGitHubInstallStateConsumed({
      installStateId: installState.id,
      installationId: githubInstallationId,
      setupAction: installState.setupAction,
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
    redirectUrl.searchParams.set("error", error instanceof Error ? error.message : "Unable to verify GitHub installation.");
    return NextResponse.redirect(redirectUrl);
  }
}

function requiredParam(url: URL, name: string) {
  const value = url.searchParams.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing GitHub OAuth ${name}.`);
  }

  return value;
}
