import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ReviewWorkbench } from "@/components/review-workbench/review-workbench";
import { requirePageAccess } from "@/lib/auth/guard";
import { buildPullBriefRoute } from "@/lib/github/pr-url";
import { listReportWritebacksForTenant } from "@/lib/github/writeback";
import { getReviewDraftForUser } from "@/lib/review-drafts/service";
import { buildReviewWorkbenchData } from "@/lib/review-workbench/data";
import { getReportRecord } from "@/lib/storage/report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewWorkbenchPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ReviewWorkbenchPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Review workbench ${id.slice(0, 7)} · PullBrief` };
}

export default async function ReviewWorkbenchPage({ params }: ReviewWorkbenchPageProps) {
  const { id } = await params;
  const access = await requirePageAccess(`/reports/${id}/workbench`);
  const record = await getReportRecord(id, access.tenantId);

  if (!record) {
    notFound();
  }

  if (!record.report) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-risk-high tabular">Report failed</p>
        <h1 className="mt-3 font-display text-3xl font-medium text-foreground">Workbench unavailable</h1>
        <p className="mt-3 text-muted-foreground">PullBrief can only open the review workbench for a ready report.</p>
        <Button className="mt-6 w-fit" nativeButton={false} render={<Link href="/reviews">Back to reviews</Link>} />
      </main>
    );
  }

  const [draft, workbenchData, writebacks] = await Promise.all([
    getReviewDraftForUser({ reportId: id, tenantId: access.tenantId, userId: access.userId }),
    buildReviewWorkbenchData(record),
    listReportWritebacksForTenant({ reportId: id, tenantId: access.tenantId }),
  ]);

  return (
    <ReviewWorkbench
      record={{
        id: record.id,
        owner: record.owner,
        repo: record.repo,
        number: record.number,
        headSha: record.headSha,
        reportUrl: buildPullBriefRoute(record),
        githubUrl: record.context.htmlUrl,
        title: record.context.title,
        authorLogin: record.context.authorLogin,
        baseRef: record.context.baseRef,
        headRef: record.context.headRef,
        recommendation: record.report.decision.recommendation,
        summary: record.report.decision.summary,
        blockingIssues: record.report.decision.blockingIssues,
        rankedFiles: record.report.rankedFiles,
        openQuestions: record.report.openQuestions,
      }}
      files={workbenchData.files}
      patchWarning={workbenchData.warning}
      initialDraft={draft}
      initialWritebacks={writebacks}
      canSubmit={access.role !== "viewer"}
    />
  );
}
