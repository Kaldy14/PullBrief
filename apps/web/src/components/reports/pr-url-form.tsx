"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useActionState } from "react";

import { generateReportAction, type GenerateReportActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PullRequestUrlFormProps = {
  defaultValue?: string;
  label?: string;
  compact?: boolean;
  className?: string;
};

const initialState: GenerateReportActionState = {
  error: null,
  prUrl: "",
};

export function PullRequestUrlForm({
  defaultValue = "",
  label = "Paste a pull request URL",
  compact = false,
  className,
}: PullRequestUrlFormProps) {
  const [state, action, pending] = useActionState(generateReportAction, initialState);
  const inputId = compact ? "pr-url-compact" : "pr-url";
  const currentValue = state.prUrl || defaultValue;

  return (
    <form action={action} className={cn("space-y-2", className)}>
      <Label htmlFor={inputId} className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </Label>
      <div className={cn("flex gap-2", compact ? "flex-col sm:flex-row" : "flex-col sm:flex-row")}>
        <Input
          id={inputId}
          name="prUrl"
          type="url"
          inputMode="url"
          defaultValue={currentValue}
          placeholder="https://github.com/acme/api/pull/1247"
          className="h-10 font-mono text-sm tabular"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? `${inputId}-error` : undefined}
          disabled={pending}
          required
        />
        <Button type="submit" size="lg" disabled={pending} className="min-w-32">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Generating
            </>
          ) : (
            <>
              Generate brief
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
      {state.error ? (
        <p id={`${inputId}-error`} className="text-sm leading-relaxed text-risk-high" role="alert">
          {state.error}
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Uses a server-side GitHub token when configured. Reports are cached by PR head SHA.
        </p>
      )}
    </form>
  );
}
