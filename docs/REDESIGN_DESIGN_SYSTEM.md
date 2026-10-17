# DE//AGENT Design System

Single source of truth for the platform shell and page families. Established during the
2026-10 design overhaul (see `docs/REDESIGN_AUDIT.md` for the findings that motivated
each rule). Every rule below is enforced either by a token, a component, or an e2e
contract in `tests/e2e/shell.spec.js`.

## Tokens (`src/styles/global.css`)

### Color — dark theme (default) and light theme

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--shell` | `#050706` | `#dfe3d8` | page background |
| `--surface` / `-2` / `-3` | `#16231e` → `#253932` | `#ffffff` → `#e4e9dd` | cards, wells, hovers |
| `--border` / `--border-strong` | 6% / 12% white | 8% / 16% black | hairlines, card borders |
| `--fg` / `--fg-muted` / `--fg-dim` | `#e8ebe3` / `#9aa59b` / `#66726a` | `#0f1712` / `#4c574e` / `#78857b` | text hierarchy |
| `--accent` | `#4ade80` | `#15803d` | links, active states, meters |
| `--color-warn` / `--color-danger` / `--color-info` / `--color-dim` | aliases | aliases | score meter tones, chips |

Never hard-code hex values in components; consume tokens only.

### Typography

| Token | Size | Line height | Use |
| --- | --- | --- | --- |
| `--text-2xs` | 0.6875rem | 1rem | metadata, chips, counters |
| `--text-xs` | 0.75rem | 1.125rem | secondary UI labels |
| `--text-sm` | 0.8125rem | 1.25rem | body-adjacent UI, nav |
| `--text-base` | 0.9375rem | 1.6 | prose body |
| `--text-lg` | 1.0625rem | 1.6 | ledes |
| `--text-xl` | 1.25rem | 1.4 | card titles |

Fonts: `--font-mono` JetBrains Mono (labels, code, data), `--font-sans` Inter (UI + prose),
`--font-display` Instrument Serif (`.display-hero` headlines). `mono-label` = uppercase
mono kicker used on every section summary.

### Motion

`--duration-fast` 120ms (hover), `--duration-base` 200ms (UI), `--duration-slow` 320ms
(drawers), easing `--ease-spring` for entrances, `--ease-out` for exits.

## Layout system

- `.col` — shell column, `max-width: 1120px`, centered, `1.25rem`/`2rem` inline padding.
- Sidebar pages: `BaseLayout sidebar` (default) renders the left rail (280px) on ≥lg and
  an off-canvas drawer below lg. The footer renders on **every** page.
- `.prose-measure` — 72ch, centered within its column (detail-page grid columns).
- `.prose-measure-l` — 72ch, left-aligned to the PageHero above it (docs/tutorials).
- `.filter-panel` — sticky panel ≥lg; off-canvas drawer (300px) below lg with scrim.
- `card-grid` — `repeat(auto-fill, minmax(min(260px, 100%), 1fr))`; children never force
  horizontal overflow (tablet contract P0-2).

## Components

### Icon (`src/components/Icon.astro`)
Inline SVG glyphs; every nav item (top bar + sidebar + drawer) must carry one
(e2e P1-2: `#sidebar a:has(svg)` count equals total link count).

### FilterPanel (`src/components/FilterPanel.astro`)
Grouped checkbox filters with counts. Header row: `Filters [n] · Clear all · close`.
State is URL-synced by the page script via `src/lib/filter-state.mjs`
(`?type=skill&verification=community`), with `pushState` on user edits, `replaceState`
on programmatic apply, `popstate` restore. Selected values render as removable chips
(`#active-chips`). Used by `/marketplace` and `/categories/[slug]`.

### ResourceCard
- Header: `mono-label` type/category + **score meter** (track + fill + integer + label).
- Meter label/tone come from the registry's real `composite_score`/`composite_label`;
  `scoreBand()` in `src/lib/format.ts` mirrors the canonical thresholds
  (80/65/45/25 → exemplary/strong/adequate/weak/unproven) — never invent labels.
- Meta row: max 3 tag chips, rating (if voted), installs, verification chip pushed
  right with `margin-left: auto`.

### Rating widget (`ResourceDetail`)
Five 44×44px star buttons, hover lift, `focus-visible` ring; summary line uses
`plural()` from `format.ts`. Votes POST to `/api/marketplace/rate` (one vote per
voter, updates in place).

## Responsive rules

- ≤1023px: sidebar and filters become drawers (`visibility`-toggled, a11y-safe);
  top nav collapses to the menu button.
- ≥1024px: persistent left rail + sticky filter panels.
- No horizontal overflow at 375 / 768 / 1024 / 1440 (crawler + P0-2/P0-3 e2e).
- Detail prose centers in a 72ch measure at ≥1440 (e2e P1-4).

## Content rules (non-negotiable)

- Resource copy is verbatim from the registry; editorial additions live under
  "Our assessment" (`editorial:{...}`) only. Absence is rendered as absence — no padding.
- Scores/labels always derive from `marketplace.composite_score`/`composite_label`.
