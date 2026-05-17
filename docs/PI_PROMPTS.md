# PullBrief pi prompts

PullBrief uses the local `pi` CLI for report generation and in-review chat. Prompt text lives in:

```text
apps/web/src/lib/reports/prompts.ts
```

Current prompt versions:

```text
pullbrief.report.prompt.v2
pullbrief.assistant.prompt.v2
```

## Practices applied

The prompts follow production LLM/code-review practices:

- Treat PR text, patch text, file names, commit messages, and reviewer notes as untrusted data. They never override PullBrief's instructions.
- Ground claims in supplied evidence: report fields, file paths, patches, checks, and selected lines.
- Separate visible facts from missing context and follow-up verification.
- Optimize for senior reviewer speed, not teaching basics or generic code review advice.
- Prefer concrete file-path references over broad speculation.
- Avoid low-value nitpicks unless they affect correctness, safety, maintainability, API clarity, or review effort.
- Use explicit output contracts:
  - report generation returns schema-conforming JSON only
  - assistant chat returns concise markdown
- Use decision policy guardrails so the model does not casually approve or request changes.
- Use review-significance ranking rather than alphabetical order or line-count order.
- Group changes by behavior, not directory structure.

## Report generation prompt

Used by:

```text
apps/web/src/lib/reports/generator.ts
```

The report prompt asks pi to produce the `pullbrief.report.v1` JSON report. It focuses on:

- ranked file order
- logical change groups
- concrete blocking issues
- review mode per file: `read`, `check`, `skim`
- verification work
- open questions where context is missing

The report generator appends the prompt marker to `report.generator.warnings`:

```text
prompt:pullbrief.report.prompt.v2
```

This gives us lightweight prompt-version traceability until the schema grows a first-class `promptVersion` field.

## Assistant chat prompt

Used by:

```text
apps/web/src/lib/reports/assistant.ts
```

The assistant prompt supports two workbench modes:

- immediate explanation of selected diff code from the context-menu popover
- prompted questions about a selected file/line/range
- discussion of collected private AI notes

The assistant receives a compact context object containing:

- reviewer question
- PR metadata
- slimmed PullBrief report
- selected file if any
- selected line if any
- relevant file index and patch excerpts within budget

The expected answer style is:

1. direct answer first
2. optional short sections: Evidence, Uncertainty, Verify next
3. markdown only

## Current limits

- Report schema still lacks first-class evidence spans and prompt version fields.
- Assistant chat history is passed through the workbench question payload, but persisted AI threads are future work.
- Prompt quality should be evaluated against real PRs with known reviewer outcomes before further tuning.
