import type { reviewJobs } from "@/db/schema";

export function buildReviewJobRoute(job: Pick<typeof reviewJobs.$inferSelect, "id">) {
  return `/jobs/${job.id}`;
}
