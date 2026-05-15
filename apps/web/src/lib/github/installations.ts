import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { githubInstallStates, githubInstallations, repositories } from "@/db/schema";
import type { UserAccess } from "@/lib/auth/guard";
import { buildGitHubAppInstallUrl, requireGitHubAccountAllowed } from "@/lib/github/app-config";
import {
  getInstallationInfo,
  listInstallationRepositories,
  type GitHubInstallationInfo,
  type GitHubInstallationRepository,
} from "@/lib/github/app-client";

const INSTALL_STATE_TTL_MS = 10 * 60 * 1000;

export type GitHubInstallationRecord = typeof githubInstallations.$inferSelect;
export type RepositoryRecord = typeof repositories.$inferSelect;

export class GitHubInstallationStateError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "GitHubInstallationStateError";
  }
}

export async function createGitHubInstallRedirect(access: UserAccess, returnPath = "/settings/github") {
  const state = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INSTALL_STATE_TTL_MS);

  await db.insert(githubInstallStates).values({
    id: randomUUID(),
    state,
    tenantId: access.tenantId,
    userId: access.userId,
    returnPath: safeReturnPath(returnPath),
    expiresAt,
  });

  return buildGitHubAppInstallUrl(state);
}

export async function validateGitHubInstallState(input: {
  state: string;
  access: UserAccess;
}) {
  const [row] = await db
    .select()
    .from(githubInstallStates)
    .where(eq(githubInstallStates.state, input.state))
    .limit(1);

  if (!row) {
    throw new GitHubInstallationStateError("GitHub installation state was not found.");
  }

  if (row.userId !== input.access.userId || row.tenantId !== input.access.tenantId) {
    throw new GitHubInstallationStateError("GitHub installation state does not belong to this session.");
  }

  if (row.consumedAt) {
    throw new GitHubInstallationStateError("GitHub installation state was already used.");
  }

  if (row.expiresAt.getTime() < Date.now()) {
    throw new GitHubInstallationStateError("GitHub installation state has expired.");
  }

  return row;
}

export async function prepareGitHubInstallUserVerification(input: {
  installStateId: string;
  installationId: string;
  setupAction: string | null;
}) {
  const oauthState = randomBytes(24).toString("base64url");
  const [row] = await db
    .update(githubInstallStates)
    .set({
      oauthState,
      githubInstallationId: input.installationId,
      setupAction: input.setupAction,
      updatedAt: new Date(),
    })
    .where(and(eq(githubInstallStates.id, input.installStateId), isNull(githubInstallStates.consumedAt)))
    .returning();

  if (!row) {
    throw new GitHubInstallationStateError("GitHub installation state was already used.");
  }

  return { installState: row, oauthState };
}

export async function validateGitHubOAuthInstallState(input: {
  oauthState: string;
  access: UserAccess;
}) {
  const [row] = await db
    .select()
    .from(githubInstallStates)
    .where(eq(githubInstallStates.oauthState, input.oauthState))
    .limit(1);

  if (!row) {
    throw new GitHubInstallationStateError("GitHub setup verification state was not found.");
  }

  if (row.userId !== input.access.userId || row.tenantId !== input.access.tenantId) {
    throw new GitHubInstallationStateError("GitHub setup verification state does not belong to this session.");
  }

  if (row.consumedAt) {
    throw new GitHubInstallationStateError("GitHub installation state was already used.");
  }

  if (!row.githubInstallationId) {
    throw new GitHubInstallationStateError("GitHub installation id is missing from setup verification state.");
  }

  if (row.expiresAt.getTime() < Date.now()) {
    throw new GitHubInstallationStateError("GitHub installation state has expired.");
  }

  return row;
}

export async function markGitHubInstallStateOAuthVerified(installStateId: string) {
  await db
    .update(githubInstallStates)
    .set({ oauthVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(githubInstallStates.id, installStateId));
}

export async function markGitHubInstallStateConsumed(input: {
  installStateId: string;
  installationId: string;
  setupAction: string | null;
}) {
  const [row] = await db
    .update(githubInstallStates)
    .set({
      consumedAt: new Date(),
      githubInstallationId: input.installationId,
      setupAction: input.setupAction,
      updatedAt: new Date(),
    })
    .where(and(eq(githubInstallStates.id, input.installStateId), isNull(githubInstallStates.consumedAt)))
    .returning();

  if (!row) {
    throw new GitHubInstallationStateError("GitHub installation state was already used.");
  }

  return row;
}

export async function syncGitHubInstallation(input: {
  tenantId: string;
  githubInstallationId: string;
}): Promise<{ installation: GitHubInstallationRecord; repositories: RepositoryRecord[] }> {
  const [info, installationRepositories] = await Promise.all([
    getInstallationInfo(input.githubInstallationId),
    listInstallationRepositories(input.githubInstallationId),
  ]);

  const installation = await upsertInstallation(input.tenantId, info);
  const syncedRepositories = await syncRepositories(input.tenantId, installation.id, installationRepositories);

  return { installation, repositories: syncedRepositories };
}

export async function listTenantGitHubInstallations(tenantId: string) {
  return db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.tenantId, tenantId))
    .orderBy(desc(githubInstallations.updatedAt));
}

export async function listTenantRepositories(tenantId: string) {
  return db
    .select()
    .from(repositories)
    .where(eq(repositories.tenantId, tenantId))
    .orderBy(repositories.owner, repositories.name);
}

export async function setRepositoryEnabled(input: {
  tenantId: string;
  repositoryId: string;
  enabled: boolean;
}) {
  const [row] = await db
    .update(repositories)
    .set({ enabled: input.enabled, updatedAt: new Date() })
    .where(and(eq(repositories.tenantId, input.tenantId), eq(repositories.id, input.repositoryId)))
    .returning();

  return row || null;
}

export async function markInstallationDeleted(githubInstallationId: string) {
  const [installation] = await db
    .update(githubInstallations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(githubInstallations.githubInstallationId, githubInstallationId))
    .returning();

  if (!installation) {
    return null;
  }

  await db
    .update(repositories)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(repositories.installationId, installation.id));

  return installation;
}

export async function markInstallationSuspended(input: {
  githubInstallationId: string;
  suspended: boolean;
}) {
  const [installation] = await db
    .update(githubInstallations)
    .set({ suspendedAt: input.suspended ? new Date() : null, updatedAt: new Date() })
    .where(eq(githubInstallations.githubInstallationId, input.githubInstallationId))
    .returning();

  return installation || null;
}

export async function disableRemovedRepositories(input: {
  githubInstallationId: string;
  githubRepositoryIds: string[];
}) {
  const [installation] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.githubInstallationId, input.githubInstallationId))
    .limit(1);

  if (!installation) {
    return 0;
  }

  let count = 0;
  for (const githubRepositoryId of input.githubRepositoryIds) {
    const rows = await db
      .update(repositories)
      .set({ enabled: false, updatedAt: new Date() })
      .where(and(
        eq(repositories.installationId, installation.id),
        eq(repositories.githubRepositoryId, githubRepositoryId),
      ))
      .returning({ id: repositories.id });
    count += rows.length;
  }

  return count;
}

async function upsertInstallation(tenantId: string, info: GitHubInstallationInfo) {
  assertInstallationAccountAllowed(info);
  const now = new Date();
  const [row] = await db
    .insert(githubInstallations)
    .values({
      id: randomUUID(),
      tenantId,
      githubInstallationId: info.githubInstallationId,
      githubAppId: info.githubAppId,
      accountLogin: info.accountLogin,
      accountType: info.accountType,
      targetId: info.targetId,
      targetType: info.targetType,
      repositorySelection: info.repositorySelection,
      permissionsJson: info.permissions,
      eventsJson: info.events,
      settingsJson: {},
      suspendedAt: info.suspendedAt ? new Date(info.suspendedAt) : null,
      deletedAt: null,
      lastSyncedAt: now,
    })
    .onConflictDoUpdate({
      target: githubInstallations.githubInstallationId,
      set: {
        githubAppId: info.githubAppId,
        accountLogin: info.accountLogin,
        accountType: info.accountType,
        targetId: info.targetId,
        targetType: info.targetType,
        repositorySelection: info.repositorySelection,
        permissionsJson: info.permissions,
        eventsJson: info.events,
        suspendedAt: info.suspendedAt ? new Date(info.suspendedAt) : null,
        deletedAt: null,
        lastSyncedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  if (row.tenantId !== tenantId) {
    throw new GitHubInstallationStateError("This GitHub App installation is already linked to another PullBrief tenant.");
  }

  return row;
}

async function syncRepositories(
  tenantId: string,
  installationId: string,
  installationRepositories: GitHubInstallationRepository[],
) {
  const now = new Date();
  const synced: RepositoryRecord[] = [];
  const installedRepositoryIds = new Set(installationRepositories.map((repository) => repository.githubRepositoryId));
  const existingRepositories = await db
    .select({ id: repositories.id, githubRepositoryId: repositories.githubRepositoryId })
    .from(repositories)
    .where(eq(repositories.installationId, installationId));

  for (const repository of existingRepositories) {
    if (!repository.githubRepositoryId || !installedRepositoryIds.has(repository.githubRepositoryId)) {
      await db
        .update(repositories)
        .set({ enabled: false, updatedAt: now })
        .where(eq(repositories.id, repository.id));
    }
  }

  for (const repository of installationRepositories) {
    const [existingRepository] = await db
      .select()
      .from(repositories)
      .where(and(
        eq(repositories.tenantId, tenantId),
        eq(repositories.owner, repository.owner),
        eq(repositories.name, repository.name),
      ))
      .limit(1);
    const preserveEnabled = Boolean(
      existingRepository?.enabled
      && existingRepository.installationId === installationId
      && existingRepository.githubRepositoryId === repository.githubRepositoryId,
    );

    const [row] = await db
      .insert(repositories)
      .values({
        id: randomUUID(),
        tenantId,
        installationId,
        owner: repository.owner,
        name: repository.name,
        fullName: repository.fullName,
        githubRepositoryId: repository.githubRepositoryId,
        githubNodeId: repository.githubNodeId,
        defaultBranch: repository.defaultBranch,
        htmlUrl: repository.htmlUrl,
        private: repository.private,
        fork: repository.fork,
        archived: repository.archived,
        enabled: false,
        settingsJson: {},
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: [repositories.tenantId, repositories.owner, repositories.name],
        set: {
          installationId,
          fullName: repository.fullName,
          githubRepositoryId: repository.githubRepositoryId,
          githubNodeId: repository.githubNodeId,
          defaultBranch: repository.defaultBranch,
          htmlUrl: repository.htmlUrl,
          private: repository.private,
          fork: repository.fork,
          archived: repository.archived,
          enabled: preserveEnabled,
          lastSyncedAt: now,
          updatedAt: now,
        },
      })
      .returning();

    synced.push(row);
  }

  return synced;
}

function assertInstallationAccountAllowed(info: GitHubInstallationInfo) {
  try {
    requireGitHubAccountAllowed(info.accountLogin);
  } catch (error) {
    throw new GitHubInstallationStateError(error instanceof Error ? error.message : "GitHub installation account is not allowed.");
  }
}

function safeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/settings/github";
  }

  return value;
}
