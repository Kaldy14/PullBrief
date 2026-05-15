import "server-only";

import type {
  PullRequestCheckRun,
  PullRequestChecks,
  PullRequestContext,
  PullRequestContextCommit,
  PullRequestContextFile,
  PullRequestLabel,
  PullRequestReviewer,
  PullRequestStatus,
} from "@/lib/reports/types";

const DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com";
const DEFAULT_GITHUB_API_VERSION = "2022-11-28";
const MAX_PAGINATED_PAGES = 30;

type GitHubUser = {
  login?: string | null;
  type?: string | null;
};

type GitHubLabel = {
  name?: string | null;
  color?: string | null;
};

type GitHubPullRequestResponse = {
  html_url: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  draft?: boolean;
  user: GitHubUser | null;
  base: {
    ref: string;
    sha: string;
    repo: {
      full_name: string;
    } | null;
  };
  head: {
    ref: string;
    sha: string;
    repo: {
      full_name: string;
    } | null;
  };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  labels?: GitHubLabel[];
  requested_reviewers?: GitHubUser[];
  changed_files?: number;
  additions?: number;
  deletions?: number;
  commits?: number;
};

type GitHubPullRequestFileResponse = {
  filename: string;
  previous_filename?: string;
  status: string;
  sha: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blob_url: string;
  raw_url: string;
};

type GitHubPullRequestCommitResponse = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name?: string | null;
      date?: string | null;
    } | null;
  };
  author: GitHubUser | null;
};

type GitHubCheckRunsResponse = {
  check_runs?: Array<{
    name?: string | null;
    status?: string | null;
    conclusion?: string | null;
    html_url?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  }>;
};

type GitHubCombinedStatusResponse = {
  state?: string | null;
  statuses?: Array<{
    context?: string | null;
    state?: string | null;
    description?: string | null;
    target_url?: string | null;
  }>;
};

type GitHubErrorResponse = {
  message?: string;
  documentation_url?: string;
};

export class GitHubApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, message: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.path = path;
  }
}

export type FetchPullRequestContextInput = {
  owner: string;
  repo: string;
  number: number;
};

export type FetchPullRequestContextOptions = {
  token?: string | null;
};

export async function fetchPullRequestContext(
  input: FetchPullRequestContextInput,
  options: FetchPullRequestContextOptions = {},
): Promise<PullRequestContext> {
  const pullPath = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.number}`;

  const [pull, files, commits] = await Promise.all([
    githubGet<GitHubPullRequestResponse>(pullPath, options),
    githubGetPaginated<GitHubPullRequestFileResponse>(`${pullPath}/files`, options),
    githubGetPaginated<GitHubPullRequestCommitResponse>(`${pullPath}/commits`, options),
  ]);

  const checks = await fetchChecks(input.owner, input.repo, pull.head.sha, options);

  return {
    schemaVersion: "pullbrief.pr_context.v1",
    owner: input.owner,
    repo: input.repo,
    number: pull.number,
    fetchedAt: new Date().toISOString(),
    htmlUrl: pull.html_url,
    title: pull.title,
    body: pull.body,
    state: pull.state,
    draft: Boolean(pull.draft),
    authorLogin: pull.user?.login || "unknown",
    baseRef: pull.base.ref,
    baseSha: pull.base.sha,
    baseRepoFullName: pull.base.repo?.full_name || `${input.owner}/${input.repo}`,
    headRef: pull.head.ref,
    headSha: pull.head.sha,
    headRepoFullName: pull.head.repo?.full_name || `${input.owner}/${input.repo}`,
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    mergedAt: pull.merged_at,
    labels: toLabels(pull.labels || []),
    requestedReviewers: toReviewers(pull.requested_reviewers || []),
    stats: {
      filesChanged: pull.changed_files ?? files.length,
      additions: pull.additions ?? sumBy(files, (file) => file.additions),
      deletions: pull.deletions ?? sumBy(files, (file) => file.deletions),
      commits: pull.commits ?? commits.length,
    },
    files: files.map(toContextFile),
    commits: commits.map(toContextCommit),
    checks,
  };
}

async function fetchChecks(
  owner: string,
  repo: string,
  headSha: string,
  options: FetchPullRequestContextOptions,
): Promise<PullRequestChecks> {
  const warnings: string[] = [];

  const [checkRunsResult, statusesResult] = await Promise.allSettled([
    githubGet<GitHubCheckRunsResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(headSha)}/check-runs`,
      options,
    ),
    githubGet<GitHubCombinedStatusResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(headSha)}/status`,
      options,
    ),
  ]);

  const checkRuns: PullRequestCheckRun[] = [];
  const statuses: PullRequestStatus[] = [];
  let state: string | null = null;

  if (checkRunsResult.status === "fulfilled") {
    for (const run of checkRunsResult.value.check_runs || []) {
      checkRuns.push({
        name: run.name || "unnamed check",
        status: run.status || "unknown",
        conclusion: run.conclusion || null,
        htmlUrl: run.html_url || null,
        startedAt: run.started_at || null,
        completedAt: run.completed_at || null,
      });
    }
  } else {
    warnings.push(errorMessage(checkRunsResult.reason));
  }

  if (statusesResult.status === "fulfilled") {
    state = statusesResult.value.state || null;
    for (const status of statusesResult.value.statuses || []) {
      statuses.push({
        context: status.context || "unnamed status",
        state: status.state || "unknown",
        description: status.description || null,
        targetUrl: status.target_url || null,
      });
    }
  } else {
    warnings.push(errorMessage(statusesResult.reason));
  }

  return {
    state,
    checkRuns,
    statuses,
    fetchWarnings: warnings,
  };
}

async function githubGetPaginated<T>(path: string, options: FetchPullRequestContextOptions): Promise<T[]> {
  const items: T[] = [];

  for (let page = 1; page <= MAX_PAGINATED_PAGES; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const pageItems = await githubGet<T[]>(`${path}${separator}per_page=100&page=${page}`, options);
    items.push(...pageItems);

    if (pageItems.length < 100) {
      break;
    }
  }

  return items;
}

async function githubGet<T>(path: string, options: FetchPullRequestContextOptions): Promise<T> {
  const url = new URL(path, getGitHubApiBaseUrl());
  const response = await fetch(url, {
    headers: githubHeaders(options.token),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GitHubApiError(response.status, path, await readGitHubError(response));
  }

  return response.json() as Promise<T>;
}

function getGitHubApiBaseUrl() {
  return process.env.PULLBRIEF_GITHUB_API_BASE_URL?.trim() || DEFAULT_GITHUB_API_BASE_URL;
}

function githubHeaders(explicitToken?: string | null): HeadersInit {
  const token = explicitToken ?? process.env.PULLBRIEF_GITHUB_TOKEN?.trim() ?? process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": process.env.PULLBRIEF_GITHUB_API_VERSION?.trim() || DEFAULT_GITHUB_API_VERSION,
    "User-Agent": "pullbrief-phase1",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function readGitHubError(response: Response) {
  const fallback = `GitHub API request failed with ${response.status} ${response.statusText}.`;

  try {
    const body = (await response.json()) as GitHubErrorResponse;
    return body.message ? `GitHub API: ${body.message}` : fallback;
  } catch {
    return fallback;
  }
}

function toLabels(labels: GitHubLabel[]): PullRequestLabel[] {
  return labels.map((label) => ({
    name: label.name || "unnamed",
    color: label.color || "",
  }));
}

function toReviewers(reviewers: GitHubUser[]): PullRequestReviewer[] {
  return reviewers.map((reviewer) => ({
    login: reviewer.login || "unknown",
    type: reviewer.type || "User",
  }));
}

function toContextFile(file: GitHubPullRequestFileResponse): PullRequestContextFile {
  return {
    path: file.filename,
    previousPath: file.previous_filename || null,
    status: file.status,
    sha: file.sha,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch || null,
    blobUrl: file.blob_url,
    rawUrl: file.raw_url,
  };
}

function toContextCommit(commit: GitHubPullRequestCommitResponse): PullRequestContextCommit {
  return {
    sha: commit.sha,
    htmlUrl: commit.html_url,
    message: commit.commit.message,
    authorName: commit.commit.author?.name || null,
    authorLogin: commit.author?.login || null,
    authoredAt: commit.commit.author?.date || null,
  };
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to fetch one GitHub check/status endpoint.";
}
