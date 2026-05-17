import type { PullRequestContextFile } from "@/lib/reports/types";

export type WorkbenchDiffFile = {
  path: string;
  previousPath: string | null;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  blobUrl: string;
  patch: string | null;
  patchSource: "stored" | "github" | "missing";
};

export function fileToWorkbenchDiffFile(
  file: PullRequestContextFile,
  patchSource: "stored" | "github" | "missing",
): WorkbenchDiffFile {
  return {
    path: file.path,
    previousPath: file.previousPath,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    blobUrl: file.blobUrl,
    patch: buildUnifiedPatch(file),
    patchSource,
  };
}

export function buildUnifiedPatch(file: PullRequestContextFile): string | null {
  if (!file.patch) {
    return null;
  }

  const oldPath = file.previousPath || file.path;
  const newPath = file.path;
  const fromPath = file.status === "added" ? "/dev/null" : `a/${oldPath}`;
  const toPath = file.status === "removed" ? "/dev/null" : `b/${newPath}`;
  const metadata = [`diff --git a/${oldPath} b/${newPath}`];

  if (file.status === "renamed" && file.previousPath) {
    metadata.push(`rename from ${file.previousPath}`, `rename to ${file.path}`);
  }

  metadata.push("index 0000000..0000000 100644", `--- ${fromPath}`, `+++ ${toPath}`);

  return `${metadata.join("\n")}\n${file.patch}`;
}

export function sideToGitHub(side: "additions" | "deletions" | undefined) {
  return side === "deletions" ? "LEFT" : "RIGHT";
}

export function gitHubSideToPierre(side: "LEFT" | "RIGHT") {
  return side === "LEFT" ? "deletions" : "additions";
}
