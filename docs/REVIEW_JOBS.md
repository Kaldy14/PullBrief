# Review jobs and worker

PullBrief uses a durable Postgres-backed review queue for manual and webhook-triggered PR reviews.

## Why this design

The researched options were:

- External queue services such as Trigger.dev, Inngest, QStash, or cloud task queues.
- Redis-backed queues such as BullMQ.
- Postgres-backed libraries such as Graphile Worker or pg-boss.
- A small app-owned Postgres queue using `FOR UPDATE SKIP LOCKED`.

For the current self-hosted/internal MVP, the app-owned Postgres queue is the best fit:

- PullBrief already requires Postgres.
- It avoids adding Redis or a hosted workflow dependency.
- Jobs can be enqueued atomically with app state.
- `FOR UPDATE SKIP LOCKED` is the standard Postgres primitive for safe concurrent worker claiming.
- The schema stays domain-specific and easy to inspect from Drizzle/SQL.

If PullBrief later needs high-throughput scheduling, cron workflows, or distributed orchestration, Graphile Worker or pg-boss are the natural upgrade path because they keep the same Postgres-only operational model.

## Implemented flow

```text
manual form / webhook / API -> review_jobs queued row -> worker claims row -> generate/reuse report -> job ready/failed -> UI redirects or shows error
```

Manual UI now queues jobs instead of blocking the request:

```text
/review -> /jobs/:id -> worker completes -> /:owner/:repo/pull/:number
```

Webhook `pull_request` events enqueue jobs when the repository is enabled.

## Job table behavior

`review_jobs` tracks:

- PR identity: `tenant_id`, `owner`, `repo`, `number`, `head_sha`
- source: `trigger` (`manual`, `webhook`, `rerun`, `comment`)
- lifecycle: `queued`, `running`, `ready`, `failed`, `cancelled`
- retry state: `attempts`, `max_attempts`, `run_at`
- worker lock: `locked_at`, `locked_by`, `last_heartbeat_at`
- output: `report_id`, `error_message`

Jobs are deduped by:

```text
tenant_id + owner + repo + number + head_sha + trigger
```

Manual jobs use a pending synthetic `head_sha` until the worker fetches the PR and resolves the real head SHA.

## Worker commands

Run continuously:

```bash
pnpm --filter @pullbrief/web worker:reviews
```

Process at most one currently due job:

```bash
pnpm --filter @pullbrief/web worker:reviews:once
```

Useful local pattern:

```bash
docker compose up -d postgres
pnpm --filter @pullbrief/web db:migrate
pnpm dev
# in another terminal
pnpm --filter @pullbrief/web worker:reviews
```

## Reliability details

- Claiming uses a short transaction with `SELECT ... FOR UPDATE SKIP LOCKED`.
- Network/API/model work happens outside the claiming transaction.
- Workers heartbeat long jobs.
- Stale `running` jobs are rescued back to `queued` after timeout.
- Failures are retried with exponential backoff up to `max_attempts`.
- Failed/cancelled dedupe matches are requeued when requested again.
- Failed/cancelled jobs can also be retried through `POST /api/review-jobs/:id/retry` or the `/jobs/:id` retry button.
- The worker is a separate process and does not rely on a long-lived Next.js request.

## UI/API

Routes:

```text
/reviews                    # recent jobs dashboard
/jobs/:id                   # job status page with polling/redirect
GET  /api/review-jobs/:id       # job status JSON
POST /api/review-jobs/:id/retry # retry failed/cancelled jobs
```

`POST /api/reports` defaults to async queueing and returns `202`:

```json
{
  "jobId": "...",
  "status": "queued",
  "url": "/jobs/..."
}
```

For legacy/blocking behavior, callers may pass:

```json
{ "async": false }
```

## Current limits

- There is no separate production process manager config yet. In deployment, run `worker:reviews` as a separate service/process next to the web app.
- Job concurrency is process-level; run multiple worker processes if needed. `SKIP LOCKED` prevents duplicate claims.
- No webhook delivery replay UI yet; delivery records exist in Postgres.
- No admin retry button yet; re-submitting the same failed/cancelled job requeues it.
