import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ExternalLink, GitBranch, Lock, Settings2, ShieldAlert } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Wordmark } from "@/components/brand/wordmark";
import { RepositoryToggleButton } from "@/components/github/repository-toggle-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { requirePageAdminAccess } from "@/lib/auth/guard";
import { isGitHubAppInstallConfigured } from "@/lib/github/app-config";
import { listTenantGitHubInstallations, listTenantRepositories } from "@/lib/github/installations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "GitHub App settings",
};

type GitHubSettingsPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    github?: string | string[];
    repos?: string | string[];
  }>;
};

export default async function GitHubSettingsPage({ searchParams }: GitHubSettingsPageProps) {
  const access = await requirePageAdminAccess("/settings/github");
  const params = await searchParams;
  const error = firstParam(params.error);
  const success = firstParam(params.github) === "installed";
  const repoCount = firstParam(params.repos);
  const configured = isGitHubAppInstallConfigured();
  const [installations, repositories] = await Promise.all([
    listTenantGitHubInstallations(access.tenantId),
    listTenantRepositories(access.tenantId),
  ]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-4 px-6">
          <Link href="/" aria-label="PullBrief, home">
            <Wordmark size="sm" />
          </Link>
          <span className="mx-2 hidden h-4 w-px bg-border sm:block" aria-hidden />
          <nav className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:flex tabular" aria-label="Settings breadcrumb">
            <span>settings</span>
            <span className="text-border-strong">/</span>
            <span className="text-foreground/80">github app</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/review">Review PR</Link>} />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section>
            <p className="inline-flex items-center gap-2 font-mono text-2xs font-medium uppercase tracking-[0.12em] text-primary tabular">
              <GitBranch className="size-3.5" aria-hidden />
              GitHub App foundation
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-foreground">
              Connect PullBrief to tenant-owned repositories.
            </h1>
            <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              PullBrief uses GitHub App installation tokens for private repository reads, repository allowlists, webhook ingestion, and future check/comment writeback.
            </p>

            {error ? (
              <div className="mt-6 rounded-xl border border-risk-high/35 bg-risk-high/10 p-4 text-sm text-risk-high" role="alert">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mt-6 rounded-xl border border-risk-low/35 bg-risk-low/10 p-4 text-sm text-risk-low" role="status">
                GitHub App installation synced{repoCount ? ` with ${repoCount} repositories` : ""}.
              </div>
            ) : null}

            <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_0_oklch(0_0_0/0.35),0_28px_70px_-32px_oklch(0_0_0/0.65)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-medium text-foreground">Installations</h2>
                  <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
                    Install the GitHub App on selected repositories. PullBrief stores installation metadata and syncs the repository allowlist into Postgres.
                  </p>
                </div>
                <Button
                  nativeButton={false}
                  disabled={!configured}
                  render={
                    <Link href="/api/github/install/start?returnTo=/settings/github">
                      <GitBranch className="size-4" aria-hidden />
                      Install GitHub App
                    </Link>
                  }
                />
              </div>

              {!configured ? (
                <div className="mt-5 rounded-lg border border-risk-med/35 bg-risk-med/10 p-4 text-sm text-risk-med">
                  Set <code>GITHUB_APP_ID</code>, <code>GITHUB_APP_SLUG</code>, <code>GITHUB_APP_PRIVATE_KEY</code>, <code>GITHUB_WEBHOOK_SECRET</code>, <code>GITHUB_APP_CLIENT_ID</code>, <code>GITHUB_APP_CLIENT_SECRET</code>, and <code>PULLBRIEF_ALLOWED_GITHUB_ACCOUNTS</code> before installing in production.
                </div>
              ) : null}

              <div className="mt-6 grid gap-3">
                {installations.length === 0 ? (
                  <EmptyState title="No GitHub App installation linked yet" description="Install the app from this tenant to enable private PR reviews without a PAT." />
                ) : installations.map((installation) => (
                  <div key={installation.id} className="rounded-xl border border-border bg-background/35 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <strong className="text-sm text-foreground">{installation.accountLogin}</strong>
                      <Badge variant={installation.deletedAt ? "riskHigh" : installation.suspendedAt ? "riskMed" : "riskLow"}>
                        {installation.deletedAt ? "deleted" : installation.suspendedAt ? "suspended" : "active"}
                      </Badge>
                      <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
                        installation {installation.githubInstallationId}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {installation.repositorySelection} repositories · last synced {installation.lastSyncedAt ? formatDate(installation.lastSyncedAt) : "never"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-medium text-foreground">Repository allowlist</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Report generation is allowed only for enabled repositories in this tenant.
                  </p>
                </div>
                <Badge variant="outline">{repositories.filter((repo) => repo.enabled && repo.installationId).length} app-enabled</Badge>
              </div>

              <div className="mt-6 overflow-hidden rounded-xl border border-border">
                {repositories.length === 0 ? (
                  <div className="p-5">
                    <EmptyState title="No repositories synced" description="Install or update the GitHub App with repository access." />
                  </div>
                ) : repositories.map((repository) => (
                  <div key={repository.id} className="flex flex-col gap-3 border-b border-border p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-foreground">{repository.owner}/{repository.name}</span>
                        {repository.private ? <Badge variant="outline">private</Badge> : <Badge variant="outline">public</Badge>}
                        {repository.archived ? <Badge variant="riskMed">archived</Badge> : null}
                        <Badge variant={repository.enabled ? "riskLow" : "outline"}>{repository.enabled ? "enabled" : "disabled"}</Badge>
                        {!repository.installationId ? <Badge variant="riskMed">fallback</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        default {repository.defaultBranch || "unknown"} · GitHub id {repository.githubRepositoryId || "unknown"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {repository.htmlUrl ? (
                        <Button variant="ghost" size="sm" nativeButton={false} render={<a href={repository.htmlUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" aria-hidden />GitHub</a>} />
                      ) : null}
                      {repository.installationId ? (
                        <RepositoryToggleButton repositoryId={repository.id} enabled={repository.enabled} />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Settings2 className="size-4 text-primary" aria-hidden />
                Required GitHub App settings
              </div>
              <Separator className="my-4" />
              <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-risk-low" aria-hidden />Setup URL: <code>/api/github/setup</code></li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-risk-low" aria-hidden />Webhook URL: <code>/api/github/webhooks</code></li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-risk-low" aria-hidden />Callback URL: <code>/api/github/oauth/callback</code></li>
                <li className="flex gap-2"><Lock className="mt-0.5 size-4 text-primary" aria-hidden />Allowlist GitHub org/user accounts before linking.</li>
                <li className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 text-risk-med" aria-hidden />Never expose reports for repos outside this allowlist.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-medium text-foreground">Permissions roadmap</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Minimum read mode: Metadata, Contents, Pull requests, Checks, Commit statuses. Writeback mode adds Checks write, Issues write, and Pull requests write.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/35 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
