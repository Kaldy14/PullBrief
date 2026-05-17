# @pullbrief/web

Next.js web app for PullBrief.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Better Auth email/password auth
- Drizzle ORM + Postgres persistence
- Local pi CLI report generation

## Setup

```bash
cp .env.example .env.local
# Fill BETTER_AUTH_SECRET, PULLBRIEF_SEED_EMAIL, PULLBRIEF_SEED_PASSWORD.
cd ../..
docker compose up -d postgres
pnpm --filter @pullbrief/web db:migrate
pnpm --filter @pullbrief/web db:seed
```

Configure a GitHub App for private repositories (see `../../docs/GITHUB_APP.md`). Run the review worker separately for queued jobs (see `../../docs/REVIEW_JOBS.md`). Report UX/retention details live in `../../docs/REPORT_UX_AND_RETENTION.md`; review workbench details live in `../../docs/REVIEW_WORKBENCH.md` and `../../docs/REVIEW_WORKBENCH_PRODUCT_NOTES.md`. Pi prompt details live in `../../docs/PI_PROMPTS.md`. See `../../docs/STATUS_AND_ROADMAP.md` for current status and next phases. `PULLBRIEF_GITHUB_TOKEN` can remain enabled only as an explicit localhost smoke-test fallback. Install pi and authenticate with `/login` for model-generated reports; otherwise set `PULLBRIEF_AI_BACKEND=heuristic` for local UI testing.

## Scripts

```bash
pnpm --filter @pullbrief/web db:generate
pnpm --filter @pullbrief/web db:migrate
pnpm --filter @pullbrief/web db:seed
pnpm --filter @pullbrief/web worker:reviews
pnpm --filter @pullbrief/web worker:reviews:once
pnpm --filter @pullbrief/web reports:prune-context
pnpm --filter @pullbrief/web lint
pnpm --filter @pullbrief/web typecheck
pnpm --filter @pullbrief/web build
```
