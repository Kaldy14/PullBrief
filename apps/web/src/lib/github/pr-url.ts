export type GitHubPullRequestRef = {
  owner: string;
  repo: string;
  number: number;
};

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO_PATTERN = /^[A-Za-z0-9_.-]+$/;

export class PullRequestUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PullRequestUrlError";
  }
}

export function getGitHubWebHost() {
  return process.env.PULLBRIEF_GITHUB_HOST?.trim() || "github.com";
}

export function parseGitHubPullRequestUrl(input: string): GitHubPullRequestRef {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new PullRequestUrlError("Paste a GitHub pull request URL.");
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new PullRequestUrlError("Use a full GitHub PR URL, for example https://github.com/acme/api/pull/123.");
  }

  const expectedHost = getGitHubWebHost().toLowerCase();
  const actualHost = url.hostname.toLowerCase().replace(/^www\./, "");

  if (actualHost !== expectedHost) {
    throw new PullRequestUrlError(`Only ${expectedHost} pull request URLs are supported in this install.`);
  }

  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [owner, repo, pullSegment, numberSegment] = parts;

  if (!owner || !repo || pullSegment !== "pull" || !numberSegment) {
    throw new PullRequestUrlError("Use a GitHub PR URL shaped like https://github.com/owner/repo/pull/123.");
  }

  if (!OWNER_PATTERN.test(owner)) {
    throw new PullRequestUrlError("The GitHub owner segment is not valid.");
  }

  if (!REPO_PATTERN.test(repo)) {
    throw new PullRequestUrlError("The GitHub repository segment is not valid.");
  }

  if (!/^\d+$/.test(numberSegment)) {
    throw new PullRequestUrlError("The pull request number must be a positive integer.");
  }

  const number = Number(numberSegment);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new PullRequestUrlError("The pull request number must be a positive integer.");
  }

  return { owner, repo, number };
}

export function buildGitHubPullRequestUrl(ref: GitHubPullRequestRef) {
  return `https://${getGitHubWebHost()}/${ref.owner}/${ref.repo}/pull/${ref.number}`;
}

export function buildPullBriefRoute(ref: GitHubPullRequestRef) {
  return `/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pull/${ref.number}`;
}

export function parsePositivePullNumber(input: string) {
  if (!/^\d+$/.test(input)) {
    throw new PullRequestUrlError("The pull request number must be a positive integer.");
  }

  const number = Number(input);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new PullRequestUrlError("The pull request number must be a positive integer.");
  }

  return number;
}
