"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { friendlyReviewJobError } from "@/lib/review-jobs/errors";
import { RetryReviewJobButton } from "@/components/review-jobs/retry-review-job-button";

type JobStatus = "queued" | "running" | "ready" | "failed" | "cancelled";

type ReviewJobResponse = {
  job?: {
    id: string;
    status: JobStatus;
    attempts: number;
    maxAttempts: number;
    errorMessage: string | null;
    reportUrl: string | null;
  };
  error?: string;
};

export function JobStatusPoller({ jobId, initialStatus }: { jobId: string; initialStatus: JobStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "ready" || status === "failed" || status === "cancelled") {
      return;
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/review-jobs/${jobId}`, { cache: "no-store" });
        const body = await response.json() as ReviewJobResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok || !body.job) {
          setError(body.error || "Unable to fetch job status.");
          return;
        }

        setStatus(body.job.status);
        setAttempts(body.job.attempts);
        setMaxAttempts(body.job.maxAttempts);
        setError(body.job.errorMessage);
        setReportUrl(body.job.reportUrl);

        if (body.job.status === "ready" && body.job.reportUrl) {
          router.push(body.job.reportUrl);
          router.refresh();
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "Unable to fetch job status.");
        }
      }
    }, 2_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId, router, status]);

  if (status === "ready" && reportUrl) {
    return (
      <div className="mt-6 rounded-lg border border-risk-low/35 bg-risk-low/10 p-4 text-sm text-risk-low">
        Report ready. Redirecting…
        <Button className="ml-3" size="sm" nativeButton={false} render={<a href={reportUrl}>Open report</a>} />
      </div>
    );
  }

  if (status === "failed" || status === "cancelled") {
    const friendlyError = friendlyReviewJobError(error);

    return (
      <div className="mt-6 rounded-lg border border-risk-high/35 bg-risk-high/10 p-4 text-sm text-risk-high" role="alert">
        <p className="font-medium">{friendlyError?.title || `Job ${status}`}</p>
        <p className="mt-1 text-risk-high/90">{friendlyError?.detail || error || `Job ${status}.`}</p>
        {friendlyError?.action ? <p className="mt-2 text-risk-high/80">{friendlyError.action}</p> : null}
        <RetryReviewJobButton jobId={jobId} />
      </div>
    );
  }

  return (
    <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-background/35 p-4 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
      <span>
        {status === "running" ? "Generating PullBrief report" : "Queued for PullBrief worker"}
        {maxAttempts > 0 ? ` · attempt ${attempts}/${maxAttempts}` : null}
      </span>
      {error ? <span className="text-risk-med">{error}</span> : null}
    </div>
  );
}
