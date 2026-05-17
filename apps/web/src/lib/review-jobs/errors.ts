export type FriendlyJobError = {
  title: string;
  detail: string;
  action: string;
};

export function friendlyReviewJobError(message: string | null): FriendlyJobError | null {
  if (!message) {
    return null;
  }

  const lower = message.toLowerCase();

  if (lower.includes("not enabled") || lower.includes("install the github app") || lower.includes("repository allowlist")) {
    return {
      title: "Repository is not enabled for PullBrief",
      detail: message,
      action: "Ask a tenant admin to install the GitHub App and enable this repository in GitHub settings.",
    };
  }

  if (lower.includes("github api") || lower.includes("github app") || lower.includes("installation token") || lower.includes("rate limit")) {
    return {
      title: "GitHub access failed",
      detail: message,
      action: "Check the GitHub App installation, repository permissions, rate limits, and webhook/app configuration.",
    };
  }

  if (lower.includes("pi") || lower.includes("model") || lower.includes("json") || lower.includes("timed out")) {
    return {
      title: "AI report generation failed",
      detail: message,
      action: "Ensure the local pi CLI is installed, authenticated, and reachable by the worker process. You can retry after fixing the runtime.",
    };
  }

  return {
    title: "Review job failed",
    detail: message,
    action: "Retry the job. If it fails again, inspect the worker logs and saved error message.",
  };
}
