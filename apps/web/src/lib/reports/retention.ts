import "server-only";

import { and, desc, eq, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db";
import { prReports } from "@/db/schema";
import type { PullRequestContext } from "@/lib/reports/types";

export type PruneReportContextResult = {
  scanned: number;
  pruned: number;
  cutoff: Date;
};

export async function pruneReportContextPatches(input: {
  olderThanDays: number;
  limit?: number;
}): Promise<PruneReportContextResult> {
  if (!Number.isFinite(input.olderThanDays) || input.olderThanDays < 0) {
    throw new Error("olderThanDays must be a non-negative number.");
  }

  const cutoff = new Date(Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: prReports.id, contextJson: prReports.contextJson })
    .from(prReports)
    .where(and(lte(prReports.updatedAt, cutoff), isNotNull(prReports.contextJson)))
    .orderBy(desc(prReports.updatedAt))
    .limit(input.limit ?? 500);
  let pruned = 0;

  for (const row of rows) {
    const prunedContext = stripPatches(row.contextJson);

    if (prunedContext.changed) {
      await db
        .update(prReports)
        .set({
          contextJson: prunedContext.context,
          updatedAt: new Date(),
        })
        .where(eq(prReports.id, row.id));
      pruned += 1;
    }
  }

  return {
    scanned: rows.length,
    pruned,
    cutoff,
  };
}

function stripPatches(context: PullRequestContext): { context: PullRequestContext; changed: boolean } {
  let changed = false;
  const files = context.files.map((file) => {
    if (file.patch === null) {
      return file;
    }

    changed = true;
    return { ...file, patch: null };
  });

  return {
    context: changed ? { ...context, files } : context,
    changed,
  };
}
