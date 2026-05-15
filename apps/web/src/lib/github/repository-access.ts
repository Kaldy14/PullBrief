import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { githubInstallations, repositories } from "@/db/schema";
import { ForbiddenError } from "@/lib/auth/guard";
import { allowGitHubFallbackFetch, gitHubAppRequiredForReports, isGitHubAppConfigured, requireGitHubAccountAllowed } from "@/lib/github/app-config";
import { getInstallationToken } from "@/lib/github/app-client";
import type { GitHubPullRequestRef } from "@/lib/github/pr-url";

export type PullRequestRepositoryAuth =
  | {
    mode: "installation";
    token: string;
    repository: typeof repositories.$inferSelect;
    installation: typeof githubInstallations.$inferSelect;
  }
  | {
    mode: "fallback";
    token: string | null;
    repository: null;
    installation: null;
  };

export async function resolvePullRequestRepositoryAuth(
  tenantId: string,
  ref: GitHubPullRequestRef,
): Promise<PullRequestRepositoryAuth> {
  const linked = await findEnabledInstalledRepository(tenantId, ref);

  if (linked) {
    requireGitHubAccountAllowed(linked.installation.accountLogin);

    if (!linked.repository.githubRepositoryId) {
      throw new ForbiddenError(`${ref.owner}/${ref.repo} is missing a GitHub repository id; resync the GitHub App installation.`);
    }

    const installationToken = await getInstallationToken(
      linked.installation.githubInstallationId,
      linked.repository.githubRepositoryId,
    );

    return {
      mode: "installation",
      token: installationToken.token,
      repository: linked.repository,
      installation: linked.installation,
    };
  }

  if (allowGitHubFallbackFetch()) {
    return {
      mode: "fallback",
      token: process.env.PULLBRIEF_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || null,
      repository: null,
      installation: null,
    };
  }

  const configuredMessage = isGitHubAppConfigured()
    ? "Install the GitHub App for this tenant and enable the repository before generating a report."
    : "Configure the GitHub App before generating reports for private repositories.";

  throw new ForbiddenError(`${ref.owner}/${ref.repo} is not enabled for PullBrief. ${configuredMessage}`);
}

export function reportRequiresGitHubApp() {
  return gitHubAppRequiredForReports();
}

async function findEnabledInstalledRepository(tenantId: string, ref: GitHubPullRequestRef) {
  const [row] = await db
    .select({
      repository: repositories,
      installation: githubInstallations,
    })
    .from(repositories)
    .innerJoin(githubInstallations, eq(repositories.installationId, githubInstallations.id))
    .where(and(
      eq(repositories.tenantId, tenantId),
      eq(repositories.owner, ref.owner.toLowerCase()),
      eq(repositories.name, ref.repo.toLowerCase()),
      eq(repositories.enabled, true),
      isNull(githubInstallations.deletedAt),
      isNull(githubInstallations.suspendedAt),
    ))
    .limit(1);

  return row || null;
}
