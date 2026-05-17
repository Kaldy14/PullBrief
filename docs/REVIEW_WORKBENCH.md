# Review Workbench

PullBrief Phase 5 adds an in-app review workbench for speeding up senior PR review with ranked summaries, viewed-file tracking, private AI notes, and contextual AI chat over diff selections.

## Product pattern

The workbench follows established PR-review practices from GitHub, CodeRabbit, reviewdog, and similar tools:

- AI output is advisory and private until the reviewer chooses otherwise.
- The diff is the primary surface; writeback controls must not dominate the workbench.
- Reviewers can mark files viewed and keep moving.
- Reviewers can chat with AI immediately about a selected line/range.
- Reviewers can collect private notes for AI and discuss them in bulk later.
- The diff view is powered by `@pierre/diffs`; PullBrief does not implement its own diff renderer.

## Routes

```text
GET  /reports/:id/workbench
GET  /api/reports/:id/review-draft
PUT  /api/reports/:id/review-draft
POST /api/reports/:id/review-draft/submit
POST /api/reports/:id/ai/clarify
POST /api/reports/:id/github/writeback
```

## Draft reviews

Draft review state is stored in Postgres:

- `review_drafts` stores the selected review event and summary body.
- `review_draft_comments` stores pending line comments with GitHub `line`, `side`, `start_line`, and `start_side` coordinates.

Drafts are scoped by tenant, report, and PullBrief user.

## Diff source

The workbench uses a hybrid diff source:

1. Render stored GitHub file patches from the report context.
2. If patches were pruned or missing, fetch fresh PR context from GitHub through the tenant-scoped installation token.
3. If neither is available, show a per-file unavailable state.

The UI uses `@pierre/diffs/react` `PatchDiff` with line selection and annotations.

## GitHub submit semantics

Submitting a draft calls GitHub's create PR review endpoint with:

- explicit `event`: `COMMENT`, `REQUEST_CHANGES`, or `APPROVE`
- report head SHA as `commit_id`
- review body
- collected line comments

PullBrief uses modern `line`/`side` fields instead of deprecated diff `position` where possible.

## AI clarification

The workbench can ask pi follow-up questions about the selected report/file/line. This is separate from publishing to GitHub. Answers can be copied into the draft review as AI-suggested comments.

## Hardening implemented

- The permanent right-side writeback panel was removed.
- Workbench is now a two-column diff-first layout: ranked files on the left, diff on the main surface.
- Files can be marked viewed; viewed state is stored locally per report.
- Diff AI actions are invoked through a custom right-click context menu inside the diff viewer.
- Context menu actions: explain selection, ask with instruction, save private note.
- Fast AI answers appear in an anchored popover near the selected diff context.
- Follow-up chat expands into a bottom AI thread drawer instead of a modal or permanent side panel.
- Private AI notes autosave after edits and show dirty/saving/autosaved/error state.
- The AI note queue opens as a bottom drawer and can send queued notes to AI for risk synthesis.

## Current limits

- The first workbench uses one active private AI-note draft per user/report.
- Text selections are captured opportunistically from the diff viewer, but durable anchors are still line/range based through `@pierre/diffs`.
- Chat history is local to the open AI thread drawer; persisted AI threads are still future work.
- Inline GitHub posting and formal PR review submission should be reintroduced later as secondary actions, not as the primary workbench surface.
