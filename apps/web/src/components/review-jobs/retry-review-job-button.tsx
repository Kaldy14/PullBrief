"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function RetryReviewJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setPending(true);
    setError(null);

    const response = await fetch(`/api/review-jobs/${jobId}/retry`, {
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      setError(body?.error || "Unable to retry review job.");
      setPending(false);
      return;
    }

    router.refresh();
    setPending(false);
  }

  return (
    <div className="mt-4 flex flex-col items-start gap-2">
      <Button type="button" onClick={retry} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
        Retry job
      </Button>
      {error ? <p className="text-sm text-risk-high" role="alert">{error}</p> : null}
    </div>
  );
}
