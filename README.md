# PullBrief

AI PR briefings for internal GitHub review.

PullBrief turns GitHub pull requests into ranked, structured review reports: intent summaries, risk-first file ordering, logical change groups, verification notes, and later chat/comment writeback.

## Current status

This repository is a pnpm workspace with the Next.js app in `apps/web`.

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4
- Email/password auth with Better Auth
- Postgres persistence with Drizzle ORM migrations
- Tenant membership guard for report pages and report APIs
- MVP AI backend shells out to the local `pi` CLI (`pi -p ...`), not a direct OpenAI API key
- GitHub fetching currently uses a server-side token; GitHub App installation-token support is the next slice

The initial product plan is captured in [`docs/INITIAL_PLAN.md`](docs/INITIAL_PLAN.md). Phase 1 setup notes are in [`docs/PHASE_1.md`](docs/PHASE_1.md); auth/database notes are in [`docs/AUTH_DB.md`](docs/AUTH_DB.md); GitHub App setup is in [`docs/GITHUB_APP.md`](docs/GITHUB_APP.md).

## Local setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Fill BETTER_AUTH_SECRET, PULLBRIEF_SEED_EMAIL, PULLBRIEF_SEED_PASSWORD, and optional GitHub/pi envs.
docker compose up -d postgres
pnpm --filter @pullbrief/web db:migrate
pnpm --filter @pullbrief/web db:seed
pnpm --filter @pullbrief/web typecheck
pnpm --filter @pullbrief/web lint
```

For local development, run the web app from the workspace root:

```bash
pnpm dev
```

## Database commands

```bash
pnpm --filter @pullbrief/web db:generate  # create Drizzle migrations from schema changes
pnpm --filter @pullbrief/web db:migrate   # apply migrations to DATABASE_URL
pnpm --filter @pullbrief/web db:studio    # inspect local Postgres
pnpm --filter @pullbrief/web db:seed      # create/update the seeded internal user and tenant membership
```

Public sign-up is disabled at the Better Auth API hook by default. Use `db:seed` to create internal accounts.

## Workspace layout

```text
apps/web      # Next.js web app
packages/*    # Future shared packages
```
