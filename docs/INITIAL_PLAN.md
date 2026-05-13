# Open Source PR Review Assistant App Plan

> Initial product/reference plan for PullBrief. This is a planning artifact, not a binding implementation spec.

## Purpose

Build an open source pull request review application that can be plugged into any GitHub organization, user account, or selected set of repositories to make large PRs easier to understand and review than GitHub's default changed-files view.

The core pain points this should solve:

- GitHub sorts changed files alphabetically, not by review importance.
- Reviewers do not get a concise explanation of what a PR is trying to do.
- Reviewers do not get logical block summaries for related changes.
- Reviewers cannot quickly ask an LLM targeted questions before writing review comments.
- Reviewing many PRs per day is expensive because every reviewer rebuilds the same context from raw diffs.

The desired product is a Devin-like PR review app:

```text
https://review.example.com/acme/api/pull/123
```

or:

```text
https://review.example.com?pr=https://github.com/acme/api/pull/123
```

Reviewers should be able to open a GitHub PR in this app, get an AI-generated navigation/report, inspect highlighted diffs, ask questions, and eventually post selected review comments back to GitHub.

## Current Context

This section records discovery from the current workspace so the next session understands where the idea came from. Treat these as prototype inputs, not product coupling. The open source product should not assume this repository, this AWS account, this Jira instance, or this deployment shape.

Repository:

```text
/Users/kaldy/.codex/worktrees/95a9/core-hub
```

Existing AWS infra repository, reference only:

```text
~/Data/Vosime/aws-infra
```

Relevant current facts for a first prototype:

- `core-hub` already has GitHub Actions workflows in `.github/workflows/`.
- `.github/workflows/pr-checks.yml` runs on `pull_request` and already has `pull-requests: write`.
- `.github/workflows/pr-checks.yml` already auto-detects Jira issue keys in PR titles and appends a Jira ticket link to the PR body.
- `.github/workflows/build.yml` already assumes an AWS role through GitHub Actions OIDC for deployment.
- `aws-infra` is a Pulumi TypeScript AWS project in `eu-central-1` using AWS profile `vosime`; this should only influence an internal prototype, not the open source default.
- `aws-infra` already defines GitHub Actions OIDC resources and private media S3 buckets.
- Existing media buckets should not be reused for PR reports. Create a dedicated private report/artifact bucket if S3 hosting is used.
- The app should be designed as a generic open source product, not hardcoded to this repository, VosoBrands, or one Jira domain.
- Do not run `pnpm dev`.
- Do not run `pulumi up`.
- If code changes are made in `core-hub`, run `pnpm run lint` and `pnpm run typecheck`.

## Open Source Product Direction

This should be built so it can run in two modes:

- **Self-hosted:** a company deploys the app, creates its own GitHub App registration, configures its own OpenAI/Codex/Jira credentials, and installs it only where needed.
- **Hosted SaaS later:** one public GitHub App is owned by the product account, customers install it into their GitHub orgs/repos, and the service stores installation configuration per tenant.

Avoid hardcoding:

- GitHub owner names.
- Repository names.
- Jira domains.
- S3 bucket names.
- Cloud provider assumptions.
- Model/provider choices.
- Internal roles or email domains.

Core product primitives should be generic:

```text
tenant/account
github installation
repository selection
provider configuration
report
review session
weekly report
```

Repository access should be configurable per GitHub App installation:

- Install for all repositories in an account.
- Install for selected repositories only.
- In-app repository allowlist/blocklist.
- Optional per-repository settings such as default branch, Jira project keys, model profile, report retention, and auto-generation policy.

## Naming Direction

Product category:

```text
AI PR review companion
```

Alternative category labels:

```text
PR review intelligence app
Pull request briefing tool
AI code review navigation layer
```

Working product/repository name recommendation:

```text
PullBrief
```

Why:

- It clearly says "pull request brief" without needing explanation.
- It fits both the PR review view and weekly delivery reports.
- It is short enough for a GitHub repository, package name, app name, and CLI.
- It does not overpromise full automated review; it positions the product as orientation/context first.

Recommended repository/package naming:

```text
GitHub repo: pullbrief
Product name: PullBrief
CLI name, if added later: pullbrief
Package namespace, if needed later: @pullbrief/*
```

Possible tagline:

```text
AI PR briefings for any GitHub repo.
```

Other candidate names:

```text
Hunkwise
PullSignal
MergeLens
ReviewAtlas
FlowDiff
PullContext
```

Names to avoid based on obvious product/category collisions:

```text
DiffLens
PatchMap
DiffBrief
DiffDeck
DiffKit
PullFlow
ReviewFlow
ReviewPilot
ReviewScout
PatchPulse
ReviewStack
PullScope
```

Before publishing, do a final check for:

- GitHub repository name availability.
- npm package name availability, if publishing packages.
- Domain availability, if needed.
- GitHub App name availability.
- Basic trademark/search-engine conflicts.

## Product Shape

The best long-term shape is a dedicated app, not only static HTML uploaded from CI.

Static HTML is useful as an initial stepping stone, but an app enables:

- GitHub URL ingestion.
- Authenticated access to private repositories.
- Cached reports per PR commit SHA.
- One-click regeneration after PR updates.
- Interactive "ask this PR" chat.
- Highlighted diff explanations.
- Sticky PR comments linking back to the report.
- Draft review comments.
- Posting selected comments back to GitHub.
- Later agent mode that can create a fix branch or patch.
- Weekly delivery reports that summarize merged PRs, Jira ticket movement, and what changed during the week.

The product should feel like a review cockpit for any GitHub repository:

- It plugs into an organization through a GitHub App installation.
- It lets admins choose all repositories or selected repositories.
- It stores per-tenant/per-installation settings.
- It gives every enabled repository the same review workflow without requiring each repo to copy CI scripts.
- It can still offer optional CI/static-export integration for teams that want reports generated inside GitHub Actions.

## Open Source Packaging

The repository should be understandable and deployable by someone outside the original organization.

Recommended first open source shape:

```text
pullbrief/
  apps/web                 # Next.js app
  apps/worker              # report/chat/weekly-report worker
  packages/core            # GitHub PR context, ranking, report schemas
  packages/llm             # model-provider adapters
  packages/github          # GitHub App API helpers
  packages/jira            # Jira integration, optional
  packages/storage         # local/S3/S3-compatible artifact storage
  docs/
    self-hosting.md
    github-app-setup.md
    providers.md
    security.md
```

Required self-hosting docs:

- Create a private GitHub App.
- Install it on all repositories or selected repositories.
- Configure callback/webhook URLs.
- Configure Better Auth provider settings.
- Configure OpenAI or another model provider.
- Configure local filesystem storage first, then optional S3/S3-compatible storage.
- Configure Jira only if weekly reports or ticket enrichment are needed.

Provider interfaces should be explicit so the app can grow without becoming tied to one vendor:

- Git hosting provider: GitHub first; GitLab/Bitbucket possible later.
- Model provider: OpenAI first; Codex CLI/Anthropic/local models possible later.
- Issue tracker: Jira first; Linear/GitHub Issues possible later.
- Storage: local filesystem first for self-hosted; S3/S3-compatible object storage for production.
- Auth: Better Auth foundation with pluggable providers.

## Entry Points

Support several ways to open a PR:

1. Paste a GitHub PR URL into the app.
2. Direct URL route:

   ```text
   /:owner/:repo/pull/:number
   ```

3. Query-string route:

   ```text
   /review?pr=https://github.com/:owner/:repo/pull/:number
   ```

4. Bookmarklet or browser extension:

   ```javascript
   location.href = "https://review.example.com?pr=" + encodeURIComponent(location.href);
   ```

The "change github.com to devin..." style workflow is mainly URL ergonomics. For early open source use, a bookmarklet is the fastest path. Later, a browser extension can add an "Open in review app" button directly to GitHub.

## Recommended Stack

App:

- Next.js with App Router.
- TypeScript.
- Better Auth for user authentication and session management.
- Tailwind or existing team UI conventions.
- Server routes for GitHub callbacks, webhooks, report generation, and chat.

Storage:

- Postgres for reports, PR metadata, installations, users, chat messages, and cached analysis.
- Redis plus a queue for long-running report generation and chat jobs.
- S3 for generated static artifacts if needed, such as full HTML snapshots or JSON report exports.

GitHub integration:

- GitHub App that can be private for self-hosting or public for a hosted product.
- Installation tokens for repository access.
- Per-installation repository selection.
- Optional user authorization later for per-reviewer identity and "post as me" flows.

Jira/Atlassian integration:

- Extract Jira issue keys from PR title/body/branch names.
- Follow Jira links from PR title/body/branch names or existing PR automation.
- Fetch issue title, status, assignee, sprint, labels, and status history for weekly reports.
- Keep Jira credentials server-side only.
- Configure Jira per tenant/account, not globally.

AI engine:

- Use OpenAI API directly for predictable summarization and chat.
- Use Codex CLI or `openai/codex-action` later for agentic repository tasks.
- Prefer structured JSON output from the LLM, then render deterministic UI from that JSON.

Hosting options:

- Fastest: Vercel for the Next.js app plus managed Postgres/Redis.
- AWS-native: deploy to existing EKS and use AWS RDS/Redis/S3/CloudFront.
- Hetzner: viable for a small Node app and worker, but less aligned with current AWS infra.
- Generic Docker Compose for self-hosted open source deployments.

Recommendation: start with a deployment-agnostic Next.js app and a Docker Compose setup. Keep Vercel/AWS/Hetzner deployment guides as optional adapters rather than baking one platform into the app.

## GitHub App Plan

Support both private self-hosted GitHub Apps and a public product-owned GitHub App.

For a self-hosted open source install:

- The deploying organization creates its own private GitHub App.
- No GitHub verification process is required if it is only installed on the owning account.
- This is the best path for early adopters and private-company usage.

For a hosted product:

- Create a public GitHub App under the product owner's GitHub account or organization.
- Any GitHub account can install it if app visibility is public.
- GitHub Marketplace is optional. Marketplace listing/publication is the part that requires a review/approval flow.
- The app must store tenant/install configuration per GitHub installation ID.

Initial GitHub App settings:

```text
Owner: self-hosting org, personal account, or product org
Visibility: Only on this account for self-hosted private app; Any account for hosted product
Homepage URL: https://review.example.com
Webhook URL: https://review.example.com/api/github/webhook
Callback URL: https://review.example.com/api/auth/github/callback
Setup URL: https://review.example.com/github/setup
```

Initial permissions:

```text
Metadata: read
Contents: read
Pull requests: read/write
Issues: write
Checks: read
```

Optional later permissions:

```text
Contents: write       # only if the app will push fix branches
Checks: write         # only if the app will publish GitHub check results
Actions: read         # only if the app needs detailed workflow run context
```

Initial webhooks:

```text
pull_request
pull_request_review
pull_request_review_comment
issue_comment
check_run
check_suite
```

Secrets to store securely:

```text
GITHUB_APP_ID
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_PRIVATE_KEY
GITHUB_WEBHOOK_SECRET
OPENAI_API_KEY or CODEX_API_KEY
```

Use the host platform's secret store, such as AWS Secrets Manager, Vercel env vars, Doppler, 1Password, or Docker secrets. Do not commit these values.

Tenant/install configuration should include:

```text
github_installation_id
account_login
account_type
repository_selection
enabled_repository_ids
default_model_provider
default_model_name
auto_generate_on_pr_open
auto_generate_on_pr_sync
sticky_comment_enabled
weekly_reports_enabled
jira_connection_id
retention_days
```

## Authentication Model

Use Better Auth as the application user/session foundation.

Initial user setup:

- Users sign in to the review app through a configured Better Auth provider.
- GitHub identity should be linked to the app user when GitHub-specific permissions are needed.
- Store user records, sessions, linked accounts, and future role assignments through Better Auth-compatible tables.
- Keep GitHub App installation auth separate from user auth. The app can fetch repository data through installation tokens while Better Auth manages who can use the app UI.

Initial authorization can be simple:

- Any authenticated user who belongs to or is allowed by a configured tenant can view reports for installed repositories.
- Only authenticated users can ask PR chat questions.
- Only selected users or admins can trigger expensive regeneration if needed.

Future roles, configurable per tenant:

```text
admin
reviewer
viewer
agent_operator
report_viewer
```

Role ideas:

- `admin`: manage installations, model settings, retention, and Jira integration.
- `reviewer`: generate reports, ask questions, draft comments.
- `viewer`: read reports only.
- `agent_operator`: run patch-generating agent workflows.
- `report_viewer`: access weekly reports without PR comment/writeback permissions.

Phase 1 GitHub access can use app installation tokens only:

- The app acts as the installed GitHub App bot.
- It fetches PR data.
- It posts sticky comments or review comments as the bot.

Later user auth can add:

- Login with GitHub.
- Per-user access checks.
- Reviewer preferences.
- "Post this as me" workflows if needed.

Even with app-only auth, the app should verify repository access by checking the GitHub App installation, repository selection, tenant settings, and the authenticated user's access policy.

## Data Flow

Initial report generation:

```text
User opens review URL
  -> app parses owner/repo/pr number
  -> app checks GitHub App installation
  -> app fetches PR metadata
  -> app fetches changed files and patches
  -> app fetches commits, labels, reviewers, status checks
  -> app creates or reuses report record keyed by PR head SHA
  -> worker builds structured PR context
  -> LLM generates structured report JSON
  -> app renders report UI
```

Webhook refresh:

```text
pull_request opened/reopened/synchronize
  -> webhook validates signature
  -> create or update PR record
  -> enqueue report generation for new head SHA
  -> optionally post/update sticky PR comment with report link
```

Chat flow:

```text
User asks a question
  -> backend verifies user/repo access
  -> backend loads report JSON + selected file/block context
  -> backend asks LLM
  -> answer is stored and streamed/rendered to UI
```

Comment writeback:

```text
User drafts comment from explanation/chat
  -> app previews exact GitHub comment target
  -> user confirms
  -> backend posts issue comment, review comment, or review through GitHub App API
```

Agent fix flow, later:

```text
User asks agent to propose a fix
  -> worker checks out repo in isolated environment
  -> Codex CLI inspects and edits code
  -> worker runs allowed checks
  -> worker pushes branch or creates patch artifact
  -> app shows diff and lets user decide whether to open PR/comment
```

## Report Content

The generated report should include:

- PR title, author, source branch, target branch, head SHA.
- One-paragraph "what this PR is trying to do" summary.
- Reviewer-first file ordering.
- Logical change groups, not only per-file summaries.
- Per-group explanations.
- Per-file summaries.
- Inline diff explanations.
- Risk flags.
- Suggested manual review checklist.
- Suggested verification commands.
- Open questions.
- Links back to GitHub files, commits, and checks.

Suggested top-level sections:

```text
Overview
Review Order
Change Groups
Risk Areas
Files
Tests and Verification
Open Questions
Raw Metadata
```

## File Significance Ranking

Rank changed files by review significance, not alphabetically.

Signals:

- Authentication, authorization, impersonation, audit logging.
- Database schema, migrations, Drizzle schema, seeders.
- Queue processors and background jobs.
- Payment, external integrations, webhooks.
- Public API contracts, GraphQL schemas, REST endpoints.
- Shared helpers and cross-module services.
- Config, secrets, infra, deployment.
- High line count or high fan-out imports.
- Test coverage added or missing.
- Generated files should usually be lower priority unless contract output changed.
- Docs-only files should usually be lower priority unless they define product/API contracts.

The product should also support repository-specific review profiles. These can come from checked-in files such as `AGENTS.md`, `CLAUDE.md`, `CODEOWNERS`, `.github/pull_request_template.md`, or app-level admin settings. The generic engine should treat these as tenant/repository configuration, not product defaults.

Examples from the current workspace that should become a local repository profile:

- Writes should use `drizzle.write()` or `drizzle.transaction()`.
- Queue/worker modules should depend on exported core services across boundaries.
- Franchise impersonation changes are high risk.
- Product REST/webhook snapshot contract changes should point to `/docs/Product-REST-Webhook-Contract.md`.
- Product manual/cache/category behavior has several known guardrails in `AGENTS.md`.

## Structured Report JSON

Do not ask the LLM to directly generate final HTML. Ask it to produce JSON that matches a schema. Render HTML/UI deterministically from that JSON.

Example shape:

```json
{
  "prSummary": {
    "intent": "string",
    "businessImpact": "string",
    "technicalImpact": "string",
    "reviewerFocus": ["string"]
  },
  "riskAreas": [
    {
      "level": "low|medium|high",
      "title": "string",
      "reason": "string",
      "files": ["string"]
    }
  ],
  "changeGroups": [
    {
      "title": "string",
      "summary": "string",
      "files": ["string"],
      "reviewNotes": ["string"]
    }
  ],
  "rankedFiles": [
    {
      "path": "string",
      "rank": 1,
      "reason": "string",
      "summary": "string",
      "riskLevel": "low|medium|high"
    }
  ],
  "verification": {
    "suggestedCommands": ["string"],
    "manualChecks": ["string"],
    "missingTests": ["string"]
  },
  "openQuestions": ["string"]
}
```

Keep raw PR data separately from model output:

```text
pr_context.json     # deterministic GitHub-derived input
report.json         # model-generated structured analysis
report.html         # deterministic rendered static export, optional
```

## Codex CLI and OpenAI Usage

Codex CLI can run non-interactively in CI with `codex exec`.

Useful patterns:

```bash
codex exec \
  --ephemeral \
  --sandbox read-only \
  --output-schema .github/codex/pr-report.schema.json \
  -o .tmp/pr-report/report.json \
  "Read .tmp/pr-report/context.json and produce the PR review report JSON."
```

For GitHub Actions, the official action can also be used:

```yaml
- name: Run Codex
  uses: openai/codex-action@v1
  with:
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    prompt-file: .github/codex/prompts/pr-report.md
    output-file: .tmp/pr-report/report.json
    safety-strategy: drop-sudo
    sandbox: workspace-write
```

Recommended split:

- Use direct OpenAI API calls for the normal app report/chat path.
- Use Codex CLI for agentic tasks where it needs to inspect a checkout, run commands, or propose patches.
- Use structured output schemas wherever the output feeds UI or automation.

## Static HTML and Artifact Discussion

The first idea was to generate static HTML from CI and upload it somewhere.

This remains useful as an MVP or fallback:

```text
PR opened/synchronized
  -> GitHub Actions computes diff context
  -> LLM creates report JSON
  -> renderer creates index.html
  -> upload artifact or S3 object
  -> PR comment links to report
```

GitHub Actions artifacts:

- Good for storing generated files.
- Not good for one-click HTML viewing.
- Artifact URLs are download links, not normal hosted pages.
- Users must be logged in.
- Artifacts have retention, default often 90 days but configurable per artifact.
- Artifact storage counts against GitHub Actions storage allowance.

Job summaries:

- Good for a short Markdown report on the workflow run page.
- Use `$GITHUB_STEP_SUMMARY`.
- Not enough for a rich, large, interactive report.
- Good complement to a PR comment.

GitHub Pages:

- Good for public static hosting.
- Risky for private PR diffs unless private Pages access control is available and configured.
- Do not put private source diffs on public Pages.

S3/CloudFront:

- Best fit for private static report hosting if we want full HTML export.
- Use a dedicated private bucket, not media buckets.
- Add lifecycle expiry, for example 30 or 60 days.
- Require auth in front of the report if private code/diffs are included.

Suggested dedicated S3 layout:

```text
s3://<configured-report-bucket>/
  <owner>/
    <repo>/
      pr-123/
        sha-abcdef/
          index.html
          report.json
          context.json
```

For non-AWS deployments, the same logical paths can be stored in any S3-compatible object storage:

```text
reports/
  <owner>/
    <repo>/
      pr-123/
        sha-abcdef/
          index.html
          report.json
          context.json
```

## Security Requirements

Treat PR diffs as private source code.

Requirements:

- No public report URLs unless intentionally approved.
- Validate GitHub webhook signatures.
- Verify repository access before showing reports, including tenant, installation, repository selection, and user policy.
- Store GitHub private key and webhook secret in Secrets Manager or equivalent.
- Use least-privilege GitHub App permissions.
- Do not grant `Contents: write` until agent writeback is intentionally built.
- Do not expose OpenAI/Codex API keys to the browser.
- Server-side LLM calls only.
- Log metadata, not raw secrets.
- Redact tokens and environment values from model context.
- Add rate limits for report generation and chat.
- Cache reports by PR head SHA to avoid repeated model spend.
- Use a separate isolated environment for patch-generating agents.
- Keep tenant data isolated. Never let one installation access another installation's PR context, report data, Jira data, or chat history.
- For hosted SaaS, support deleting tenant data when a GitHub App installation is removed.

## Suggested Database Tables

Minimal schema.

Better Auth should own or define the canonical auth/session tables. Keep custom app-specific role and preference tables adjacent to that setup rather than inventing a separate auth system.

App-specific auth/role tables:

```text
tenants
  id
  name
  slug
  plan
  default_retention_days
  created_at
  updated_at

tenant_members
  id
  tenant_id
  user_id
  role
  created_at
  updated_at

user_roles
  id
  tenant_id
  user_id
  role
  created_at
  updated_at

user_preferences
  id
  tenant_id
  user_id
  default_repository_filter
  default_weekly_report_repos
  created_at
  updated_at

model_provider_configs
  id
  tenant_id
  provider
  encrypted_api_key_ref
  default_model
  enabled
  created_at
  updated_at

object_storage_configs
  id
  tenant_id
  provider
  bucket
  region
  endpoint
  encrypted_credentials_ref
  created_at
  updated_at
```

GitHub/PR tables:

```text
github_installations
  id
  tenant_id
  github_installation_id
  account_login
  account_type
  repository_selection
  settings_json
  created_at
  updated_at

repositories
  id
  tenant_id
  installation_id
  owner
  name
  github_repository_id
  default_branch
  enabled
  settings_json
  created_at
  updated_at

pull_requests
  id
  tenant_id
  repository_id
  number
  title
  author_login
  base_ref
  head_ref
  head_sha
  state
  html_url
  created_at
  updated_at

pr_reports
  id
  tenant_id
  pull_request_id
  head_sha
  status
  model_provider
  model_name
  context_s3_key
  report_s3_key
  html_s3_key
  report_json
  error_message
  created_at
  updated_at

chat_sessions
  id
  tenant_id
  pull_request_id
  report_id
  user_id
  created_at
  updated_at

chat_messages
  id
  chat_session_id
  role
  content
  referenced_file
  referenced_hunk
  created_at

github_comments
  id
  tenant_id
  pull_request_id
  report_id
  github_comment_id
  comment_type
  body
  created_at
```

Jira and weekly-report tables:

```text
jira_connections
  id
  tenant_id
  site_url
  encrypted_credentials_ref
  enabled_project_keys
  created_at
  updated_at

jira_issues
  id
  tenant_id
  jira_connection_id
  jira_key
  site_url
  title
  issue_type
  status
  assignee
  project_key
  sprint
  labels
  raw_json
  jira_updated_at
  created_at
  updated_at

jira_status_events
  id
  tenant_id
  jira_issue_id
  from_status
  to_status
  changed_at
  actor
  raw_json
  created_at

pull_request_jira_issues
  id
  tenant_id
  pull_request_id
  jira_issue_id
  source
  created_at

weekly_reports
  id
  tenant_id
  week_start
  week_end
  repository_filter
  status
  model_provider
  model_name
  report_json
  html_s3_key
  error_message
  created_by_user_id
  created_at
  updated_at

weekly_report_pull_requests
  id
  weekly_report_id
  pull_request_id
  created_at

weekly_report_jira_issues
  id
  weekly_report_id
  jira_issue_id
  created_at
```

## API Surface

Suggested routes:

```text
GET  /                                  # paste PR URL
GET  /:owner/:repo/pull/:number         # report page
GET  /reports/week/current              # current weekly delivery report
GET  /reports/week/:week                # weekly delivery report by ISO week
GET  /settings/installations            # tenant GitHub App installations and repositories
GET  /settings/providers                # model/Jira/storage provider config
POST /api/reports                       # create/generate report
GET  /api/reports/:id                   # get report status/data
POST /api/reports/:id/regenerate        # regenerate current head SHA
POST /api/weekly-reports                # create/generate weekly report
GET  /api/weekly-reports/:id            # get weekly report status/data
POST /api/weekly-reports/:id/regenerate # regenerate weekly report
POST /api/chat                          # ask a question
POST /api/github/webhook                # GitHub webhook receiver
GET  /api/auth/github/callback          # optional user OAuth callback
POST /api/github/comments               # post selected comment/review
POST /api/settings/repositories         # enable/disable repositories for tenant
POST /api/settings/providers            # configure model/Jira/storage providers
GET  /api/auth/*                        # Better Auth routes
```

## UI Plan

Primary report page layout:

- Header with PR title, repo, author, base/head, status, head SHA.
- Left sidebar with ranked file list and change groups.
- Main panel with report sections.
- Diff viewer with syntax highlighting.
- Inline AI explanations per hunk.
- Chat panel that can reference selected file/hunk.
- Actions bar:
  - Regenerate report.
  - Copy summary.
  - Post/update sticky PR comment.
  - Draft review comment.

States:

- Not installed: show GitHub App install/setup instructions.
- Not signed in: show Better Auth sign-in flow.
- Signed in without role: show minimal access or "request access" screen.
- No report yet: show generate button and queue status.
- Report generating: show progress.
- Report ready: show full report.
- PR updated: show "new head SHA available, regenerate".
- Error: show retry and diagnostic details.

Weekly report page layout:

- Header with week range, repository filters, generation status, and share/export actions.
- Executive summary band with the main "what changed this week" narrative.
- Merged PR list with PR links, authors, merge dates, Jira links, and short summaries.
- Jira movement section showing status transitions such as `In Progress -> Done`.
- Grouped summary by domain/repository/project.
- Follow-up section for risks, incomplete Jira transitions, unlinked PRs, and tickets that moved without merged PR evidence.

## PR Sticky Comment

The app should eventually maintain one sticky PR comment:

```markdown
<!-- pr-review-assistant-report -->
## PR Review Report

Report for `abcdef1` is ready:

[Open review report](https://review.example.com/acme/api/pull/123)

Summary:
- ...

Reviewer focus:
- ...
```

Use an HTML marker to find and update the existing comment rather than creating a new comment on every synchronize event.

## Weekly Delivery Reports

Add a weekly report feature as a separate but related product surface.

Goal:

- Give the team a clean weekly view of what was merged, what changed, and what Jira work moved.
- Turn raw PR/Jira activity into a readable delivery summary for leads, reviewers, and stakeholders.
- Reuse PR report summaries instead of asking every person to reconstruct the week from merged PRs.

Suggested weekly report route:

```text
/reports/week/2026-W20
/reports/week/current
```

Suggested report inputs:

- Merged PRs in selected repositories during the week.
- PR titles, authors, reviewers, merge times, labels, changed files, and report summaries.
- Jira issue keys linked in PR title/body/branch name.
- Jira ticket title, issue type, assignee, project, sprint, labels, current status, and status transitions during the week.
- CI status and deployment indicators if useful.

Suggested weekly report sections:

```text
Executive Summary
Merged PRs
What Changed
Jira Movement
Risk and Follow-ups
By Repository
By Author
By Jira Project
Unlinked PRs
```

The UI should be a polished report page, not just a table:

- Timeline of merged PRs.
- Cards or rows for each PR with the AI summary, author, links to GitHub and Jira.
- Grouped "what changed" summary by product/domain area.
- Jira movement summary: tickets moved from one status to another.
- Highlight tickets that were merged but not moved in Jira, and Jira tickets moved without a linked merged PR.
- Export or share link for the weekly report.

Weekly report flow:

```text
Scheduled job or user opens current week
  -> fetch merged PRs for selected repos and date range
  -> extract Jira issue keys
  -> load existing PR report summaries or generate missing summaries
  -> fetch Jira issue metadata and transition history
  -> LLM creates weekly structured report JSON
  -> app renders weekly report UI
```

Jira link extraction should support:

```text
PR title: ITE-123 Add branch search
PR body: https://example.atlassian.net/browse/ITE-123
Branch: feature/ITE-123-branch-search
Commit messages, if needed later
```

Weekly report generation should be cacheable by:

```text
organization
repository set
week start/end
included PR merge SHAs
Jira issue updated timestamps
```

This feature can be implemented after the PR report foundation because it reuses:

- GitHub App installation auth.
- Better Auth user/session model.
- PR metadata ingestion.
- PR report summaries.
- Structured LLM report generation.
- Report rendering components.

## Implementation Phases

### Phase 0: Static Spike

Goal: prove report quality before building the full app.

Deliverables:

- Script that builds deterministic PR context JSON from a local checkout or GitHub API.
- JSON schema for model output.
- Renderer that turns `report.json` into an HTML or Markdown report.
- GitHub Actions job or local command to test on one PR.

Do not solve auth/chat yet.

### Phase 1: Minimal App

Goal: paste PR URL and view generated report.

Deliverables:

- New Next.js project.
- URL parser for GitHub PR URLs.
- Manual GitHub token or app token configured server-side for early testing.
- Generate report from GitHub API data.
- Store report in database.
- Render report page.

### Phase 2: GitHub App Installations

Goal: production-safe access to private repositories across any configured GitHub account.

Deliverables:

- Self-hosted private GitHub App setup guide.
- Hosted public GitHub App path, if building SaaS mode.
- Webhook receiver with signature validation.
- Installation token generation.
- Per-installation tenant setup.
- Repository selection and repository allowlist handling.
- Repository/PR access checks across tenant, installation, repository, and user policy.
- Report generation on `pull_request` events.
- Sticky PR comment with app link.

### Phase 3: Better Review UI

Goal: make the app better than GitHub's changed-files view.

Deliverables:

- Ranked changed-file navigation.
- Change groups.
- Diff viewer with syntax highlighting.
- Risk badges.
- Suggested verification checklist.
- Links to relevant GitHub files/checks.

### Phase 4: Chat With PR

Goal: ask quick verification questions.

Deliverables:

- Chat panel scoped to the PR report.
- Context selection by file/hunk/group.
- Stored chat history.
- Rate limiting.
- Server-side LLM calls only.

### Phase 5: Review Comment Writeback

Goal: help reviewers turn insights into comments.

Deliverables:

- Draft comment UX.
- Post issue comments.
- Post inline review comments where line mapping is reliable.
- Batch comments into a GitHub review.
- Clear preview before posting.

### Phase 6: Agent Fix Mode

Goal: optionally propose fixes.

Deliverables:

- Isolated checkout worker.
- Codex CLI integration.
- Allowed command policy.
- Patch preview.
- Optional branch push or PR comment with patch.
- Add `Contents: write` only if branch pushing is implemented.

### Phase 7: Weekly Reports

Goal: summarize weekly delivery across merged PRs and linked Jira tickets.

Deliverables:

- Date-range and repository filters.
- Merged PR ingestion for the selected week.
- Jira issue-key extraction from PR title/body/branch.
- Jira integration configured server-side.
- Jira status movement summary.
- AI-generated weekly structured report JSON.
- Weekly report UI with PR links, Jira links, and grouped summaries.
- Detection of missing Jira links or PR/Jira status mismatches.

## MVP Recommendation

Start with a small app, not S3-only static HTML.

Smallest valuable MVP:

- Next.js app.
- Better Auth sign-in and session setup.
- Self-hosted GitHub App setup with read access to selected repositories.
- Tenant/install configuration keyed by GitHub installation ID.
- Paste/open PR URL.
- Generate structured report JSON.
- Render report UI.
- Sticky PR comment link.

Do not include chat or writeback in the first cut. Design the report data model so chat can reuse it later.

## Open Questions

- Where should the app be hosted first: Vercel, EKS, or Hetzner?
- Should users log in with GitHub in phase 1, or should org-level app installation be enough?
- Should reports include full raw diffs in app storage, or fetch diffs live from GitHub when viewed?
- How long should reports be retained?
- Should report generation run automatically for every PR, or only when a reviewer opens the app?
- Which model should be the default for report generation?
- Should the first release optimize for self-hosted only, or include hosted SaaS assumptions from day one?
- Should the public product-owned GitHub App exist immediately, or only after self-hosted mode is stable?
- Which Better Auth provider should be used first?
- Should initial roles be configured manually in the database/admin UI, or derived from GitHub organization/team membership?
- Should tenant membership be inferred from GitHub organization/team membership or managed entirely inside the app?
- Which model providers should be first-class in the open source config: OpenAI only, Codex CLI, Anthropic, local Ollama?
- Which object storage providers should be documented first: local filesystem, S3, S3-compatible storage?
- Which Jira projects should weekly reports include by default?
- Should weekly reports be generated automatically on a schedule, manually by a user, or both?
- Should Jira status transitions be read live every time or snapshotted into our database?
- Should weekly reports be shared only inside the app, or also posted to Slack/Confluence later?

## Useful References

- Better Auth Next.js integration: https://www.better-auth.com/docs/integrations/next
- Better Auth organization/roles plugin: https://better-auth.com/docs/plugins/organization
- GitHub App registration: https://docs.github.com/en/apps/creating-github-apps/creating-github-apps/creating-a-github-app
- GitHub App private/public visibility: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/making-a-github-app-public-or-private
- GitHub Marketplace publication review: https://docs.github.com/en/apps/github-marketplace/listing-an-app-on-github-marketplace/submitting-your-listing-for-publication
- Jira Cloud REST API issues/changelog: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
- Codex non-interactive mode: https://developers.openai.com/codex/noninteractive
- Codex GitHub Action: https://developers.openai.com/codex/github-action
- GitHub Actions artifacts: https://docs.github.com/en/actions/tutorials/store-and-share-data
- GitHub Actions job summaries: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- GitHub Pages visibility: https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site

## Next Session Quick Start

1. Read this file.
2. Create a new open source repository named `pullbrief` unless a different name is chosen.
3. Create the minimal Next.js app skeleton.
4. Set up Better Auth for users and sessions.
5. Add the first role model, even if it is only `admin` and `reviewer`.
6. Add tenant/install configuration tables.
7. Register a self-hosted private GitHub App for the first test account.
8. Implement PR URL parsing and GitHub App installation-token auth.
9. Implement repository selection/allowlist checks.
10. Fetch PR metadata, files, patches, commits, and checks.
11. Build `pr_context.json`.
12. Define `pr_report.schema.json`.
13. Generate a report with OpenAI API or Codex CLI.
14. Render the report page.
15. Add sticky PR comment linking to the report.
16. Add weekly-report scaffolding only after PR summaries are working.
