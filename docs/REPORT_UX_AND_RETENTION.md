# Report UX and retention hardening

PullBrief now treats report generation as an observable async workflow instead of a long blocking request.

## UX patterns implemented

Industry-standard async job UX principles used here:

- Make background work visible and stateful.
- Show the current lifecycle step, not only a spinner.
- Give failed work an actionable reason and a retry path.
- Preserve history for auditability and comparison.
- Avoid retaining raw diff/patch payloads indefinitely.

## Job UX

`/jobs/:id` now shows:

- status badges
- attempt count
- run/update timestamps
- a simple progress timeline: queued -> generating -> ready/failed
- categorized failure copy
- retry button for failed/cancelled jobs
- auto-polling and redirect when ready

Categorized failures currently cover:

- repository not enabled / GitHub App not installed
- GitHub API/App/permission/rate-limit failures
- pi/model/JSON/timeout failures
- generic worker failures

Retry endpoint:

```text
POST /api/review-jobs/:id/retry
```

Retry resets attempts, clears the error, and moves the job back to `queued`.

## Report history

Report pages now load recent reports for the same PR and show them in the sidebar.

A specific historical report can be opened with:

```text
/:owner/:repo/pull/:number?report=<report-id>
```

Report reads still enforce tenant membership and active repository/installation access.

## Retention cleanup

Raw file patches inside `pr_reports.context_json.files[].patch` can be pruned while retaining report metadata, rankings, summaries, and file lists.

Command:

```bash
pnpm --filter @pullbrief/web reports:prune-context
```

Env knobs:

```bash
PULLBRIEF_CONTEXT_RETENTION_DAYS=30
PULLBRIEF_CONTEXT_RETENTION_LIMIT=500
```

The command scans reports older than the cutoff and sets stored file patches to `null`.

## Current limits

- The history sidebar links by report id, but there is not yet a dedicated full report history page per PR.
- Retry is available on failed/cancelled jobs, but there is not yet an admin-only bulk retry interface.
- Retention cleanup is command-driven; schedule it separately in production.
