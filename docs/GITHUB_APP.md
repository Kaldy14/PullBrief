# GitHub App integration

PullBrief is wired to use GitHub App installations as the secure path for private PR review.

## GitHub App registration

Create a GitHub App with these URLs for local development:

```text
Homepage URL: http://localhost:3000
Setup URL:    http://localhost:3000/api/github/setup
Webhook URL:  http://localhost:3000/api/github/webhooks
Callback URL: http://localhost:3000/api/github/oauth/callback
```

Enable **Redirect on update** for the setup URL so repository additions/removals return to PullBrief and sync the allowlist. The callback URL is used for GitHub user authorization during setup verification.

## Environment

```bash
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
# Comma-separated GitHub org/user accounts this deployment may link. Required in production.
PULLBRIEF_ALLOWED_GITHUB_ACCOUNTS=your-org
PULLBRIEF_REQUIRE_GITHUB_APP=true
PULLBRIEF_ALLOW_GITHUB_TOKEN_FALLBACK=false
PULLBRIEF_CONFIRM_LOCALHOST_ONLY_FALLBACK=false
# Local-only bypass for setup verification, do not use in shared/prod deployments.
# PULLBRIEF_SKIP_GITHUB_USER_INSTALL_VERIFICATION=true
```

`GITHUB_APP_PRIVATE_KEY` can be the PEM contents with literal newlines or escaped `\n` newlines.

## Permissions

Minimum read/review mode:

```text
Metadata: read
Contents: read
Pull requests: read
Checks: read
Commit statuses: read
```

Writeback-ready mode:

```text
Checks: write          # PullBrief check runs
Issues: write          # sticky PR conversation comments
Pull requests: write   # PR reviews / review comments
```

Avoid broad permissions like Administration or Contents write unless a future feature explicitly needs them.

## Webhook events

Subscribe initially to:

```text
installation
installation_repositories
pull_request
```

Later writeback/command workflows can add:

```text
check_run
issue_comment
pull_request_review
pull_request_review_comment
```

## Implemented flow

1. A tenant admin opens `/settings/github`.
2. PullBrief creates a one-time install state row and redirects to:

   ```text
   https://github.com/apps/<app-slug>/installations/new?state=<state>
   ```

3. GitHub redirects back to `/api/github/setup?installation_id=...&setup_action=...&state=...`.
4. PullBrief redirects to GitHub user authorization and verifies the authorized user can access the installation.
5. PullBrief verifies the installation account is in `PULLBRIEF_ALLOWED_GITHUB_ACCOUNTS`.
6. PullBrief fetches installation metadata with the GitHub App and syncs repositories as disabled by default.
7. A PullBrief admin enables selected repositories in `/settings/github`.
8. Report generation resolves the PR repository against the tenant allowlist and mints a short-lived installation token for GitHub API reads.
9. `/api/github/webhooks` validates `X-Hub-Signature-256` before storing and handling delivery payloads.

## Implemented storage

- `github_install_states` — one-time install CSRF/correlation state.
- `github_installations` — installation account, permissions, events, lifecycle state.
- `repositories` — tenant repo allowlist and GitHub metadata; newly synced GitHub App repos start disabled until an admin enables them.
- `github_webhook_deliveries` — idempotent webhook delivery log.
- `review_jobs` — queued review intent from webhook/manual triggers; worker comes next.
- `github_report_writebacks` — check/comment/review artifacts published to GitHub.

## Implemented APIs

```text
GET  /api/github/install/start
GET  /api/github/setup
GET  /api/github/oauth/callback
GET  /api/github/repositories
PATCH /api/github/repositories
POST /api/github/webhooks
POST /api/reports/:id/github/writeback
GET  /api/reports/:id/review-draft
PUT  /api/reports/:id/review-draft
POST /api/reports/:id/review-draft/submit
POST /api/reports/:id/ai/clarify
```

## Current limits

- Setup callback validation uses PullBrief session + one-time state + GitHub user authorization to verify the installation is visible to the installing user. Local-only bypass is available with `PULLBRIEF_SKIP_GITHUB_USER_INSTALL_VERIFICATION=true`.
- PAT/public fallback requires `PULLBRIEF_ALLOW_GITHUB_TOKEN_FALLBACK=true`, `PULLBRIEF_CONFIRM_LOCALHOST_ONLY_FALLBACK=true`, and a localhost app URL. Production always fails closed.
- Review workbench submit requires a real GitHub App installation with `Pull requests: write`; localhost PAT fallback is not used for writeback.
