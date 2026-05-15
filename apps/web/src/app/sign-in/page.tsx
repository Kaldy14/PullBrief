import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { SignInForm } from "@/components/auth/sign-in-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

type SignInPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-background/85">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center px-6">
          <Link href="/" aria-label="PullBrief, home">
            <Wordmark size="sm" />
          </Link>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 md:grid-cols-[1fr_440px] md:items-start">
        <section>
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-2xs font-medium uppercase tracking-[0.14em] text-primary tabular">
            <ShieldCheck className="size-3.5" aria-hidden />
            Internal access only
          </p>
          <h1 className="mt-5 font-display text-4xl font-medium leading-tight text-foreground md:text-5xl">
            Sign in to review private pull requests safely.
          </h1>
          <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
            PullBrief accounts are seeded by an admin. Public sign-up is disabled in the API, not just hidden in the UI.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_0_oklch(0_0_0/0.35),0_28px_70px_-32px_oklch(0_0_0/0.65)]">
          <h2 className="font-display text-2xl font-medium text-foreground">Welcome back</h2>
          <p className="mt-2 text-sm text-muted-foreground">Use the seeded email/password account for your tenant.</p>
          {errorCode === "no-access" ? (
            <p className="mt-4 rounded-lg border border-risk-high/35 bg-risk-high/10 px-3 py-2 text-sm text-risk-high" role="alert">
              Your account exists, but it is not a member of a PullBrief tenant yet.
            </p>
          ) : null}
          <div className="mt-6">
            <SignInForm nextPath={nextPath} />
          </div>
        </section>
      </main>
    </div>
  );
}

function safeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/review";
  }

  return value;
}
