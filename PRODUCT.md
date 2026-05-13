# Product

## Register

product

## Users

Senior developers and tech leads who review pull requests as part of their daily work, often many per day, often across repositories they don't own. They reach for PullBrief after opening a PR in GitHub and realising the changed-files view is alphabetical, the description is sparse, and they have twenty minutes between meetings to decide whether the change is safe to approve.

They are fluent in their category's best tools: Linear for tickets, Raycast for launching, GitHub for code, the terminal for everything else. They are not impressed by interfaces; they are impressed by interfaces that respect their time. They spend hours per day inside dev tools and care about long-session legibility, keyboard reachability, and information density.

## Product Purpose

PullBrief turns a GitHub pull request into a ranked, structured review brief: a one-paragraph intent summary, risk-ordered file list, logical change groups, verification notes, and (later) chat and comment writeback. The goal is to make a large PR understandable in the first sixty seconds — before the reviewer has read a single diff — and to give every subsequent reviewer of that PR the same context without rebuilding it from raw patches.

Success looks like a reviewer opening a thirty-file PR, reading two screens of PullBrief, and knowing exactly which three files to read carefully and which fifteen to skim. Failure looks like the reviewer closing the tab and going back to GitHub.

The product is open source, deployable as a self-hosted GitHub App or (later) hosted SaaS. It is generic across organisations, repositories, and Jira instances; nothing about a specific tenant is baked into the design.

## Brand Personality

Calm, sharp, respectful.

- **Calm.** No marketing language, no exclamation marks, no "powered by AI ✨", no urgency the user didn't bring with them. The interface assumes the user already cares; it doesn't try to convince them.
- **Sharp.** Opinions are stated plainly. A risk is `HIGH`, not "potentially elevated". A file is at rank 1, not "near the top". Defaults are committed to.
- **Respectful.** Treats the reader as a senior. Full sentences in headlines, no emoji as decoration, no over-explanation. Empty states teach, they don't apologise.

The voice of every label, button, empty state, and error follows from this. "Sign in", not "Get started for free". "No briefs yet" not "Welcome! Let's create your first brief 🎉".

## Anti-references

These are explicit vetoes. If a screenshot of PullBrief could be mistaken for any of them, the design is wrong.

- **AI-startup gradient cream.** Off-white background, lavender-to-peach gradients, sparkle emoji, "AI-powered" stamped on a hero, big rounded buttons in a centred column. The 2024 SaaS template. Forbidden.
- **Generic GitHub-clone navy with dropshadows.** Reflexive "GitHub but darker" colour scheme — navy primary, neutral cards, avatar stacks, blue links — applied to any developer tool. Looks like a 2019 PR widget. Forbidden.
- **Notion / Linear clone with no opinion.** Inoffensive grey, system font, identical card grid for every section, "modern minimal" without any actual choices made. Functional but invisible — the design adds nothing. Forbidden.
- **Decorative AI ornament.** Sparkles, gradient borders on "AI" content, animated thinking dots that outlive the request, "magic" framing. Forbidden everywhere except a single small mark on briefs that are model-generated and the user needs to know it.

## Design Principles

1. **Practice what we preach.** The product helps reviewers rank, summarise, and read with focus. The UI must do the same: ranked navigation, summary-first reading, no decorative chrome competing for attention.
2. **Information has rank.** Every screen has a single most-important thing. Show it first, larger, alone. Subordinate everything else.
3. **Show, don't decorate.** A risk badge is a colour and a word. A SHA is monospace. A file path is monospace. The chrome is whatever's left after the content is placed.
4. **Earn the user's hours.** This is a tool people sit inside, not a page they glance at. Long-session comfort beats short-session impression: dark surface, restrained colour, no motion that costs the user attention, keyboard reachability for everything that matters.
5. **Commit to opinions.** Restrained palette, one accent, one type family pair, one set of radii, one motion curve. Variety comes from rank and density, not from new components.

## Accessibility & Inclusion

- **WCAG 2.2 AA** as the floor for colour contrast, focus states, target sizes, and form labelling. Body text at 4.5:1, large text and UI components at 3:1. Real labels on inputs, real `<button>` semantics, no `<div>`s pretending.
- **Keyboard-first.** Every action reachable without a pointer. A command palette (`⌘K`) is a first-class navigation surface, not an extra.
- **`prefers-reduced-motion` respected** for every transition. The product reads either way.
- **No colour-only signalling.** Risk levels carry a label (`HIGH` / `MED` / `LOW`) alongside their colour. Inline diffs use `+` / `−` symbols, not only red and green.
- **Long-session friendly.** Dark default surface tuned to be comfortable in dim rooms; light alternative available for bright environments. Neither theme uses pure black or pure white.
