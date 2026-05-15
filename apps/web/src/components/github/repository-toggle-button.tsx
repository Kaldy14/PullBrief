"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function RepositoryToggleButton({
  repositoryId,
  enabled,
  disabled = false,
}: {
  repositoryId: string;
  enabled: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);

    const response = await fetch("/api/github/repositories", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositoryId, enabled: !enabled }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      setError(body?.error || "Unable to update repository.");
      setPending(false);
      return;
    }

    router.refresh();
    setPending(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={disabled || pending} onClick={toggle}>
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        {enabled ? "Disable" : "Enable"}
      </Button>
      {error ? <p className="max-w-48 text-right text-xs text-risk-high">{error}</p> : null}
    </div>
  );
}
