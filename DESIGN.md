# Design

Visual system for PullBrief. Anchored to PRODUCT.md; every choice traces back to "calm, sharp, respectful" and the editorial-terminal lane.

## Theme

Dark by default. Scene sentence: *a senior reviewer scanning a thirty-file PR at 10pm in a dim home office, between meetings, on a 27-inch monitor, deciding what to approve before standup.* The room is dim, the monitor is bright, the session is hours long. Pure black is uncomfortable in that scene; warm-tinted near-black reads like ink on dark paper and stays comfortable.

A light theme is provided as an alternative for daylight environments and is held to the same craft bar; it is not the marketing screenshot.

## Color

OKLCH. Every neutral tinted toward warm hue 70 (paper-ink warmth, not blue-coolness — a deliberate refusal of the GitHub-navy reflex). No pure `#000` or `#fff`.

**Strategy: Restrained.** Tinted neutrals carry 90% of the surface. One editorial accent — burnt-amber — is the brand's primary action / focus / current-selection colour. A separate semantic hazard set (red / amber / muted-teal) is used only for risk levels, validation, and status. The accent and the hazard amber share a hue family on purpose; they read as one visual family, not two competing palettes.

### Dark theme (default)

```
--background:      oklch(0.16 0.005 70)   /* warm ink-black */
--foreground:      oklch(0.94 0.008 75)   /* warm near-white */
--muted:           oklch(0.22 0.005 70)
--muted-foreground:oklch(0.66 0.010 75)
--subtle:          oklch(0.20 0.005 70)   /* hairline panel surface */
--border:          oklch(0.28 0.006 70)
--border-strong:   oklch(0.40 0.008 70)
--ring:            oklch(0.70 0.14  65)   /* focus = amber */

/* Brand accent — the only chromatic colour in chrome */
--accent:          oklch(0.72 0.14  65)   /* burnt amber */
--accent-foreground: oklch(0.16 0.005 70)
--accent-muted:    oklch(0.40 0.06  65)

/* Hazard semantics — only for risk, validation, status */
--risk-high:       oklch(0.62 0.18  25)   /* restrained red */
--risk-med:        oklch(0.72 0.14  65)   /* shares hue with accent */
--risk-low:        oklch(0.68 0.06 195)   /* muted teal */

/* Diff */
--diff-add:        oklch(0.28 0.06 150)
--diff-add-fg:     oklch(0.86 0.10 150)
--diff-del:        oklch(0.28 0.10  25)
--diff-del-fg:     oklch(0.86 0.10  25)
```

### Light theme

```
--background:      oklch(0.985 0.004 80)  /* warm paper */
--foreground:      oklch(0.18  0.005 70)
--muted:           oklch(0.96  0.005 80)
--muted-foreground:oklch(0.46  0.008 75)
--subtle:          oklch(0.97  0.005 80)
--border:          oklch(0.90  0.006 75)
--border-strong:   oklch(0.78  0.008 75)
--ring:            oklch(0.55  0.16  55)

--accent:          oklch(0.55 0.16 55)
--accent-foreground: oklch(0.985 0.004 80)
--accent-muted:    oklch(0.78 0.10 60)

--risk-high:       oklch(0.50 0.20 25)
--risk-med:        oklch(0.55 0.16 55)
--risk-low:        oklch(0.50 0.08 195)

--diff-add:        oklch(0.94 0.06 150)
--diff-add-fg:     oklch(0.32 0.10 150)
--diff-del:        oklch(0.94 0.08  25)
--diff-del-fg:     oklch(0.36 0.12  25)
```

Contrast pairs verified against WCAG AA: body 4.5:1+, UI components 3:1+. No colour-only signalling — every risk badge carries a text label.

## Typography

Two families, both already wired up in `apps/web/src/app/layout.tsx`:

- **Geist Sans** — UI, headings, labels, body, buttons. Variable weight; we use 400 / 500 / 600.
- **Geist Mono** — code, SHAs, file paths, branch names, timestamps, tabular numerics, keyboard hints.

No serif. No display font. The hybrid lane is not "editorial because we added a serif headline" — it's "editorial because the headlines are full sentences and the rhythm is considered". Sans carries everything that isn't code.

### Scale (rem, fixed — not fluid)

```
text-2xs   0.6875rem  / 1rem      uppercase microtype, kbd hints
text-xs    0.75rem    / 1rem      meta, breadcrumbs, badges
text-sm    0.8125rem  / 1.25rem   secondary body, table cells
text-base  0.9375rem  / 1.5rem    body
text-lg    1.0625rem  / 1.5rem    intro / lead paragraph
text-xl    1.25rem    / 1.75rem   subsection title
text-2xl   1.5rem     / 2rem      section title
text-3xl   1.875rem   / 2.25rem   page title
text-4xl   2.5rem     / 2.75rem   marketing-only / hero headline
```

Step ratio ~1.20 — tight, as required for a product surface dense with type. Weight contrast (400 → 600) carries hierarchy alongside scale.

Measure: prose capped at `max-w-[68ch]`. Brief content sits inside this. Data tables and code can run wider.

Numeric digits use `font-variant-numeric: tabular-nums` everywhere a number can change (line counts, file counts, SHAs, timestamps).

## Spacing & Layout

8px base grid with a 4px refinement step. Tailwind defaults already match. Used scale: `1 · 2 · 3 · 4 · 6 · 8 · 12 · 16 · 24`.

- **Container.** Brief content uses `max-w-[72rem]` with a generous outer gutter. Auth page is `max-w-[24rem]`, off-centre (40% from the top of the viewport, not centred — centred is the SaaS reflex).
- **Rhythm.** Section breaks are a horizontal rule with `mt-12 mb-8`, not boxed cards. No nested borders, no card-inside-a-card.
- **App shell.** Top bar fixed at `h-12`. Left rail in the brief cockpit is `w-72` desktop, collapsed to a sheet on mobile.

## Radii

Subtle. Square-ish, not pill-shaped, not brutalist-sharp.

```
--radius: 0.25rem  /* 4px base; buttons, inputs */
--radius-sm: 0.125rem
--radius-md: 0.25rem
--radius-lg: 0.375rem
--radius-xl: 0.5rem
```

Cards and panels override to 0.375rem. Avatars and the brand mark are circular. Buttons are never pills.

## Borders

Hairline (`1px`) is the default. Single-colour borders. **No side-stripe accents** (forbidden by impeccable's shared bans).

Two border tokens:
- `--border` — the workhorse, near-invisible separator.
- `--border-strong` — used sparingly, for focused inputs, risk-high badges, and the active row in the file rail.

## Iconography

`lucide-react` (already installed). Stroke width `1.5`, size 16 inline / 20 in chrome. No mixing icon libraries. Icons never replace a text label on a primary action.

## Motion

One easing curve, one duration band.

```
--ease: cubic-bezier(0.22, 1, 0.36, 1)  /* ease-out-quart */
--dur:  160ms  /* default */
--dur-fast: 100ms
--dur-slow: 220ms
```

Allowed: opacity, transform, colour, background-colour. **Forbidden:** layout-property animation (width / height / top / left / margin), bounce, elastic, spring on UI chrome, "thinking" animations that outlive the request, decorative pulses.

`@media (prefers-reduced-motion: reduce)` collapses all durations to 0.

## Components (shadcn baseline)

We use shadcn primitives as starting structure, but every one is tuned to the system before it ships.

- **Button** — variants: `primary` (amber, the one prominent action per surface), `secondary` (border + subtle bg), `ghost` (text only), `destructive` (risk-high). Never pills; never gradient.
- **Input** — single-row, hairline border, `border-strong` on focus + amber `ring`. Mono variant for paste-PR-URL.
- **Badge** — variants: `default`, `risk-high`, `risk-med`, `risk-low`, `neutral`. Tonal background + matching foreground, never side-stripe.
- **Kbd** — mono `text-2xs`, hairline border, dark surface ⟶ slightly lighter, light surface ⟶ slightly darker. Used in the command palette trigger and inline shortcuts.
- **Separator** — hairline, full-width inside its container.
- **CommandPalette** — `⌘K` opens it. Mono entries, ranked, keyboard-first.

No card component as default reach. Sections are headings + content + bottom separator. Card-grid is reserved for the rare case where each item is genuinely a peer (e.g. recent briefs on the home).

## Don'ts

A short checklist for any new screen in PullBrief. If any apply, redo the screen.

- Gradient anywhere. (Including text, borders, backgrounds.)
- Centred SaaS hero column with a giant H1.
- Sparkle / ✨ emoji.
- Identical card grids for every section.
- Side-stripe accents on cards or alerts.
- Rounded-pill buttons.
- Colour as the only signal for a state.
- Decorative motion.
- Lorem ipsum or generic placeholder copy.
- Em dashes in copy (use commas, colons, semicolons, periods, parentheses).
