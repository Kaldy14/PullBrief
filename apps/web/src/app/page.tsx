import Link from "next/link";
import {
  ArrowRight,
  GitPullRequestArrow,
  ListOrdered,
  Search,
  ShieldAlert,
} from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  type RankedFile,
  type RiskLevel,
  sampleBrief,
} from "@/lib/fixtures/sample-brief";
import { cn } from "@/lib/utils";

const riskVariant: Record<RiskLevel, "riskHigh" | "riskMed" | "riskLow"> = {
  high: "riskHigh",
  med: "riskMed",
  low: "riskLow",
};

const riskLabel: Record<RiskLevel, string> = {
  high: "high",
  med: "med",
  low: "low",
};

const riskDot: Record<RiskLevel, string> = {
  high: "bg-risk-high",
  med: "bg-risk-med",
  low: "bg-risk-low",
};

const typeScale = [
  { name: "text-4xl", className: "text-4xl font-semibold tracking-tight", sample: "Headline" },
  { name: "text-3xl", className: "text-3xl font-semibold tracking-tight", sample: "Page title" },
  { name: "text-2xl", className: "text-2xl font-semibold tracking-tight", sample: "Section title" },
  { name: "text-xl", className: "text-xl font-medium", sample: "Subsection" },
  { name: "text-lg", className: "text-lg", sample: "Lead paragraph" },
  { name: "text-base", className: "text-base", sample: "Body copy that reaches the line cap" },
  { name: "text-sm", className: "text-sm text-muted-foreground", sample: "Secondary body and table cells" },
  { name: "text-xs", className: "text-xs text-muted-foreground", sample: "Meta, breadcrumbs, captions" },
  { name: "text-2xs", className: "text-2xs uppercase tracking-[0.06em] text-muted-foreground", sample: "Microtype label" },
];

const swatches = [
  { token: "background", className: "bg-background", border: true },
  { token: "subtle", className: "bg-subtle" },
  { token: "muted", className: "bg-muted" },
  { token: "border-strong", className: "bg-border-strong" },
  { token: "foreground", className: "bg-foreground" },
  { token: "primary", className: "bg-primary" },
  { token: "risk-high", className: "bg-risk-high" },
  { token: "risk-med", className: "bg-risk-med" },
  { token: "risk-low", className: "bg-risk-low" },
  { token: "diff-add", className: "bg-diff-add" },
  { token: "diff-del", className: "bg-diff-del" },
  { token: "ring", className: "bg-ring" },
];

export default function FoundationPage() {
  const brief = sampleBrief;
  const ranked = brief.rankedFiles.slice(0, 8);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopBar />

      <main className="mx-auto w-full max-w-7xl px-6 md:px-10">
        <Hero />
        <BriefPreview ranked={ranked} />
        <FoundationSection />
        <VoiceSection />
        <SiteFooter />
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Top bar
   ────────────────────────────────────────────── */
function TopBar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-4 px-6 md:px-10">
        <Link href="/" className="flex items-center" aria-label="PullBrief, home">
          <Wordmark size="sm" />
        </Link>

        <span className="mx-2 hidden h-4 w-px bg-border sm:block" aria-hidden />

        <nav
          className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:flex tabular"
          aria-label="Sample pull request breadcrumb"
        >
          <span className="text-foreground/80">acme</span>
          <span className="text-border-strong">/</span>
          <span className="text-foreground/80">api</span>
          <span className="text-border-strong">·</span>
          <span>#1247</span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="group inline-flex h-8 items-center gap-2 rounded-md border border-border bg-subtle/60 px-2.5 text-xs text-muted-foreground hover:border-border-strong hover:text-foreground transition-colors"
            aria-label="Open command palette"
          >
            <Search className="size-3.5" aria-hidden />
            <span className="hidden md:inline">Search briefs</span>
            <span className="ml-2 flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>

          <span className="hidden h-5 w-px bg-border md:block" aria-hidden />

          <span className="hidden items-center gap-2 font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground md:inline-flex tabular">
            <span className="pb-status-dot inline-block size-1.5 rounded-full bg-primary" aria-hidden />
            self-hosted preview
          </span>
        </div>
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────
   Hero
   ────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="pt-20 pb-20 md:pt-32 md:pb-24" aria-labelledby="hero-heading">
      <div className="grid gap-12 md:grid-cols-[1fr_minmax(0,440px)]">
        <div>
          <p className="mb-7 inline-flex items-center gap-3 font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground tabular">
            <span className="h-px w-8 bg-primary/70" aria-hidden />
            <GitPullRequestArrow className="size-3.5 text-primary" aria-hidden />
            PullBrief, v0 foundation
          </p>

          <h1
            id="hero-heading"
            className="font-display text-[1.875rem] font-medium leading-[1.04] text-foreground [hyphens:manual] md:text-[3.75rem] md:leading-[0.98]"
          >
            <span className="whitespace-nowrap">Read a thirty-file</span>
            <br />
            <span className="whitespace-nowrap">pull request</span>
            <br />
            <span className="whitespace-nowrap text-primary">in sixty seconds.</span>
          </h1>

          <p className="mt-7 max-w-[60ch] text-lg leading-relaxed text-muted-foreground">
            PullBrief turns any GitHub pull request into a ranked, structured
            review brief. Intent in one paragraph, risk-first file order,
            logical change groups, verification notes. Senior reviewers
            shouldn{`'`}t have to rebuild the same context from raw diffs every
            time.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={
                <a href="#brief-preview">
                  View sample brief
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              }
            />
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/docs/INITIAL_PLAN.md">Read the plan</Link>}
            />
            <span className="ml-1 text-xs text-muted-foreground">
              open source. self-host today, hosted later.
            </span>
          </div>
        </div>

        <aside
          className="relative hidden self-center md:block"
          aria-label="At-a-glance brief summary"
        >
          <div className="relative overflow-hidden rounded-lg border border-border-strong/70 bg-card p-6 shadow-[0_1px_0_oklch(0_0_0/0.4),0_24px_60px_-24px_oklch(0_0_0/0.6)]">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/70 to-transparent"
              aria-hidden
            />

            <div className="flex items-center justify-between font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground tabular">
              <span>Brief, at a glance</span>
              <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 normal-case tracking-[0.04em] text-primary">
                abc123f
              </span>
            </div>

            <h2 className="mt-4 font-display text-lg font-medium leading-snug text-foreground">
              feat: drizzle migration runner with rollback gating
            </h2>
            <p className="mt-1.5 font-mono text-xs text-muted-foreground tabular">
              acme/api · #1247 · @dlee
            </p>

            <Separator className="my-5" />

            <ul className="space-y-3 text-sm">
              <SummaryRow
                level="high"
                label="Write boundary expanded across module lines"
              />
              <SummaryRow level="med" label="Two migrations ship without down()" />
              <SummaryRow level="low" label="Worker retry backoff dropped to 5s" />
            </ul>

            <Separator className="my-5" />

            <dl className="grid grid-cols-3 gap-3 font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
              <div>
                <dt>files</dt>
                <dd className="mt-1.5 font-display text-2xl font-medium normal-case tracking-tight text-foreground tabular">
                  18
                </dd>
              </div>
              <div>
                <dt className="text-diff-add-foreground">added</dt>
                <dd className="mt-1.5 font-display text-2xl font-medium normal-case tracking-tight text-diff-add-foreground tabular">
                  +642
                </dd>
              </div>
              <div>
                <dt className="text-diff-del-foreground">removed</dt>
                <dd className="mt-1.5 font-display text-2xl font-medium normal-case tracking-tight text-diff-del-foreground tabular">
                  −91
                </dd>
              </div>
            </dl>
          </div>

          <div
            className="pointer-events-none absolute -inset-x-8 -inset-y-8 -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_top_right,oklch(0.72_0.14_65/0.10),transparent_60%)]"
            aria-hidden
          />
        </aside>
      </div>
    </section>
  );
}

function SummaryRow({ level, label }: { level: RiskLevel; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "mt-1.5 inline-block size-1.5 shrink-0 rounded-full",
          riskDot[level],
        )}
        aria-hidden
      />
      <span className="leading-snug text-foreground/90">
        <span className="mr-2 font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
          {riskLabel[level]}
        </span>
        {label}
      </span>
    </li>
  );
}

/* ──────────────────────────────────────────────
   Brief preview
   ────────────────────────────────────────────── */
function BriefPreview({ ranked }: { ranked: RankedFile[] }) {
  const brief = sampleBrief;
  return (
    <section
      id="brief-preview"
      className="scroll-mt-20 border-t border-border pt-16 pb-16 md:pt-20 md:pb-20"
      aria-labelledby="brief-preview-heading"
    >
      <SectionHeader
        eyebrow="A working sample"
        heading="What a brief looks like."
        sub="Generated brief for acme/api · #1247. Real content, no lorem. Layout, density, and voice you'll see throughout the product."
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Left rail */}
        <aside className="lg:sticky lg:top-20 lg:self-start" aria-label="Brief navigation">
          <div className="space-y-1 font-mono text-xs text-muted-foreground tabular">
            <span className="text-foreground">{brief.owner}/{brief.repo}</span>
            <span className="text-border-strong"> · </span>
            <span>#{brief.number}</span>
          </div>
          <h3 className="mt-1.5 text-base font-medium leading-snug text-foreground">
            {brief.title}
          </h3>
          <p className="mt-2 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground tabular">
            <span>@{brief.author}</span>
            <span className="text-border-strong">·</span>
            <span>{brief.baseRef}</span>
            <span className="text-border-strong">←</span>
            <span>{brief.headRef}</span>
          </p>

          <Separator className="my-5" />

          <p className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Ranked files
          </p>
          <ol className="mt-3 space-y-0.5">
            {ranked.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors",
                    "hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    file.rank === 1 && "bg-subtle",
                  )}
                  aria-current={file.rank === 1 ? "true" : undefined}
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      riskDot[file.risk],
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "w-5 shrink-0 font-mono text-2xs tabular",
                      file.rank === 1
                        ? "font-medium text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {file.rank.toString().padStart(2, "0")}
                  </span>
                  <span className="flex-1 truncate font-mono text-xs text-foreground/90">
                    {file.path}
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground tabular">
                    +{file.added}
                  </span>
                </button>
              </li>
            ))}
            <li className="px-2 pt-1 font-mono text-2xs text-muted-foreground">
              + {brief.filesChanged - ranked.length} more
            </li>
          </ol>

          <Separator className="my-5" />

          <p className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Sections
          </p>
          <ol className="mt-3 space-y-1 text-sm">
            <RailNav label="Intent" active />
            <RailNav label="Risk areas" badge={brief.riskAreas.length} />
            <RailNav label="Change groups" badge={brief.changeGroups.length} />
            <RailNav label="Verification" />
            <RailNav label="Open questions" badge={brief.openQuestions.length} />
          </ol>
        </aside>

        {/* Main column */}
        <article className="max-w-[68ch]">
          <h2
            id="brief-preview-heading"
            className="font-display text-2xl font-medium leading-tight text-foreground md:text-[2rem] md:leading-[1.1]"
          >
            {brief.title}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground tabular">
            <span className="text-foreground/80">{brief.owner}/{brief.repo}</span>
            <span className="text-border-strong">·</span>
            <span>#{brief.number}</span>
            <span className="text-border-strong">·</span>
            <span>@{brief.author}</span>
            <span className="text-border-strong">·</span>
            <span>{brief.headSha}</span>
            <span className="text-border-strong">·</span>
            <span>
              <span className="text-diff-add-foreground">+{brief.added}</span>
              {" / "}
              <span className="text-diff-del-foreground">−{brief.removed}</span>
            </span>
          </p>

          <Separator className="my-8" />

          <SubsectionTitle index="I" title="Intent" />
          <p className="text-lg leading-relaxed text-foreground/90">
            {brief.intent}
          </p>

          <Separator className="my-10" />

          <SubsectionTitle
            index="II"
            title="Risk areas"
            meta={`${brief.riskAreas.length} found`}
          />
          <ol className="space-y-6">
            {brief.riskAreas.map((area) => (
              <li key={area.title} className="grid gap-3 md:grid-cols-[5rem_minmax(0,1fr)]">
                <div>
                  <Badge variant={riskVariant[area.level]}>{riskLabel[area.level]}</Badge>
                </div>
                <div>
                  <h4 className="text-base font-medium text-foreground">
                    {area.title}
                  </h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {area.reason}
                  </p>
                  <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground/90 tabular">
                    {area.files.map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>

          <Separator className="my-10" />

          <SubsectionTitle
            index="III"
            title="Change groups"
            meta={`${brief.changeGroups.length} groups`}
          />
          <ol className="space-y-7">
            {brief.changeGroups.map((group, i) => (
              <li key={group.title}>
                <p className="mb-1 font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
                  Group {String(i + 1).padStart(2, "0")}
                </p>
                <h4 className="text-base font-medium text-foreground">{group.title}</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {group.summary}
                </p>
                <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground/90 tabular">
                  {group.files.map((path) => (
                    <li key={path}>{path}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <Separator className="my-10" />

          <SubsectionTitle index="IV" title="Verification" />
          <ol className="space-y-2.5">
            {brief.verification.map((line, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
              >
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm border border-border font-mono text-2xs text-muted-foreground tabular">
                  {i + 1}
                </span>
                <span className={cn(i < 2 && "font-mono text-[0.8rem]")}>
                  {line}
                </span>
              </li>
            ))}
          </ol>

          <Separator className="my-10" />

          <SubsectionTitle index="V" title="Open questions" />
          <ol className="space-y-3">
            {brief.openQuestions.map((q, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90">
                <span className="mt-0.5 font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
                  Q{i + 1}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ol>

          <Separator className="my-10" />

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Brief generated for head {" "}
              <span className="font-mono text-foreground tabular">{brief.headSha}</span>.
              Regenerates on new commits.
            </p>
            <Button variant="ghost" size="sm">
              Regenerate
            </Button>
          </div>
        </article>
      </div>
    </section>
  );
}

function SubsectionTitle({
  index,
  title,
  meta,
}: {
  index: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="mb-5 flex items-baseline gap-3">
      <span className="font-mono text-xs text-muted-foreground tabular">{index}.</span>
      <h3 className="text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      {meta && (
        <span className="ml-auto font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground tabular">
          {meta}
        </span>
      )}
    </div>
  );
}

function RailNav({
  label,
  badge,
  active,
}: {
  label: string;
  badge?: number;
  active?: boolean;
}) {
  return (
    <li>
      <a
        href="#"
        className={cn(
          "flex items-center justify-between rounded-sm px-2 py-1 text-sm transition-colors",
          "hover:bg-subtle hover:text-foreground",
          active ? "text-foreground bg-subtle" : "text-muted-foreground",
        )}
      >
        <span className="flex items-center gap-2">
          {active && (
            <span className="inline-block size-1 rounded-full bg-primary" aria-hidden />
          )}
          {!active && <span className="inline-block size-1" aria-hidden />}
          {label}
        </span>
        {typeof badge === "number" && (
          <span className="font-mono text-2xs text-muted-foreground tabular">
            {badge}
          </span>
        )}
      </a>
    </li>
  );
}

/* ──────────────────────────────────────────────
   Foundation reference
   ────────────────────────────────────────────── */
function FoundationSection() {
  return (
    <section
      className="border-t border-border pt-16 pb-16 md:pt-20 md:pb-20"
      aria-labelledby="foundation-heading"
    >
      <SectionHeader
        eyebrow="The foundation"
        heading="One opinionated system. Everything builds from it."
        sub="Tokens, type, and primitives every future surface inherits. Restrained on purpose: variety comes from rank and density, not new components."
      />

      <div className="mt-12 grid gap-14 md:grid-cols-2 md:gap-x-12 lg:grid-cols-3">
        <div>
          <FoundationLabel index="A" title="Type scale" />
          <ol className="mt-5 space-y-3">
            {typeScale.map((row) => (
              <li
                key={row.name}
                className="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-4"
              >
                <span className="font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground tabular">
                  {row.name}
                </span>
                <span className={row.className}>{row.sample}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <FoundationLabel index="B" title="Palette" />
          <ol className="mt-5 grid grid-cols-2 gap-3">
            {swatches.map((s) => (
              <li
                key={s.token}
                className="flex items-center gap-3 rounded-sm border border-border p-2"
              >
                <span
                  className={cn(
                    "size-7 shrink-0 rounded-sm",
                    s.className,
                    s.border && "border border-border-strong",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 font-mono text-xs text-foreground/90 tabular truncate">
                  {s.token}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            All values in OKLCH, every neutral tinted toward a warm paper hue.
            One accent colour for action and focus. Risk semantics carry their
            own controlled hazard family.
          </p>
        </div>

        <div className="lg:col-span-1 md:col-span-2">
          <FoundationLabel index="C" title="Primitives" />

          <div className="mt-5 space-y-6">
            <PrimitiveRow title="Buttons">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </PrimitiveRow>

            <PrimitiveRow title="Badges">
              <Badge>neutral</Badge>
              <Badge variant="outline">outline</Badge>
              <Badge variant="accent">accent</Badge>
              <Badge variant="riskHigh">
                <ShieldAlert className="size-2.5" aria-hidden /> high
              </Badge>
              <Badge variant="riskMed">med</Badge>
              <Badge variant="riskLow">low</Badge>
            </PrimitiveRow>

            <div>
              <p className="mb-2 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Input
              </p>
              <Label htmlFor="paste-pr" className="mb-1.5 block">
                Paste a pull request URL
              </Label>
              <div className="flex gap-2">
                <Input
                  id="paste-pr"
                  placeholder="https://github.com/acme/api/pull/1247"
                  className="font-mono text-sm tabular"
                />
                <Button>
                  Open
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </div>
              <p className="mt-1.5 text-2xs text-muted-foreground">
                Press <Kbd>Enter</Kbd> to open. <Kbd>⌘</Kbd>
                <Kbd>K</Kbd> for the command palette.
              </p>
            </div>

            <div>
              <p className="mb-2 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Keyboard
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
                <span className="mx-1">palette</span>
                <span className="mx-2 text-border-strong">·</span>
                <Kbd>g</Kbd>
                <Kbd>b</Kbd>
                <span className="mx-1">go to brief</span>
                <span className="mx-2 text-border-strong">·</span>
                <Kbd>?</Kbd>
                <span className="mx-1">shortcuts</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FoundationLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-xs text-muted-foreground tabular">{index}.</span>
      <h3 className="text-base font-medium text-foreground">{title}</h3>
    </div>
  );
}

function PrimitiveRow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Voice / principles
   ────────────────────────────────────────────── */
function VoiceSection() {
  const principles = [
    {
      title: "Information has rank.",
      body: "Every screen has a single most-important thing. Show it first, larger, alone. Subordinate everything else.",
    },
    {
      title: "Show, don't decorate.",
      body: "A risk badge is a colour and a word. A SHA is monospace. A file path is monospace. The chrome is whatever is left after the content is placed.",
    },
    {
      title: "Earn the user's hours.",
      body: "This is a tool people sit inside, not a page they glance at. Long-session comfort beats short-session impression.",
    },
    {
      title: "Commit to opinions.",
      body: "Restrained palette, one accent, one type pair, one set of radii, one motion curve. Variety comes from rank, not from new components.",
    },
  ];

  return (
    <section
      className="border-t border-border pt-16 pb-16 md:pt-20 md:pb-20"
      aria-labelledby="voice-heading"
    >
      <SectionHeader
        eyebrow="Voice"
        heading="Calm, sharp, respectful."
        sub="Four rules every label, button, empty state, and error follows. The interface assumes you already care; it does not try to convince you."
      />

      <ol className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {principles.map((p, i) => (
          <li key={p.title} className="flex gap-5">
            <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="text-lg font-medium text-foreground">{p.title}</h3>
              <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ──────────────────────────────────────────────
   Footer
   ────────────────────────────────────────────── */
function SiteFooter() {
  return (
    <footer className="border-t border-border pt-10 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Wordmark size="sm" />
          <span className="text-xs text-muted-foreground">
            v0 foundation. Open source. Self-host today.
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground tabular">
          <Link href="/docs/INITIAL_PLAN.md" className="hover:text-foreground transition-colors">
            Plan
          </Link>
          <span className="text-border-strong">·</span>
          <Link href="https://github.com" className="hover:text-foreground transition-colors">
            GitHub
          </Link>
          <span className="text-border-strong">·</span>
          <span className="flex items-center gap-1.5">
            <ListOrdered className="size-3" aria-hidden />
            ranked by risk
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────
   Shared
   ────────────────────────────────────────────── */
function SectionHeader({
  eyebrow,
  heading,
  sub,
}: {
  eyebrow: string;
  heading: string;
  sub: string;
}) {
  return (
    <div>
      <p className="mb-4 inline-flex items-center gap-3 font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground tabular">
        <span className="h-px w-6 bg-primary/70" aria-hidden />
        {eyebrow}
      </p>
      <h2 className="font-display text-balance text-3xl font-medium leading-[1.05] text-foreground md:text-[2.75rem] md:leading-[1.02]">
        {heading}
      </h2>
      <p className="mt-5 max-w-[64ch] text-base leading-relaxed text-muted-foreground">
        {sub}
      </p>
    </div>
  );
}
