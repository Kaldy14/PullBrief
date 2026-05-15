import type { Metadata } from "next";
import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, GitPullRequestArrow } from "lucide-react";

import { generateReportFormAction } from "@/app/actions";
import { Wordmark } from "@/components/brand/wordmark";
import { PullRequestUrlForm } from "@/components/reports/pr-url-form";
import { Button } from "@/components/ui/button";
import { requirePageAccess } from "@/lib/auth/guard";
import { buildPullBriefRoute, parseGitHubPullRequestUrl, type GitHubPullRequestRef } from "@/lib/github/pr-url";
import { findLatestReport } from "@/lib/storage/report-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Open a pull request",
};

type ReviewPageProps = {
  searchParams: Promise<{
    pr?: string | string[];
  }>;
};

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const prParam = Array.isArray(params.pr) ? params.pr[0] : params.pr;
  const access = await requirePageAccess(prParam ? `/review?pr=${encodeURIComponent(prParam)}` : "/review");

  if (!prParam) {
    return <ReviewShell><PullRequestUrlForm /></ReviewShell>;
  }

  const parsed = parsePrParam(prParam);

  if (parsed.ref === null) {
    return (
      <ReviewShell>
        <PullRequestUrlForm
          defaultValue={prParam}
          label="Paste a valid GitHub pull request URL"
        />
        <p className="mt-3 text-sm leading-relaxed text-risk-high" role="alert">
          {parsed.error}
        </p>
      </ReviewShell>
    );
  }

  const { ref } = parsed;
  const existing = await findLatestReport({ ...ref, tenantId: access.tenantId });

  if (existing?.status === "ready") {
    redirect(buildPullBriefRoute(existing));
  }

  return (
    <ReviewShell>
      <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_0_oklch(0_0_0/0.35),0_28px_70px_-32px_oklch(0_0_0/0.65)]">
        <p className="inline-flex items-center gap-2 font-mono text-2xs font-medium uppercase tracking-[0.1em] text-muted-foreground tabular">
          <GitPullRequestArrow className="size-3.5 text-primary" aria-hidden />
          GitHub PR detected
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium leading-tight text-foreground">
          Generate a brief for {ref.owner}/{ref.repo}#{ref.number}.
        </h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          PullBrief will fetch the PR from GitHub, generate a structured report, cache it by head SHA, and open the report page.
        </p>
        <form action={generateReportFormAction} className="mt-6">
          <input type="hidden" name="prUrl" value={prParam} />
          <Button type="submit" size="lg">
            Generate brief
          </Button>
        </form>
      </div>
    </ReviewShell>
  );
}

function parsePrParam(prParam: string): { ref: GitHubPullRequestRef; error: null } | { ref: null; error: string } {
  try {
    return { ref: parseGitHubPullRequestUrl(prParam), error: null };
  } catch (error) {
    return {
      ref: null,
      error: error instanceof Error ? error.message : "The PR URL is not valid.",
    };
  }
}

function ReviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-background/85">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center px-6">
          <Link href="/" aria-label="PullBrief, home">
            <Wordmark size="sm" />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Back to PullBrief
        </Link>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
