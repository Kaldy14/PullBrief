import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitPullRequestArrow } from "lucide-react";

import { generateReportFormAction } from "@/app/actions";
import { Wordmark } from "@/components/brand/wordmark";
import { ReportView } from "@/components/reports/report-view";
import { Button } from "@/components/ui/button";
import { requirePageAccess } from "@/lib/auth/guard";
import { parsePositivePullNumber, buildGitHubPullRequestUrl } from "@/lib/github/pr-url";
import { findLatestReport, getReportRecord, listReportsForPullRequest } from "@/lib/storage/report-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PullRequestPageProps = {
  params: Promise<{
    owner: string;
    repo: string;
    number: string;
  }>;
  searchParams?: Promise<{
    report?: string | string[];
  }>;
};

export async function generateMetadata({ params }: PullRequestPageProps): Promise<Metadata> {
  const { owner, repo, number } = await params;
  return {
    title: `${owner}/${repo}#${number}`,
  };
}

export default async function PullRequestReportPage({ params, searchParams }: PullRequestPageProps) {
  const ref = await readParams(params);
  const selectedReportId = firstParam((await searchParams)?.report);
  const access = await requirePageAccess(
    selectedReportId
      ? `/${ref.owner}/${ref.repo}/pull/${ref.number}?report=${encodeURIComponent(selectedReportId)}`
      : `/${ref.owner}/${ref.repo}/pull/${ref.number}`,
  );
  const selectedRecord = selectedReportId ? await getReportRecord(selectedReportId, access.tenantId) : null;
  const record = selectedRecord && matchesRef(selectedRecord, ref)
    ? selectedRecord
    : await findLatestReport({ ...ref, tenantId: access.tenantId });

  if (!record) {
    return <NoReportYet owner={ref.owner} repo={ref.repo} number={ref.number} />;
  }

  const history = await listReportsForPullRequest({ ...ref, tenantId: access.tenantId, limit: 8 });

  return <ReportView record={record} history={history} />;
}

async function readParams(params: PullRequestPageProps["params"]) {
  const raw = await params;

  try {
    return {
      owner: decodeURIComponent(raw.owner),
      repo: decodeURIComponent(raw.repo),
      number: parsePositivePullNumber(raw.number),
    };
  } catch {
    notFound();
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function matchesRef(
  record: { owner: string; repo: string; number: number },
  ref: { owner: string; repo: string; number: number },
) {
  return record.owner.toLowerCase() === ref.owner.toLowerCase()
    && record.repo.toLowerCase() === ref.repo.toLowerCase()
    && record.number === ref.number;
}

function NoReportYet({ owner, repo, number }: { owner: string; repo: string; number: number }) {
  const prUrl = buildGitHubPullRequestUrl({ owner, repo, number });

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
        <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-[0_1px_0_oklch(0_0_0/0.35),0_28px_70px_-32px_oklch(0_0_0/0.65)]">
          <p className="inline-flex items-center gap-2 font-mono text-2xs font-medium uppercase tracking-[0.1em] text-muted-foreground tabular">
            <GitPullRequestArrow className="size-3.5 text-primary" aria-hidden />
            No report yet
          </p>
          <h1 className="mt-3 font-display text-3xl font-medium leading-tight text-foreground">
            Generate a brief for {owner}/{repo}#{number}.
          </h1>
          <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            PullBrief generates reports on demand and stores them in Postgres for your tenant. The first run fetches PR metadata, files, commits, and checks from GitHub.
          </p>
          <form action={generateReportFormAction} className="mt-6">
            <input type="hidden" name="prUrl" value={prUrl} />
            <Button type="submit" size="lg">
              Generate brief
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
