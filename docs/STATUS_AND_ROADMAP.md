# PullBrief status and roadmap

Last updated: 2026-05-14

## Product direction

PullBrief is becoming a secure internal AI-powered PR review app. The intended end state is:

```text
GitHub App installation -> tenant/repo allowlist -> webhook/manual review jobs -> pi-powered review engine -> PullBrief report UI -> optional GitHub check/comment/review writeback
```

The app remains internal-first: users are seeded, public signup is disabled, and repository access should flow through a tenant-scoped GitHub App installation rather than a global PAT.

## What is done

### 1. Phase 1 PR report loop

Implemented end-to-end report generation:

- Paste/open a GitHub PR URL.
- Fetch PR metadata, files, commits, checks, and statuses.
- Generate structured report JSON through the local `pi` CLI.
- Fall back to deterministic heuristics for local/offline testing when configured.
- Store report records in Postgres.
- Render report UI at `/:owner/:repo/pull/:number`.

Main report routes:

```text
/                                  # landing page with PR URL form
/review?pr=<github-pr-url>          # validate/reuse/generate flow
/:owner/:repo/pull/:number          # report page
POST /api/reports                   # generate/reuse report
GET  /api/reports/:id               # fetch report JSON
```

### 2. Auth and tenant foundation

Implemented internal email/password auth with Better Auth:

- Public signup is blocked in the auth backend hook.
- Users are seeded through `pnpm --filter @pullbrief/web db:seed`.
- Every private page/API requires an authenticated user with a `tenant_members` row.
- Roles: `admin`, `reviewer`, `viewer`.
- Admin-only routes are used for GitHub App setup and repository controls.

Local seeded dev user currently used in OrbStack/Postgres:

```text
email: admin@admin.com
password: pass1234
```

### 3. Postgres persistence

Implemented Docker Compose Postgres + Drizzle migrations.

Core tables:

- Better Auth: `user`, `session`, `account`, `verification`
- Tenant/authz: `tenants`, `tenant_members`
- GitHub App: `github_install_states`, `github_installations`, `repositories`, `github_webhook_deliveries`
- Review data: `pull_requests`, `pr_reports`, `review_jobs`, `github_report_writebacks`, `review_drafts`, `review_draft_comments`

Local database notes:

- `docker-compose.yml` runs `postgres:17-alpine`.
- Default DB URL: `postgresql://pullbrief:pullbrief@localhost:5432/pullbrief`.
- Current local OrbStack setup uses port `55432` because another Postgres is already bound to `5432`.

### 4. GitHub App foundation

Implemented the app-side GitHub App suite. Real GitHub App registration can happen later.

Implemented setup flow:

1. Tenant admin opens `/settings/github`.
2. PullBrief creates a one-time install state.
3. Admin is redirected to `https://github.com/apps/<app-slug>/installations/new?state=<state>`.
4. GitHub returns to `/api/github/setup` with `installation_id`, `setup_action`, and `state`.
5. PullBrief redirects to GitHub user authorization.
6. PullBrief verifies the authorized GitHub user can access the installation.
7. PullBrief checks the installation account against `PULLBRIEF_ALLOWED_GITHUB_ACCOUNTS`.
8. PullBrief syncs installation metadata and repositories.
9. Synced GitHub App repositories start disabled; a PullBrief admin must enable selected repos.

Implemented GitHub App routes:

```text
/settings/github                         # admin UI
GET   /api/github/install/start          # begin install flow
GET   /api/github/setup                  # GitHub setup callback
GET   /api/github/oauth/callback         # GitHub user auth callback
GET   /api/github/repositories           # list tenant repos
PATCH /api/github/repositories           # enable/disable repo
POST  /api/github/webhooks               # signed webhook receiver
POST  /api/reports/:id/github/writeback  # publish GitHub artifacts
```

Implemented GitHub security controls:

- `X-Hub-Signature-256` validation before webhook parsing.
- Webhook payload size limit.
- Idempotent webhook delivery log.
- Invalid signatures return `401`.
- Installation IDs are not trusted by themselves.
- Existing installations cannot be reassigned across tenants.
- Production requires allowed GitHub accounts before linking/using installations.
- Report generation uses installation tokens for installed/enabled repos.
- Report reads also require current active repo/install access.
- Repos removed from a GitHub App installation are disabled on sync.
- PAT/public fallback is production-disabled and requires explicit localhost-only double opt-in.
- GitHub setup/repository controls require tenant admin access; report writeback requires reviewer/admin access.

Implemented webhook handling:

- `installation`
- `installation_repositories`
- `pull_request`

Pull request webhooks sync PR metadata and create queued `review_jobs`. The review worker now consumes those jobs asynchronously.

Implemented writeback helpers/foundation:

- Check run publishing/updating.
- Sticky PR comment publishing/updating.
- PR review publishing.
- Artifact tracking in `github_report_writebacks`.

Writeback is not automatic yet.

### 5. Review job worker and queue UX

Implemented durable review jobs with a Postgres queue.

- Manual review requests now enqueue jobs instead of blocking the HTTP request.
- Webhook-created PR jobs can be consumed by the same worker path.
- Worker command: `pnpm --filter @pullbrief/web worker:reviews`.
- One-shot worker command for tests/dev: `pnpm --filter @pullbrief/web worker:reviews:once`.
- Claiming uses PostgreSQL `FOR UPDATE SKIP LOCKED` to avoid duplicate concurrent processing.
- Jobs have retries, backoff, heartbeats, stale-running rescue, and error persistence.
- Job status UI exists at `/jobs/:id` and redirects to the report when ready.
- Recent jobs dashboard exists at `/reviews`.

See `docs/REVIEW_JOBS.md` for architecture and operations.

### 6. Report generation UX hardening

Implemented the first hardening slice around background jobs and stored report data:

- Failed/cancelled job pages show categorized, actionable error messages.
- Failed/cancelled jobs can be retried from `/jobs/:id`.
- `/api/review-jobs/:id/retry` requeues eligible jobs.
- Job pages show a simple state timeline instead of only a spinner.
- Report pages show report history for the PR and can open a specific historical report via `?report=<id>`.
- Manual regeneration now queues a durable rerun job.
- `reports:prune-context` removes raw patch text from older stored report contexts while keeping metadata/report history.

### 7. Review Workbench V1 / GitHub writeback workflow

Implemented the first complete review workbench slice:

- `/reports/:id/workbench` opens a report-centered PR review workbench.
- Diff rendering uses `@pierre/diffs/react`; PullBrief does not own a custom diff renderer.
- Diffs use stored report patches and fall back to live GitHub PR context when patches are missing.
- Reviewers can collect persisted draft comments in Postgres.
- Review event is explicit: `COMMENT`, `REQUEST_CHANGES`, or `APPROVE`.
- Draft reviews can be submitted to GitHub as formal PR reviews with line comments.
- Workbench can publish PullBrief check run + sticky summary comment.
- Workbench can ask pi clarification questions about selected report/file/line context.
- pi prompts are centralized in `apps/web/src/lib/reports/prompts.ts` with prompt-version markers.
- Report and assistant prompts now include grounding, prompt-injection resistance, senior-reviewer style, decision guardrails, and evidence-first response rules.
- Drafts autosave with dirty/saving/autosaved/error state and `beforeunload` protection.
- Review summary has a safe GitHub-flavored markdown preview.
- Workbench shows check run, sticky summary, and PR review writeback status.
- Manual `LEFT`/`RIGHT` line anchoring is available as a fallback to pointer selection.

See `docs/REVIEW_WORKBENCH.md` for details and current limits.

## Current local dev state

- Docker context: OrbStack.
- PullBrief Postgres is expected on `localhost:55432` locally when `POSTGRES_PORT=55432` is set.
- Local env files are intentionally ignored:
  - `.env`
  - `apps/web/.env.local`
- Local GitHub App real values are not configured yet.
- Local fallback remains enabled only for localhost smoke testing.

Useful commands:

```bash
docker compose up -d postgres
pnpm --filter @pullbrief/web db:migrate
pnpm --filter @pullbrief/web db:seed
pnpm --filter @pullbrief/web typecheck
pnpm --filter @pullbrief/web lint
pnpm --filter @pullbrief/web build
pnpm --filter @pullbrief/web worker:reviews
pnpm --filter @pullbrief/web reports:prune-context
```

## Verification completed

Validated during implementation:

- `pnpm --filter @pullbrief/web typecheck`
- `pnpm --filter @pullbrief/web lint`
- `pnpm --filter @pullbrief/web build`
- `pnpm --filter @pullbrief/web db:migrate`
- Browser E2E with `agent-browser`:
  - unauthenticated protected route redirects to `/sign-in`
  - seeded user login works
  - `/settings/github` renders
  - existing PR report renders
  - manual review request queues a job
  - one-shot worker processes the job
  - job page redirects to report when ready
  - `/reviews` dashboard lists the job
  - failed job error copy and retry button work
  - report history renders on report page
  - `reports:prune-context` runs successfully
  - `/reports/:id/workbench` renders with `@pierre/diffs`
  - review draft save persists to Postgres
  - review draft autosave persists body/comment edits to Postgres
  - markdown preview and manual line anchor render in the workbench
- Synthetic webhook E2E:
  - valid signed webhook is accepted/ignored safely when installation is not linked
  - invalid signature returns `401`
- Security/high-level review after hardening: no remaining blocker/high findings from reviewer.

## GitHub App setup still to do manually later

Create a real GitHub App and configure:

```text
Homepage URL: http://localhost:3000
Setup URL:    http://localhost:3000/api/github/setup
Webhook URL:  http://localhost:3000/api/github/webhooks
Callback URL: http://localhost:3000/api/github/oauth/callback
```

Required env values:

```bash
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
PULLBRIEF_ALLOWED_GITHUB_ACCOUNTS=<your-org-or-user>
PULLBRIEF_REQUIRE_GITHUB_APP=true
PULLBRIEF_ALLOW_GITHUB_TOKEN_FALLBACK=false
PULLBRIEF_CONFIRM_LOCALHOST_ONLY_FALLBACK=false
```

Recommended initial permissions:

```text
Metadata: read
Contents: read
Pull requests: read
Checks: read
Commit statuses: read
```

Writeback-ready permissions:

```text
Checks: write
Issues: write
Pull requests: write
```

Webhook events:

```text
installation
installation_repositories
pull_request
```

## Recommended next phases

### Phase 6 — AI review engine v2

Deliver richer PR analysis:

- Context builder that can include nearby source files, package/test config, CODEOWNERS, prior PR comments, and CI failures.
- Repo/tenant review rules.
- Prompt/version tracking.
- Report schema v2 with confidence, evidence, and actionable findings.
- Optional multi-pass pi workflow: summarize diff -> risk rank -> critique -> final report.

Acceptance:

- Reports cite concrete changed files and evidence.
- Heuristic fallback remains deterministic for smoke tests.
- pi prompt/schema versions are stored with the report.

### Phase 7 — Admin, audit, and operations

Deliver:

- Tenant/user admin UI.
- Invite/seed user management.
- Audit log for login, repo enable/disable, install sync, report generation, and writeback.
- Webhook delivery viewer and replay for failed deliveries.
- Rate limiting for generation and writeback.
- Data retention controls for raw patches/context.

Acceptance:

- Admins can inspect who enabled repos and published writebacks.
- Failed webhook deliveries are diagnosable.
- Sensitive raw context has a defined retention policy.

### Phase 8 — GitHub command/chat workflow

Deliver:

- `issue_comment` webhook support for commands like `/pullbrief review` or `/pullbrief explain`.
- PullBrief in-app chat over a generated report.
- Optional GitHub comment replies for approved commands.

Acceptance:

- A permitted GitHub user can trigger a review command.
- PullBrief respects tenant/repo enablement and GitHub App permissions.
- Commands never bypass PullBrief tenant policy.

## Suggested immediate next slice

Do **Phase 6: AI review engine v2** next.

The review workbench exists now. The next high-leverage slice is improving the AI review engine so workbench comments have stronger evidence: nearby files, repo rules, CODEOWNERS, prior comments, CI failures, prompt/version tracking, and report schema v2.
