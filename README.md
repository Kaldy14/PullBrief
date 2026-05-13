# PullBrief

AI PR briefings for any GitHub repo.

PullBrief is an open source PR review companion that turns GitHub pull requests into ranked, structured review reports: intent summaries, risk-first file ordering, logical change groups, verification notes, and later chat/comment writeback.

## Current status

This repository is initialized as a pnpm workspace with the first Next.js app in `apps/web`.

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn UI initialized in `apps/web`

The initial product plan is captured in [`docs/INITIAL_PLAN.md`](docs/INITIAL_PLAN.md).

## Commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
```

For local development, run the web app from the workspace root:

```bash
pnpm dev
```

## Workspace layout

```text
apps/web      # Next.js web app
packages/*    # Future shared packages
```
