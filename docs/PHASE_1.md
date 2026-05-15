# Phase 1: Minimal App

Phase 1 implements the first end-to-end PullBrief loop:

```text
paste GitHub PR URL -> fetch PR context from GitHub -> generate structured report with pi CLI -> store in Postgres -> render report page
```

It intentionally does not solve GitHub App installation auth, chat, webhooks, sticky comments, or writeback. Those remain later phases in `docs/INITIAL_PLAN.md`.

## What is implemented

- Next.js App Router route for direct PR reports:

  ```text
  /:owner/:repo/pull/:number
  ```

- Query-string entry point:

  ```text
  /review?pr=https://github.com/:owner/:repo/pull/:number
  ```

- Functional PR URL form on the home page.
- GitHub PR URL parser with host validation.
- Server-side GitHub API client that fetches:
  - PR metadata
  - changed files and patches
  - commits
  - check runs and commit statuses when accessible
- Structured report schema in `docs/schemas/pr-report.schema.json`.
- pi harness report generation through `pi -p` print mode.
- Deterministic heuristic fallback when pi is unavailable, unauthenticated, times out, or returns invalid JSON.
- Postgres report database keyed by tenant, PR, and head SHA.
- Better Auth email/password login for seeded internal users.
- Report page with overview, decision, risks, change groups, ranked files, verification, open questions, and metadata.
- Minimal API surface:
  - `POST /api/reports`
  - `GET /api/reports/:id`

## Local setup

Copy the env example and start Postgres:

```bash
cp apps/web/.env.example apps/web/.env.local
# Fill BETTER_AUTH_SECRET, PULLBRIEF_SEED_EMAIL, and PULLBRIEF_SEED_PASSWORD.
docker compose up -d postgres
pnpm --filter @pullbrief/web db:migrate
pnpm --filter @pullbrief/web db:seed
```

For public repositories, a GitHub token is optional but recommended because unauthenticated rate limits are low.

For private repositories, configure:

```bash
PULLBRIEF_GITHUB_TOKEN=github_pat_...
```

Use a fine-grained token scoped only to the repositories you test. The token should have read access to metadata, contents, pull requests, and checks.

## pi setup for report generation

MVP report generation does not use an OpenAI API key directly. It shells out to the local pi harness.

Install pi and authenticate once as the same OS user that runs the web app:

```bash
npm install -g @earendil-works/pi-coding-agent
pi
/login
```

Select the ChatGPT/Codex provider during login. PullBrief then runs pi in print mode with no tools and no session:

```bash
pi --no-session --no-tools --no-context-files --no-skills --no-prompt-templates --no-extensions -p "Generate a PullBrief PR review report as JSON."
```

The app sends compact `pr_context` JSON on stdin and asks pi to return only `pullbrief.report.v1` JSON matching `docs/schemas/pr-report.schema.json`.

Relevant env knobs:

```bash
PULLBRIEF_PI_COMMAND=pi
# optional, otherwise pi uses its configured default model
PULLBRIEF_PI_MODEL=<pi-model-id>
PULLBRIEF_PI_TIMEOUT_MS=180000
PULLBRIEF_ALLOW_HEURISTIC_FALLBACK=true
```

For offline UI testing without pi, set:

```bash
PULLBRIEF_AI_BACKEND=heuristic
```

## Database

Reports and auth state are stored in Postgres using Drizzle migrations.

```bash
DATABASE_URL=postgresql://pullbrief:pullbrief@localhost:5432/pullbrief
pnpm --filter @pullbrief/web db:generate
pnpm --filter @pullbrief/web db:migrate
pnpm --filter @pullbrief/web db:seed
```

See `docs/AUTH_DB.md` for the auth/database setup and security model.

## Usage

From the workspace root:

```bash
pnpm dev
```

Then sign in at `/sign-in` and paste a PR URL on `/`, or open:

```text
http://localhost:3000/review?pr=https://github.com/OWNER/REPO/pull/NUMBER
```

The app generates a report and redirects to:

```text
http://localhost:3000/OWNER/REPO/pull/NUMBER
```

A report is reused while the PR head SHA stays the same. Use **Regenerate current head** on the report page to force a refresh.

## API examples

Generate or reuse a report (requires a Better Auth session cookie):

```bash
curl -X POST http://localhost:3000/api/reports \
  -H 'content-type: application/json' \
  -d '{"prUrl":"https://github.com/OWNER/REPO/pull/NUMBER"}'
```

Force regeneration:

```bash
curl -X POST http://localhost:3000/api/reports \
  -H 'content-type: application/json' \
  -d '{"prUrl":"https://github.com/OWNER/REPO/pull/NUMBER","force":true}'
```

Fetch a stored report (requires a Better Auth session cookie):

```bash
curl http://localhost:3000/api/reports/REPORT_ID
```

Include raw GitHub context, including patches:

```bash
curl 'http://localhost:3000/api/reports/REPORT_ID?includeContext=1'
```

## Security notes

Public sign-up is disabled at the Better Auth API hook. Users must be seeded and must have a `tenant_members` row before accessing report pages or report APIs.

Do not expose the app broadly with private repo access until the next GitHub App slice adds installation tokens, repository allowlists, and webhook signature validation.

pi runs as the web app's OS user. Phase 1 invokes it with `--no-tools`, but the installation and login state still belong to that user account. Treat that account as part of the app's trusted server-side runtime.
