import "server-only";

import { getGitHubAppConfig, GitHubAppConfigError } from "@/lib/github/app-config";

const MAX_INSTALLATION_PAGES = 10;

type OAuthTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGitHubUserCode(code: string) {
  const config = getGitHubAppConfig();

  if (!config?.clientId || !config.clientSecret) {
    throw new GitHubAppConfigError("GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET are required for setup verification.");
  }

  const response = await fetch(`https://${process.env.PULLBRIEF_GITHUB_HOST?.trim() || "github.com"}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "pullbrief-github-app-oauth",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
    }),
    cache: "no-store",
  });

  const body = await response.json() as OAuthTokenResponse;

  if (!response.ok || body.error || !body.access_token) {
    throw new Error(body.error_description || body.error || "Unable to authorize GitHub user for setup verification.");
  }

  return body.access_token;
}

export async function userTokenCanAccessInstallation(input: {
  token: string;
  githubInstallationId: string;
}) {
  for (let page = 1; page <= MAX_INSTALLATION_PAGES; page += 1) {
    const url = new URL("/user/installations", process.env.PULLBRIEF_GITHUB_API_BASE_URL?.trim() || "https://api.github.com");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.token}`,
        "User-Agent": "pullbrief-github-app-oauth",
        "X-GitHub-Api-Version": process.env.PULLBRIEF_GITHUB_API_VERSION?.trim() || "2022-11-28",
      },
      cache: "no-store",
    });

    const body = await response.json() as unknown;

    if (!response.ok) {
      throw new Error(gitHubErrorMessage(body, response.status));
    }

    const installations = installationsFromResponse(body);

    if (installations.some((id) => id === input.githubInstallationId)) {
      return true;
    }

    if (installations.length < 100) {
      break;
    }
  }

  return false;
}

function installationsFromResponse(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.installations)) {
    return [];
  }

  return value.installations
    .filter(isRecord)
    .map((installation) => installation.id)
    .filter((id): id is string | number => typeof id === "string" || typeof id === "number")
    .map(String);
}

function gitHubErrorMessage(value: unknown, status: number) {
  if (isRecord(value) && typeof value.message === "string") {
    return `GitHub user installation verification failed (${status}): ${value.message}`;
  }

  return `GitHub user installation verification failed with HTTP ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
