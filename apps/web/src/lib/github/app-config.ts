import "server-only";

import { getGitHubWebHost } from "@/lib/github/pr-url";

export type GitHubAppConfig = {
  appId: string;
  appSlug: string;
  privateKey: string;
  webhookSecret: string;
  clientId: string | null;
  clientSecret: string | null;
};

export class GitHubAppConfigError extends Error {
  readonly status = 503;

  constructor(message = "GitHub App is not configured.") {
    super(message);
    this.name = "GitHubAppConfigError";
  }
}

export function getGitHubAppConfig(): GitHubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const appSlug = process.env.GITHUB_APP_SLUG?.trim();
  const privateKey = normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY?.trim());
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim();

  if (!appId || !appSlug || !privateKey || !webhookSecret) {
    return null;
  }

  return {
    appId,
    appSlug,
    privateKey,
    webhookSecret,
    clientId: process.env.GITHUB_APP_CLIENT_ID?.trim() || null,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET?.trim() || null,
  };
}

export function requireGitHubAppConfig(): GitHubAppConfig {
  const config = getGitHubAppConfig();

  if (!config) {
    throw new GitHubAppConfigError();
  }

  return config;
}

export function requireGitHubWebhookSecret() {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new GitHubAppConfigError("GITHUB_WEBHOOK_SECRET is required for GitHub webhooks.");
  }

  return secret;
}

export function isGitHubAppConfigured() {
  return getGitHubAppConfig() !== null;
}

export function isGitHubAppInstallConfigured() {
  const config = getGitHubAppConfig();

  if (!config) {
    return false;
  }

  if (!githubUserInstallVerificationRequired()) {
    return true;
  }

  return Boolean(config.clientId && config.clientSecret);
}

export function buildGitHubAppInstallUrl(state: string) {
  const config = requireGitHubAppConfig();
  const url = new URL(`/apps/${config.appSlug}/installations/new`, `https://${getGitHubWebHost()}`);
  url.searchParams.set("state", state);
  return url.toString();
}

export function buildGitHubUserAuthorizationUrl(oauthState: string) {
  const config = requireGitHubAppConfig();

  if (!config.clientId) {
    throw new GitHubAppConfigError("GITHUB_APP_CLIENT_ID is required for setup verification.");
  }

  const url = new URL("/login/oauth/authorize", `https://${getGitHubWebHost()}`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("state", oauthState);
  return url.toString();
}

export function getAllowedGitHubAccounts() {
  return (process.env.PULLBRIEF_ALLOWED_GITHUB_ACCOUNTS || "")
    .split(",")
    .map((account) => account.trim().toLowerCase())
    .filter(Boolean);
}

export function isGitHubAccountAllowed(accountLogin: string) {
  const allowedAccounts = getAllowedGitHubAccounts();

  if (allowedAccounts.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  return allowedAccounts.includes(accountLogin.toLowerCase());
}

export function requireGitHubAccountAllowed(accountLogin: string) {
  if (!isGitHubAccountAllowed(accountLogin)) {
    if (process.env.NODE_ENV === "production" && getAllowedGitHubAccounts().length === 0) {
      throw new GitHubAppConfigError("PULLBRIEF_ALLOWED_GITHUB_ACCOUNTS is required in production before using GitHub installations.");
    }

    throw new GitHubAppConfigError(`GitHub account ${accountLogin} is not allowed for this PullBrief deployment.`);
  }
}

export function githubUserInstallVerificationRequired() {
  if (process.env.PULLBRIEF_SKIP_GITHUB_USER_INSTALL_VERIFICATION === "true") {
    if (process.env.NODE_ENV === "production") {
      throw new GitHubAppConfigError("PULLBRIEF_SKIP_GITHUB_USER_INSTALL_VERIFICATION cannot be enabled in production.");
    }

    return false;
  }

  return true;
}

export function gitHubAppRequiredForReports() {
  if (process.env.PULLBRIEF_REQUIRE_GITHUB_APP === "true") {
    return true;
  }

  if (process.env.PULLBRIEF_REQUIRE_GITHUB_APP === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production" && isGitHubAppConfigured();
}

export function allowGitHubFallbackFetch() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.PULLBRIEF_ALLOW_GITHUB_TOKEN_FALLBACK === "true"
    && process.env.PULLBRIEF_CONFIRM_LOCALHOST_ONLY_FALLBACK === "true"
    && isLocalAppUrl();
}

function isLocalAppUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";

  try {
    const url = new URL(rawUrl);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

function normalizePrivateKey(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value.replace(/\\n/g, "\n");
}
