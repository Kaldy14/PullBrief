import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock3, GitPullRequestArrow } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Wordmark } from "@/components/brand/wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePageAccess } from "@/lib/auth/guard";
import { listReviewJobsForTenant } from "@/lib/review-jobs/queue";
import { buildReviewJobRoute } from "@/lib/review-jobs/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review jobs",
};

export default async function ReviewsPage() {
  const access = await requirePageAccess("/reviews");
  const jobs = await listReviewJobsForTenant(access.tenantId, 50);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center gap-4 px-6">
          <Link href="/" aria-label="PullBrief, home">
            <Wordmark size="sm" />
          </Link>
          <span className="mx-2 hidden h-4 w-px bg-border sm:block" aria-hidden />
          <nav className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:flex tabular" aria-label="Review jobs breadcrumb">
            <span className="text-foreground/80">review jobs</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/settings/github">GitHub</Link>} />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <Link href="/review" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Back to review
        </Link>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 font-mono text-2xs font-medium uppercase tracking-[0.12em] text-primary tabular">
              <Clock3 className="size-3.5" aria-hidden />
              Durable queue
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-foreground">Review jobs</h1>
            <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              Manual and webhook-triggered PR reviews are queued in Postgres and processed by the PullBrief worker.
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/review">Queue review</Link>} />
        </div>

        <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_oklch(0_0_0/0.35),0_28px_70px_-32px_oklch(0_0_0/0.65)]">
          {jobs.length === 0 ? (
            <div className="p-8">
              <p className="text-sm font-medium text-foreground">No review jobs yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">Queue a PR review or install the GitHub App to receive PR webhooks.</p>
            </div>
          ) : jobs.map((job) => (
            <Link
              key={job.id}
              href={job.reportUrl || buildReviewJobRoute(job)}
              className="flex flex-col gap-3 border-b border-border p-4 transition-colors last:border-b-0 hover:bg-subtle/35 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <GitPullRequestArrow className="size-4 text-primary" aria-hidden />
                  <span className="font-mono text-sm text-foreground">{job.owner}/{job.repo}#{job.number}</span>
                  <Badge variant={job.status === "failed" ? "riskHigh" : job.status === "ready" ? "riskLow" : "accent"}>{job.status}</Badge>
                  <Badge variant="outline">{job.trigger}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  updated {formatDate(job.updatedAt)} · attempts {job.attempts}/{job.maxAttempts}
                </p>
              </div>
              <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
                {job.reportUrl ? "open report" : "open job"}
              </span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
