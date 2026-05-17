import "server-only";

import { fetchPullRequestContext } from "@/lib/github/client";
import { resolvePullRequestRepositoryAuth } from "@/lib/github/repository-access";
import type { ReportRecord } from "@/lib/reports/types";
import { fileToWorkbenchDiffFile, type WorkbenchDiffFile } from "@/lib/review-workbench/diffs";

export type ReviewWorkbenchData = {
  files: WorkbenchDiffFile[];
  warning: string | null;
};

export async function buildReviewWorkbenchData(record: ReportRecord): Promise<ReviewWorkbenchData> {
  const storedFiles = record.context.files.map((file) => fileToWorkbenchDiffFile(file, file.patch ? "stored" : "missing"));

  if (storedFiles.every((file) => file.patch)) {
    return { files: storedFiles, warning: null };
  }

  try {
    const repositoryAuth = await resolvePullRequestRepositoryAuth(record.tenantId, record);
    const freshContext = await fetchPullRequestContext(record, { token: repositoryAuth.token });
    const freshFilesByPath = new Map(freshContext.files.map((file) => [file.path, file]));

    return {
      files: storedFiles.map((file) => {
        if (file.patch) {
          return file;
        }

        const freshFile = freshFilesByPath.get(file.path);
        return freshFile ? fileToWorkbenchDiffFile(freshFile, freshFile.patch ? "github" : "missing") : file;
      }),
      warning: null,
    };
  } catch (error) {
    return {
      files: storedFiles,
      warning: error instanceof Error ? error.message : "Unable to fetch missing patches from GitHub.",
    };
  }
}
