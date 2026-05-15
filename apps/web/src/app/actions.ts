"use server";

import { redirect } from "next/navigation";

import { buildPullBriefRoute, parsePositivePullNumber } from "@/lib/github/pr-url";
import { requireServerActionAccess } from "@/lib/auth/guard";
import { createReportForPullRequest, createReportFromUrl } from "@/lib/reports/service";

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
  let reportPath: string;

  try {
    const record = await createReportFromUrl(prUrl, access.tenantId);
    reportPath = buildPullBriefRoute(record);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to generate the report.",
      prUrl,
    };
  }

  redirect(reportPath);
}

export async function generateReportFormAction(formData: FormData): Promise<void> {
  const prUrl = stringFromFormData(formData, "prUrl");
  const access = await requireServerActionAccess();
  const record = await createReportFromUrl(prUrl, access.tenantId);
  redirect(buildPullBriefRoute(record));
}

export async function regenerateReportFormAction(formData: FormData): Promise<void> {
  const owner = stringFromFormData(formData, "owner");
  const repo = stringFromFormData(formData, "repo");
  const number = parsePositivePullNumber(stringFromFormData(formData, "number"));
  const access = await requireServerActionAccess();

  const record = await createReportForPullRequest({ owner, repo, number }, access.tenantId, { force: true });
  redirect(buildPullBriefRoute(record));
}

function stringFromFormData(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
