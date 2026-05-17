# Review Workbench product notes

This captures the corrected product direction for PullBrief's workbench.

## User

Senior developers and tech leads who already know how to read code. PullBrief should speed up PR review, not replace judgment or turn the review into generic AI form-filling.

## Core job

The reviewer wants a strong diff viewer with AI assistance available at the moments of uncertainty.

Primary workflow:

1. Open a PR report.
2. See ranked files and logical change-group summaries.
3. Move through the diff in priority order.
4. Mark files viewed.
5. Select or anchor a line/range when something needs clarification.
6. Either:
   - chat with AI immediately about that selection, then close the chat and continue, or
   - save a private note for AI and keep reviewing.
7. Later, send the collected private notes to AI for a broader discussion about risks, questions, summaries, and verification.

## What the workbench is not

- It is not primarily a GitHub writeback composer.
- It is not a right-panel form for check runs, sticky comments, approvals, and request-changes controls.
- It is not an AI theatre surface with generic summaries detached from the diff.
- It should not force reviewers to create GitHub comments just to think with AI.

## Required UX direction

- Diff-first layout.
- Left rail: ranked files, risk, viewed state.
- Main surface: selected file summary + contextual actions + diff.
- Contextual AI actions appear only inside the diff viewer, through a custom right-click menu:
  - Explain selection.
  - Ask with instruction.
  - Save private note.
- Fast explanations appear in an anchored popover near the selected diff context.
- Follow-up discussion expands to a bottom AI thread drawer and can be closed without losing review progress.
- AI notes are private PullBrief notes, not GitHub comments.
- A bottom drawer can show the AI note queue and synthesize risks from queued notes. A permanent right-side writeback panel should not exist.

## Nice-to-have AI output

- Identify critical files to read vs skim.
- Group changes into coherent blocks.
- Explain what each block does in senior-reviewer language, e.g. "creates a table", "adds a migration", "updates auth policy".
- Help turn selected diff context or collected notes into clarification, risk assessment, or summary text.
