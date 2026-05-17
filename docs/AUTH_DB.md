# Auth and Postgres foundation

PullBrief now uses Postgres for report persistence and Better Auth for internal email/password login.

## Local setup

```bash
cp apps/web/.env.example apps/web/.env.local
# Fill BETTER_AUTH_SECRET, PULLBRIEF_SEED_EMAIL, PULLBRIEF_SEED_PASSWORD.
docker compose up -d postgres
pnpm --filter @pullbrief/web db:migrate
pnpm --filter @pullbrief/web db:seed
```

If local port `5432` is already in use, run Postgres on another host port and update `DATABASE_URL`:

```bash
POSTGRES_PORT=55432 docker compose up -d postgres
DATABASE_URL=postgresql://pullbrief:pullbrief@localhost:55432/pullbrief pnpm --filter @pullbrief/web db:migrate
```

## Security model in this slice

- Public sign-up is disabled in the Better Auth backend hook for `/sign-up/email`.
- Users are created by `pnpm --filter @pullbrief/web db:seed` from `PULLBRIEF_SEED_*` env vars.
- Private report pages and report APIs require a signed-in user with at least one `tenant_members` row.
- Reports are scoped by `tenant_id`; `/api/reports/:id` only reads records for the authenticated tenant.
- PR context and generated reports are stored in `pr_reports.context_json` and `pr_reports.report_json`.

## Current tables

- Better Auth: `user`, `session`, `account`, `verification`
- Tenant/authz: `tenants`, `tenant_members`
- GitHub App: `github_install_states`, `github_installations`, `repositories`, `github_webhook_deliveries`
- Review data: `pull_requests`, `pr_reports`, `review_jobs`, `github_report_writebacks`

GitHub App installation storage, repository allowlists, webhook delivery logs, queued review jobs, and writeback artifact tracking are implemented. See `docs/GITHUB_APP.md` for setup and permissions, and `docs/STATUS_AND_ROADMAP.md` for the complete status/roadmap.
