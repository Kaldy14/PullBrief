"use server";

import { redirect } from "next/navigation";

import { requireServerActionAccess } from "@/lib/auth/guard";
import { parsePositivePullNumber } from "@/lib/github/pr-url";
import { enqueueReviewJob, enqueueReviewJobFromUrl } from "@/lib/review-jobs/queue";
import { buildReviewJobRoute } from "@/lib/review-jobs/routes";

export type GenerateReportActionState = {
  error: string | null;
  prUrl: string;
};

export async function generateReportAction(
  _previousState: GenerateReportActionState,
  formData: FormData,
): Promise<GenerateReportActionState> {
  const prUrl = stringFromFormData(formData, "prUrl");
  const access = await requireServerActionAccess();
  let jobPath: string;

  try {
    const job = await enqueueReviewJobFromUrl({
      tenantId: access.tenantId,
      requestedByUserId: access.userId,
      prUrl,
      trigger: "manual",
    });
    jobPath = buildReviewJobRoute(job);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to queue the report.",
      prUrl,
    };
  }

  redirect(jobPath);
}

export async function generateReportFormAction(formData: FormData): Promise<void> {
  const prUrl = stringFromFormData(formData, "prUrl");
  const access = await requireServerActionAccess();
  const job = await enqueueReviewJobFromUrl({
    tenantId: access.tenantId,
    requestedByUserId: access.userId,
    prUrl,
    trigger: "manual",
  });
  redirect(buildReviewJobRoute(job));
}

export async function regenerateReportFormAction(formData: FormData): Promise<void> {
  const owner = stringFromFormData(formData, "owner");
  const repo = stringFromFormData(formData, "repo");
  const number = parsePositivePullNumber(stringFromFormData(formData, "number"));
  const access = await requireServerActionAccess();
  const job = await enqueueReviewJob({
    owner,
    repo,
    number,
    tenantId: access.tenantId,
    requestedByUserId: access.userId,
    trigger: "rerun",
    priority: 10,
  });

  redirect(buildReviewJobRoute(job));
}

function stringFromFormData(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
