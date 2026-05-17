import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequestArrow,
  ListOrdered,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";

import { regenerateReportFormAction } from "@/app/actions";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Wordmark } from "@/components/brand/wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ReportRecord, RiskLevel } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

type ReportViewProps = {
  record: ReportRecord;
  history?: ReportRecord[];
};

const riskVariant: Record<RiskLevel, "riskHigh" | "riskMed" | "riskLow"> = {
  high: "riskHigh",
  medium: "riskMed",
  low: "riskLow",
};

const riskDot: Record<RiskLevel, string> = {
  high: "bg-risk-high",
  medium: "bg-risk-med",
  low: "bg-risk-low",
};

const riskLabel: Record<RiskLevel, string> = {
  high: "high",
  medium: "medium",
  low: "low",
};

const decisionLabel: Record<string, string> = {
  approve: "approve",
  comment: "comment",
  request_changes: "request changes",
  review_carefully: "review carefully",
};

export function ReportView({ record, history = [] }: ReportViewProps) {
  const report = record.report;

  if (!report) {
    return <FailedReport record={record} />;
  }

  const context = record.context;
  const checks = [...context.checks.checkRuns, ...context.checks.statuses];
  const topFiles = report.rankedFiles.slice(0, 8);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <ReportTopBar record={record} />

      <main className="mx-auto grid w-full max-w-[92rem] gap-8 px-4 py-8 md:px-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start" aria-label="Report navigation">
          <div className="rounded-lg border border-border bg-subtle/35 p-4">
            <p className="font-mono text-2xs font-medium uppercase tracking-[0.1em] text-muted-foreground tabular">
              Review order
            </p>
            <ol className="mt-4 space-y-1.5">
              {topFiles.map((file) => (
                <li key={file.path}>
                  <a
                    href={`#file-${file.rank}`}
                    className="group flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors hover:bg-background/55 focus-visible:bg-background/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", riskDot[file.riskLevel])} aria-hidden />
                    <span className="w-5 shrink-0 font-mono text-2xs text-muted-foreground tabular">
                      {String(file.rank).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/90">
                      {file.path}
                    </span>
                    <span className="font-mono text-2xs uppercase text-muted-foreground tabular">
                      {file.reviewMode}
                    </span>
                  </a>
                </li>
              ))}
            </ol>

            <Separator className="my-5" />

            <p className="font-mono text-2xs font-medium uppercase tracking-[0.1em] text-muted-foreground tabular">
              Change groups
            </p>
            <ol className="mt-4 space-y-2">
              {report.changeGroups.slice(0, 8).map((group, index) => (
                <li key={group.title}>
                  <a
                    href={`#group-${index + 1}`}
                    className="block rounded-md border border-transparent p-2 transition-colors hover:border-border hover:bg-background/35 focus-visible:border-border focus-visible:bg-background/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm text-foreground/90">{group.title}</span>
                      <Badge variant={riskVariant[group.riskLevel]}>{riskLabel[group.riskLevel]}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-2xs text-muted-foreground tabular">
                      {group.files.length} files
                    </p>
                  </a>
                </li>
              ))}
            </ol>

            <Separator className="my-5" />

            <Button
              nativeButton={false}
              render={(
                <Link href={`/reports/${record.id}/workbench`}>
                  <GitPullRequestArrow className="size-3.5" aria-hidden />
                  Open review workbench
                </Link>
              )}
              className="mb-2 w-full"
            />

            <form action={regenerateReportFormAction}>
              <input type="hidden" name="owner" value={record.owner} />
              <input type="hidden" name="repo" value={record.repo} />
              <input type="hidden" name="number" value={record.number} />
              <Button type="submit" variant="outline" className="w-full">
                <RefreshCcw className="size-3.5" aria-hidden />
                Queue regeneration
              </Button>
            </form>

            {history.length > 0 ? (
              <>
                <Separator className="my-5" />
                <p className="font-mono text-2xs font-medium uppercase tracking-[0.1em] text-muted-foreground tabular">
                  Report history
                </p>
                <ol className="mt-4 space-y-2">
                  {history.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/${item.owner}/${item.repo}/pull/${item.number}?report=${item.id}`}
                        className="block rounded-md border border-border bg-background/25 p-2 text-xs hover:bg-background/45"
                      >
                        <span className="font-mono text-2xs uppercase text-muted-foreground tabular">
                          {shortSha(item.headSha)} · {formatDate(item.updatedAt)}
                        </span>
                        <span className="mt-1 block truncate text-foreground/90">
                          {item.report?.decision.recommendation.replace("_", " ") || item.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </div>
        </aside>

        <article className="min-w-0 rounded-xl border border-border bg-card shadow-[0_1px_0_oklch(0_0_0/0.35),0_28px_70px_-32px_oklch(0_0_0/0.65)]">
          <header className="rounded-t-xl border-b border-border bg-subtle/35 p-5 md:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="font-mono text-xs text-muted-foreground tabular">
                  <span className="text-foreground/80">{record.owner}/{record.repo}</span>
                  <span className="mx-2 text-border-strong">·</span>
                  <span>#{record.number}</span>
                  <span className="mx-2 text-border-strong">·</span>
                  <span>@{context.authorLogin}</span>
                </p>
                <h1 className="mt-2 max-w-[34ch] font-display text-2xl font-medium leading-tight text-foreground md:text-[2rem] md:leading-[1.1]">
                  {context.title}
                </h1>
              </div>

              <dl className="grid gap-2 sm:grid-cols-3 xl:min-w-[18rem]">
                <BriefStat label="files" value={String(context.stats.filesChanged)} />
                <BriefStat label="added" value={`+${context.stats.additions}`} tone="text-diff-add-foreground" />
                <BriefStat label="removed" value={`−${context.stats.deletions}`} tone="text-diff-del-foreground" />
              </dl>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge variant={decisionBadgeVariant(report.decision.recommendation)}>
                {decisionLabel[report.decision.recommendation] || report.decision.recommendation}
              </Badge>
              <Badge variant={report.generator.provider === "pi" ? "accent" : "outline"}>
                {report.generator.provider === "pi" ? report.generator.model : "heuristic"}
              </Badge>
              <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
                base {context.baseRef} · head {context.headRef} · {shortSha(record.headSha)}
              </span>
            </div>
          </header>

          <div className="divide-y divide-border">
            <section className="p-5 md:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div>
                  <p className="font-mono text-2xs font-medium uppercase tracking-[0.1em] text-primary tabular">
                    Likely decision
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {decisionLabel[report.decision.recommendation] || report.decision.recommendation}
                  </h2>
                  <p className="mt-3 max-w-[74ch] text-lg leading-relaxed text-foreground/90">
                    {report.decision.summary}
                  </p>
                </div>

                <div className="rounded-md border border-border bg-background/35 p-4">
                  <p className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground tabular">
                    Report cache
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Stored in Postgres for head <code>{shortSha(record.headSha)}</code>. Generated {formatDate(report.generatedAt)}.
                  </p>
                </div>
              </div>

              {report.decision.blockingIssues.length > 0 ? (
                <div className="mt-5 rounded-md border border-risk-high/30 bg-risk-high/10 p-4">
                  <p className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-risk-high tabular">
                    Blocking issues
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/90">
                    {report.decision.blockingIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <ReportSection
              id="summary"
              icon={<GitBranch className="size-4" aria-hidden />}
              title="Overview"
            >
              <div className="grid gap-5 lg:grid-cols-3">
                <TextBlock title="Intent" body={report.prSummary.intent} />
                <TextBlock title="Technical impact" body={report.prSummary.technicalImpact} />
                <TextBlock title="Business impact" body={report.prSummary.businessImpact} />
              </div>
              <ul className="mt-5 grid gap-2 md:grid-cols-2">
                {report.prSummary.reviewerFocus.map((focus) => (
                  <li key={focus} className="rounded-md border border-border bg-subtle/25 p-3 text-sm leading-relaxed text-muted-foreground">
                    {focus}
                  </li>
                ))}
              </ul>
            </ReportSection>

            <ReportSection
              id="risks"
              icon={<ShieldAlert className="size-4" aria-hidden />}
              title="Risk areas"
            >
              {report.riskAreas.length > 0 ? (
                <ol className="space-y-3">
                  {report.riskAreas.map((area) => (
                    <li key={area.title} className="rounded-md border border-border bg-subtle/25 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={riskVariant[area.level]}>{riskLabel[area.level]}</Badge>
                            <h3 className="text-base font-medium text-foreground">{area.title}</h3>
                          </div>
                          <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
                            {area.reason}
                          </p>
                        </div>
                        <span className="font-mono text-2xs text-muted-foreground tabular">
                          {area.files.length} files
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyLine>No medium or high risk areas detected.</EmptyLine>
              )}
            </ReportSection>

            <ReportSection
              id="groups"
              icon={<ListOrdered className="size-4" aria-hidden />}
              title="Change groups"
            >
              <ol className="space-y-4">
                {report.changeGroups.map((group, index) => (
                  <li
                    id={`group-${index + 1}`}
                    key={group.title}
                    className="scroll-mt-24 rounded-md border border-border bg-subtle/25 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex size-8 items-center justify-center rounded-md border border-primary/25 bg-primary/10 font-mono text-2xs font-medium text-primary tabular">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3 className="text-base font-medium text-foreground">{group.title}</h3>
                          <Badge variant={riskVariant[group.riskLevel]}>{riskLabel[group.riskLevel]}</Badge>
                        </div>
                        <p className="mt-2 max-w-[76ch] text-sm leading-relaxed text-muted-foreground">
                          {group.summary}
                        </p>
                      </div>
                      <span className="font-mono text-2xs text-muted-foreground tabular">
                        {group.files.length} files
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                      {group.reviewNotes.map((note) => (
                        <li key={note} className="flex gap-2">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                    <FilePills files={group.files} />
                  </li>
                ))}
              </ol>
            </ReportSection>

            <ReportSection
              id="files"
              icon={<FileCode2 className="size-4" aria-hidden />}
              title="Ranked files"
            >
              <ol className="grid gap-3 xl:grid-cols-2">
                {report.rankedFiles.map((file) => {
                  const contextFile = context.files.find((item) => item.path === file.path);
                  return (
                    <li
                      id={`file-${file.rank}`}
                      key={file.path}
                      className="scroll-mt-24 rounded-md border border-border bg-subtle/25 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/45 font-mono text-2xs font-medium text-foreground tabular">
                          {String(file.rank).padStart(2, "0")}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={riskVariant[file.riskLevel]}>{riskLabel[file.riskLevel]}</Badge>
                          <span className="rounded-sm border border-border bg-background/45 px-1.5 py-0.5 font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
                            {file.reviewMode}
                          </span>
                        </div>
                      </div>
                      <code className="mt-3 block break-all font-mono text-xs text-foreground">{file.path}</code>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{file.summary}</p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground/90">{file.reason}</p>
                      {contextFile ? (
                        <p className="mt-3 font-mono text-2xs text-muted-foreground tabular">
                          <span className="text-diff-add-foreground">+{contextFile.additions}</span>
                          <span className="mx-1 text-border-strong">/</span>
                          <span className="text-diff-del-foreground">−{contextFile.deletions}</span>
                          <span className="mx-2 text-border-strong">·</span>
                          {contextFile.status}
                          <Link href={contextFile.blobUrl} className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                            GitHub <ArrowUpRight className="size-3" aria-hidden />
                          </Link>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </ReportSection>

            <ReportSection
              id="verification"
              icon={<CheckCircle2 className="size-4" aria-hidden />}
              title="Tests and verification"
            >
              <div className="grid gap-5 lg:grid-cols-3">
                <ListBlock title="Suggested commands" items={report.verification.suggestedCommands} empty="No commands suggested." />
                <ListBlock title="Manual checks" items={report.verification.manualChecks} empty="No manual checks suggested." />
                <ListBlock title="Missing tests" items={report.verification.missingTests} empty="No missing test notes." />
              </div>
            </ReportSection>

            <ReportSection
              id="questions"
              icon={<Clock3 className="size-4" aria-hidden />}
              title="Open questions and raw metadata"
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <ListBlock title="Open questions" items={report.openQuestions} empty="No open questions generated." />
                <div className="rounded-md border border-border bg-subtle/25 p-4">
                  <p className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground tabular">
                    GitHub metadata
                  </p>
                  <dl className="mt-3 space-y-2 font-mono text-2xs text-muted-foreground tabular">
                    <MetaRow label="commits" value={String(context.stats.commits)} />
                    <MetaRow label="checks" value={String(checks.length)} />
                    <MetaRow label="state" value={context.state} />
                    <MetaRow label="draft" value={context.draft ? "yes" : "no"} />
                    <MetaRow label="fetched" value={formatDate(context.fetchedAt)} />
                  </dl>
                  <Link href={context.htmlUrl} className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Open PR on GitHub <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </ReportSection>
          </div>
        </article>
      </main>
    </div>
  );
}

function ReportTopBar({ record }: { record: ReportRecord }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-12 w-full max-w-[92rem] items-center gap-4 px-4 md:px-8">
        <Link href="/" className="flex items-center" aria-label="PullBrief, home">
          <Wordmark size="sm" />
        </Link>
        <span className="mx-2 hidden h-4 w-px bg-border sm:block" aria-hidden />
        <nav className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:flex tabular" aria-label="Pull request breadcrumb">
          <span className="text-foreground/80">{record.owner}</span>
          <span className="text-border-strong">/</span>
          <span className="text-foreground/80">{record.repo}</span>
          <span className="text-border-strong">·</span>
          <span>#{record.number}</span>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
            <GitCommitHorizontal className="size-3.5 text-primary" aria-hidden />
            {shortSha(record.headSha)}
          </div>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/settings/github">GitHub</Link>} />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

function FailedReport({ record }: { record: ReportRecord }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <ReportTopBar record={record} />
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <div className="rounded-xl border border-risk-high/30 bg-risk-high/10 p-6">
          <p className="font-mono text-2xs font-medium uppercase tracking-[0.1em] text-risk-high tabular">
            Report failed
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Unable to generate this report</h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">
            {record.errorMessage || "The report worker failed without a saved error message."}
          </p>
          <form action={regenerateReportFormAction} className="mt-5">
            <input type="hidden" name="owner" value={record.owner} />
            <input type="hidden" name="repo" value={record.repo} />
            <input type="hidden" name="number" value={record.number} />
            <Button type="submit">
              <RefreshCcw className="size-3.5" aria-hidden />
              Try again
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

function ReportSection({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 p-5 md:p-6">
      <div className="grid gap-5 md:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="flex items-center gap-2.5 md:block">
          <span className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background/45 text-muted-foreground">
            {icon}
          </span>
          <h2 className="font-mono text-2xs font-medium uppercase tracking-[0.1em] text-muted-foreground tabular md:mt-3">
            {title}
          </h2>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function TextBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-subtle/25 p-4">
      <h3 className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground tabular">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-md border border-border bg-subtle/25 p-4">
      <h3 className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground tabular">
        {title}
      </h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function FilePills({ files }: { files: string[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {files.slice(0, 12).map((file) => (
        <li key={file}>
          <code className="inline-flex rounded-sm border border-border bg-background/45 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground tabular">
            {file}
          </code>
        </li>
      ))}
      {files.length > 12 ? (
        <li>
          <span className="inline-flex rounded-sm border border-border bg-background/45 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground tabular">
            +{files.length - 12} more
          </span>
        </li>
      ) : null}
    </ul>
  );
}

function BriefStat({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <dt className="font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
        {label}
      </dt>
      <dd className={cn("mt-1 font-mono text-sm font-medium tabular", tone)}>{value}</dd>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-foreground/90">{value}</dd>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-border bg-subtle/25 p-4 text-sm text-muted-foreground">{children}</p>;
}

function decisionBadgeVariant(recommendation: string) {
  if (recommendation === "request_changes" || recommendation === "review_carefully") {
    return "riskHigh";
  }

  if (recommendation === "comment") {
    return "riskMed";
  }

  return "riskLow";
}

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
