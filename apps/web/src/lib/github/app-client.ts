import "server-only";

import { requireGitHubAppConfig } from "@/lib/github/app-config";

export type GitHubInstallationToken = {
  token: string;
  expiresAt: string | null;
  permissions: Record<string, unknown>;
  repositorySelection: string | null;
};

export type GitHubInstallationInfo = {
  githubInstallationId: string;
  githubAppId: string | null;
  accountLogin: string;
  accountType: string;
  targetId: string | null;
  targetType: string | null;
  repositorySelection: string;
  permissions: Record<string, unknown>;
  events: string[];
  suspendedAt: string | null;
};

export type GitHubInstallationRepository = {
  githubRepositoryId: string;
  githubNodeId: string | null;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string | null;
  htmlUrl: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
};

type GitHubAppInstance = InstanceType<typeof import("octokit").App>;

type GlobalWithGitHubApp = typeof globalThis & {
  pullbriefGitHubApp?: GitHubAppInstance;
  pullbriefGitHubAppPromise?: Promise<GitHubAppInstance>;
};

const globalForGitHubApp = globalThis as GlobalWithGitHubApp;

export async function getGitHubApp() {
  if (process.env.NODE_ENV === "production") {
    return createGitHubApp();
  }

  if (globalForGitHubApp.pullbriefGitHubApp) {
    return globalForGitHubApp.pullbriefGitHubApp;
  }

  globalForGitHubApp.pullbriefGitHubAppPromise ??= createGitHubApp();
  globalForGitHubApp.pullbriefGitHubApp = await globalForGitHubApp.pullbriefGitHubAppPromise;
  return globalForGitHubApp.pullbriefGitHubApp;
}

export async function getInstallationToken(
  githubInstallationId: string,
  githubRepositoryId?: string | null,
): Promise<GitHubInstallationToken> {
  const authRequest: Record<string, unknown> = {
    type: "installation",
    installationId: parseGitHubNumericId(githubInstallationId, "installation id"),
  };

  if (githubRepositoryId) {
    authRequest.repositoryIds = [parseGitHubNumericId(githubRepositoryId, "repository id")];
  }

  const app = await getGitHubApp();
  const auth = await app.octokit.auth(authRequest) as unknown;

  if (!isRecord(auth) || typeof auth.token !== "string") {
    throw new Error("GitHub App did not return an installation token.");
  }

  return {
    token: auth.token,
    expiresAt: typeof auth.expiresAt === "string" ? auth.expiresAt : null,
    permissions: isRecord(auth.permissions) ? auth.permissions : {},
    repositorySelection: typeof auth.repositorySelection === "string" ? auth.repositorySelection : null,
  };
}

export async function getInstallationInfo(githubInstallationId: string): Promise<GitHubInstallationInfo> {
  const app = await getGitHubApp();
  const response = await app.octokit.request("GET /app/installations/{installation_id}", {
    installation_id: parseGitHubNumericId(githubInstallationId, "installation id"),
  });

  return parseInstallationInfo(response.data as unknown);
}

export async function listInstallationRepositories(
  githubInstallationId: string,
): Promise<GitHubInstallationRepository[]> {
  const app = await getGitHubApp();
  const octokit = await app.getInstallationOctokit(
    parseGitHubNumericId(githubInstallationId, "installation id"),
  );
  const repositories = await octokit.paginate("GET /installation/repositories", {
    per_page: 100,
  });

  return repositories.map((repo) => parseInstallationRepository(repo as unknown));
}

async function createGitHubApp() {
  const config = requireGitHubAppConfig();
  const appId = parseGitHubNumericId(config.appId, "app id");

  const { App } = await import("octokit");

  return new App({
    appId,
    privateKey: config.privateKey,
    webhooks: {
      secret: config.webhookSecret,
    },
  });
}

function parseInstallationInfo(value: unknown): GitHubInstallationInfo {
  if (!isRecord(value)) {
    throw new Error("GitHub installation response had an unsupported shape.");
  }

  const account = isRecord(value.account) ? value.account : {};

  return {
    githubInstallationId: stringFromUnknown(value.id, "installation id"),
    githubAppId: value.app_id === null || value.app_id === undefined ? null : String(value.app_id),
    accountLogin: stringFromUnknown(account.login, "installation account login").toLowerCase(),
    accountType: stringFromUnknown(account.type, "installation account type"),
    targetId: value.target_id === null || value.target_id === undefined ? null : String(value.target_id),
    targetType: typeof value.target_type === "string" ? value.target_type : null,
    repositorySelection: typeof value.repository_selection === "string" ? value.repository_selection : "selected",
    permissions: isRecord(value.permissions) ? value.permissions : {},
    events: Array.isArray(value.events) ? value.events.filter((event): event is string => typeof event === "string") : [],
    suspendedAt: typeof value.suspended_at === "string" ? value.suspended_at : null,
  };
}

function parseInstallationRepository(value: unknown): GitHubInstallationRepository {
  if (!isRecord(value)) {
    throw new Error("GitHub repository response had an unsupported shape.");
  }

  const owner = isRecord(value.owner) ? value.owner : {};
  const ownerLogin = stringFromUnknown(owner.login, "repository owner");
  const name = stringFromUnknown(value.name, "repository name");
  const fullName = typeof value.full_name === "string" ? value.full_name : `${ownerLogin}/${name}`;

  return {
    githubRepositoryId: stringFromUnknown(value.id, "repository id"),
    githubNodeId: typeof value.node_id === "string" ? value.node_id : null,
    owner: ownerLogin.toLowerCase(),
    name: name.toLowerCase(),
    fullName: fullName.toLowerCase(),
    defaultBranch: typeof value.default_branch === "string" ? value.default_branch : null,
    htmlUrl: typeof value.html_url === "string" ? value.html_url : null,
    private: Boolean(value.private),
    fork: Boolean(value.fork),
    archived: Boolean(value.archived),
  };
}

function parseGitHubNumericId(value: string, name: string) {
  const numeric = Number(value);

  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error(`Invalid GitHub ${name}.`);
  }

  return numeric;
}

function stringFromUnknown(value: unknown, name: string) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Missing GitHub ${name}.`);
  }

  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
