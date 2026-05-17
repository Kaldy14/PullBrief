import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, GitPullRequestArrow } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Wordmark } from "@/components/brand/wordmark";
import { JobStatusPoller } from "@/components/review-jobs/job-status-poller";
import { RetryReviewJobButton } from "@/components/review-jobs/retry-review-job-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePageAccess } from "@/lib/auth/guard";
import { friendlyReviewJobError } from "@/lib/review-jobs/errors";
import { getReviewJobForTenant } from "@/lib/review-jobs/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review job",
};

type JobPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReviewJobPage({ params }: JobPageProps) {
  const { id } = await params;
  const access = await requirePageAccess(`/jobs/${id}`);
  const job = await getReviewJobForTenant(id, access.tenantId);

  if (!job) {
    notFound();
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center gap-4 px-6">
          <Link href="/" aria-label="PullBrief, home">
            <Wordmark size="sm" />
          </Link>
          <span className="mx-2 hidden h-4 w-px bg-border sm:block" aria-hidden />
          <nav className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:flex tabular" aria-label="Review job breadcrumb">
            <span>jobs</span>
            <span className="text-border-strong">/</span>
            <span className="text-foreground/80">{shortId(job.id)}</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/reviews">Jobs</Link>} />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <Link href="/review" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Back to PullBrief
        </Link>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_0_oklch(0_0_0/0.35),0_28px_70px_-32px_oklch(0_0_0/0.65)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={job.status === "failed" ? "riskHigh" : job.status === "ready" ? "riskLow" : "accent"}>
              {job.status}
            </Badge>
            <Badge variant="outline">{job.trigger}</Badge>
            <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
              {shortId(job.id)}
            </span>
          </div>

          <p className="mt-5 inline-flex items-center gap-2 font-mono text-2xs font-medium uppercase tracking-[0.12em] text-primary tabular">
            <GitPullRequestArrow className="size-3.5" aria-hidden />
            Review job
          </p>
          <h1 className="mt-3 font-display text-3xl font-medium leading-tight text-foreground">
            {job.owner}/{job.repo}#{job.number}
          </h1>
          <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            PullBrief queued this job durably in Postgres. A separate worker claims queued jobs with PostgreSQL row locks, generates the AI review, and updates this page when the report is ready.
          </p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <JobStat label="attempts" value={`${job.attempts}/${job.maxAttempts}`} />
            <JobStat label="run at" value={formatDate(job.runAt)} />
            <JobStat label="updated" value={formatDate(job.updatedAt)} />
          </dl>

          <JobTimeline status={job.status} />

          {job.status === "ready" && job.reportUrl ? (
            <div className="mt-6">
              <Button nativeButton={false} render={<Link href={job.reportUrl}>Open report</Link>} />
            </div>
          ) : job.status === "failed" || job.status === "cancelled" ? (
            <JobFailure jobId={job.id} errorMessage={job.errorMessage} />
          ) : (
            <JobStatusPoller jobId={job.id} initialStatus={job.status} />
          )}

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" aria-hidden />
            Run <code>pnpm --filter @pullbrief/web worker:reviews</code> to process jobs continuously.
          </div>
        </section>
      </main>
    </div>
  );
}

function JobTimeline({ status }: { status: "queued" | "running" | "ready" | "failed" | "cancelled" }) {
  const steps = [
    { key: "queued", label: "Queued" },
    { key: "running", label: "Generating" },
    { key: "ready", label: status === "failed" ? "Failed" : status === "cancelled" ? "Cancelled" : "Ready" },
  ] as const;
  const activeIndex = status === "queued" ? 0 : status === "running" ? 1 : 2;

  return (
    <ol className="mt-6 grid gap-2 sm:grid-cols-3" aria-label="Job progress">
      {steps.map((step, index) => (
        <li key={step.key} className="rounded-lg border border-border bg-background/35 p-3">
          <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
            Step {index + 1}
          </span>
          <p className={index <= activeIndex ? "mt-1 text-sm font-medium text-foreground" : "mt-1 text-sm text-muted-foreground"}>
            {step.label}
          </p>
        </li>
      ))}
    </ol>
  );
}

function JobFailure({ jobId, errorMessage }: { jobId: string; errorMessage: string | null }) {
  const friendlyError = friendlyReviewJobError(errorMessage);

  return (
    <div className="mt-6 rounded-lg border border-risk-high/35 bg-risk-high/10 p-4 text-sm text-risk-high" role="alert">
      <p className="font-medium">{friendlyError?.title || "Review job failed"}</p>
      <p className="mt-1 text-risk-high/90">{friendlyError?.detail || errorMessage || "The worker failed without a saved error message."}</p>
      {friendlyError?.action ? <p className="mt-2 text-risk-high/80">{friendlyError.action}</p> : null}
      <RetryReviewJobButton jobId={jobId} />
    </div>
  );
}

function JobStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/35 p-3">
      <dt className="font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
