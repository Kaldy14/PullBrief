import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  githubInstallations,
  githubWebhookDeliveries,
  pullRequests,
  repositories,
} from "@/db/schema";
import { isGitHubAccountAllowed } from "@/lib/github/app-config";
import {
  disableRemovedRepositories,
  markInstallationDeleted,
  markInstallationSuspended,
  syncGitHubInstallation,
} from "@/lib/github/installations";
import { enqueueReviewJob } from "@/lib/review-jobs/queue";

export type GitHubWebhookResult = {
  status: "accepted" | "ignored" | "failed";
  message: string;
  tenantId: string | null;
};

export async function handleGitHubWebhook(input: {
  deliveryId: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<GitHubWebhookResult> {
  const existing = await findDelivery(input.deliveryId);

  if (existing && existing.status !== "failed") {
    return {
      status: "ignored",
      message: "Duplicate webhook delivery ignored.",
      tenantId: existing.tenantId,
    };
  }

  try {
    const result = await processWebhook(input.event, input.payload, input.deliveryId);
    await recordDelivery({ ...input, ...result });
    return result;
  } catch (error) {
    const result: GitHubWebhookResult = {
      status: "failed",
      message: error instanceof Error ? error.message : "GitHub webhook handling failed.",
      tenantId: await tenantIdFromPayload(input.payload),
    };
    await recordDelivery({ ...input, ...result });
    return result;
  }
}

async function processWebhook(
  event: string,
  payload: Record<string, unknown>,
  deliveryId: string,
): Promise<GitHubWebhookResult> {
  const action = stringValue(payload.action);
  const githubInstallationId = installationIdFromPayload(payload);
  const tenantInstallation = githubInstallationId ? await findInstallation(githubInstallationId) : null;

  if (event === "installation" && action === "deleted" && githubInstallationId) {
    const installation = await markInstallationDeleted(githubInstallationId);
    return {
      status: installation ? "accepted" : "ignored",
      message: installation ? "Installation marked deleted." : "Deleted installation is not linked to a PullBrief tenant.",
      tenantId: installation?.tenantId || null,
    };
  }

  if (event === "installation" && (action === "suspend" || action === "unsuspend") && githubInstallationId) {
    const installation = await markInstallationSuspended({
      githubInstallationId,
      suspended: action === "suspend",
    });
    return {
      status: installation ? "accepted" : "ignored",
      message: installation ? `Installation ${action} processed.` : "Installation is not linked to a PullBrief tenant.",
      tenantId: installation?.tenantId || null,
    };
  }

  if (!tenantInstallation) {
    return {
      status: "ignored",
      message: "Webhook installation is not linked to a PullBrief tenant yet.",
      tenantId: null,
    };
  }

  if (!isGitHubAccountAllowed(tenantInstallation.accountLogin)) {
    return {
      status: "ignored",
      message: "Webhook installation account is no longer allowed for this PullBrief deployment.",
      tenantId: tenantInstallation.tenantId,
    };
  }

  if (event === "installation" || event === "installation_repositories") {
    await syncGitHubInstallation({
      tenantId: tenantInstallation.tenantId,
      githubInstallationId: tenantInstallation.githubInstallationId,
    });

    if (event === "installation_repositories") {
      await disableRemovedRepositories({
        githubInstallationId: tenantInstallation.githubInstallationId,
        githubRepositoryIds: repositoryIdsFromArray(payload.repositories_removed),
      });
    }

    return {
      status: "accepted",
      message: "Installation repositories synced.",
      tenantId: tenantInstallation.tenantId,
    };
  }

  if (event === "pull_request") {
    const pullRequest = await upsertPullRequestFromPayload({
      tenantId: tenantInstallation.tenantId,
      installationId: tenantInstallation.id,
      payload,
    });

    if (pullRequest.repositoryEnabled && shouldQueueReview(action)) {
      await enqueueReviewJob({
        tenantId: tenantInstallation.tenantId,
        repositoryId: pullRequest.repositoryId,
        pullRequestId: pullRequest.id,
        githubDeliveryId: deliveryId,
        trigger: "webhook",
        owner: pullRequest.owner,
        repo: pullRequest.repo,
        number: pullRequest.number,
        headSha: pullRequest.headSha,
      });
    }

    return {
      status: "accepted",
      message: pullRequest.repositoryEnabled && shouldQueueReview(action) ? "Pull request synced and review job queued." : "Pull request synced.",
      tenantId: tenantInstallation.tenantId,
    };
  }

  return {
    status: "ignored",
    message: `Webhook event ${event} ignored by current PullBrief handlers.`,
    tenantId: tenantInstallation.tenantId,
  };
}

async function findDelivery(deliveryId: string) {
  const [row] = await db
    .select()
    .from(githubWebhookDeliveries)
    .where(eq(githubWebhookDeliveries.githubDeliveryId, deliveryId))
    .limit(1);

  return row || null;
}

async function findInstallation(githubInstallationId: string) {
  const [row] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.githubInstallationId, githubInstallationId))
    .limit(1);

  return row || null;
}

async function recordDelivery(input: {
  deliveryId: string;
  event: string;
  payload: Record<string, unknown>;
  status: "accepted" | "ignored" | "failed";
  message: string;
  tenantId: string | null;
}) {
  await db.insert(githubWebhookDeliveries).values({
    id: randomUUID(),
    githubDeliveryId: input.deliveryId,
    event: input.event,
    action: stringValue(input.payload.action),
    githubInstallationId: installationIdFromPayload(input.payload),
    githubRepositoryId: repositoryIdFromPayload(input.payload),
    tenantId: input.tenantId,
    status: input.status,
    errorMessage: input.status === "failed" ? input.message : null,
    payloadJson: input.status === "accepted" ? input.payload : null,
  }).onConflictDoUpdate({
    target: githubWebhookDeliveries.githubDeliveryId,
    set: {
      event: input.event,
      action: stringValue(input.payload.action),
      githubInstallationId: installationIdFromPayload(input.payload),
      githubRepositoryId: repositoryIdFromPayload(input.payload),
      tenantId: input.tenantId,
      status: input.status,
      errorMessage: input.status === "failed" ? input.message : null,
      payloadJson: input.status === "accepted" ? input.payload : null,
      receivedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

async function upsertPullRequestFromPayload(input: {
  tenantId: string;
  installationId: string;
  payload: Record<string, unknown>;
}) {
  const repositoryPayload = requiredRecord(input.payload.repository, "repository");
  const ownerPayload = requiredRecord(repositoryPayload.owner, "repository owner");
  const pullRequestPayload = requiredRecord(input.payload.pull_request, "pull_request");
  const basePayload = requiredRecord(pullRequestPayload.base, "pull_request.base");
  const headPayload = requiredRecord(pullRequestPayload.head, "pull_request.head");
  const userPayload = requiredRecord(pullRequestPayload.user, "pull_request.user");
  const now = new Date();
  const owner = requiredString(ownerPayload.login, "repository.owner.login").toLowerCase();
  const repo = requiredString(repositoryPayload.name, "repository.name").toLowerCase();
  const githubRepositoryId = requiredId(repositoryPayload.id, "repository.id");
  const [existingRepository] = await db
    .select()
    .from(repositories)
    .where(and(
      eq(repositories.tenantId, input.tenantId),
      eq(repositories.owner, owner),
      eq(repositories.name, repo),
    ))
    .limit(1);
  const preserveEnabled = Boolean(
    existingRepository?.enabled
    && existingRepository.installationId === input.installationId
    && existingRepository.githubRepositoryId === githubRepositoryId,
  );

  const [repository] = await db
    .insert(repositories)
    .values({
      id: randomUUID(),
      tenantId: input.tenantId,
      installationId: input.installationId,
      owner,
      name: repo,
      fullName: stringValue(repositoryPayload.full_name)?.toLowerCase() || `${owner}/${repo}`,
      githubRepositoryId,
      githubNodeId: stringValue(repositoryPayload.node_id),
      defaultBranch: stringValue(repositoryPayload.default_branch),
      htmlUrl: stringValue(repositoryPayload.html_url),
      private: Boolean(repositoryPayload.private),
      fork: Boolean(repositoryPayload.fork),
      archived: Boolean(repositoryPayload.archived),
      enabled: false,
      settingsJson: {},
      lastSyncedAt: now,
    })
    .onConflictDoUpdate({
      target: [repositories.tenantId, repositories.owner, repositories.name],
      set: {
        installationId: input.installationId,
        fullName: stringValue(repositoryPayload.full_name)?.toLowerCase() || `${owner}/${repo}`,
        githubRepositoryId,
        githubNodeId: stringValue(repositoryPayload.node_id),
        defaultBranch: stringValue(repositoryPayload.default_branch),
        htmlUrl: stringValue(repositoryPayload.html_url),
        private: Boolean(repositoryPayload.private),
        fork: Boolean(repositoryPayload.fork),
        archived: Boolean(repositoryPayload.archived),
        enabled: preserveEnabled,
        lastSyncedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  const number = requiredNumber(pullRequestPayload.number, "pull_request.number");
  const headSha = requiredString(headPayload.sha, "pull_request.head.sha");

  const [pullRequest] = await db
    .insert(pullRequests)
    .values({
      id: randomUUID(),
      tenantId: input.tenantId,
      repositoryId: repository.id,
      number,
      title: requiredString(pullRequestPayload.title, "pull_request.title"),
      authorLogin: requiredString(userPayload.login, "pull_request.user.login"),
      baseRef: requiredString(basePayload.ref, "pull_request.base.ref"),
      headRef: requiredString(headPayload.ref, "pull_request.head.ref"),
      headSha,
      state: requiredString(pullRequestPayload.state, "pull_request.state"),
      htmlUrl: requiredString(pullRequestPayload.html_url, "pull_request.html_url"),
      githubCreatedAt: dateValue(pullRequestPayload.created_at),
      githubUpdatedAt: dateValue(pullRequestPayload.updated_at),
    })
    .onConflictDoUpdate({
      target: [pullRequests.repositoryId, pullRequests.number],
      set: {
        title: requiredString(pullRequestPayload.title, "pull_request.title"),
        authorLogin: requiredString(userPayload.login, "pull_request.user.login"),
        baseRef: requiredString(basePayload.ref, "pull_request.base.ref"),
        headRef: requiredString(headPayload.ref, "pull_request.head.ref"),
        headSha,
        state: requiredString(pullRequestPayload.state, "pull_request.state"),
        htmlUrl: requiredString(pullRequestPayload.html_url, "pull_request.html_url"),
        githubUpdatedAt: dateValue(pullRequestPayload.updated_at),
        updatedAt: now,
      },
    })
    .returning();

  return {
    id: pullRequest.id,
    repositoryId: repository.id,
    repositoryEnabled: repository.enabled,
    owner,
    repo,
    number,
    headSha,
  };
}

async function tenantIdFromPayload(payload: Record<string, unknown>) {
  const githubInstallationId = installationIdFromPayload(payload);
  if (!githubInstallationId) {
    return null;
  }

  const installation = await findInstallation(githubInstallationId);
  return installation?.tenantId || null;
}

function shouldQueueReview(action: string | null) {
  return action === "opened" || action === "reopened" || action === "synchronize" || action === "ready_for_review";
}

function installationIdFromPayload(payload: Record<string, unknown>) {
  const installation = isRecord(payload.installation) ? payload.installation : null;
  return installation ? stringValue(installation.id) : null;
}

function repositoryIdFromPayload(payload: Record<string, unknown>) {
  const repository = isRecord(payload.repository) ? payload.repository : null;
  return repository ? stringValue(repository.id) : null;
}

function repositoryIdsFromArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((repository) => stringValue(repository.id))
    .filter((id): id is string => Boolean(id));
}

function requiredRecord(value: unknown, name: string) {
  if (!isRecord(value)) {
    throw new Error(`Missing GitHub webhook ${name}.`);
  }

  return value;
}

function requiredString(value: unknown, name: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing GitHub webhook ${name}.`);
  }

  return value;
}

function requiredId(value: unknown, name: string) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Missing GitHub webhook ${name}.`);
  }

  return String(value);
}

function requiredNumber(value: unknown, name: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`Missing GitHub webhook ${name}.`);
  }

  return value;
}

function stringValue(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  return String(value);
}

function dateValue(value: unknown) {
  return typeof value === "string" ? new Date(value) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
