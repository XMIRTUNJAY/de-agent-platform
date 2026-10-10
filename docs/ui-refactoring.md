# UI Refactoring Guide

How to build and migrate UI in this project so it stays legible, themed, and consistent. Reference frame: the nextjs.org / Geist approach — strong surface separation, semantic tokens, restrained effects.

## 1. Token layer (global.css)

Three layers, in order of responsibility:

| Layer | Tokens | Rule |
| --- | --- | --- |
| **Surfaces** | `--shell` → `--surface` → `--surface-2` → `--surface-3` → `--surface-hover` | Each step must be *visibly* lighter than the one below. `--shell` is the page background; cards never use it. |
| **Card** | `--card`, `--card-hover`, `--card-border`, `--card-border-hover` | The ONLY tokens a card/panel may read. `--card-border` must be visible at 100% zoom (≥ 8% white opacity in dark theme). |
| **Semantic** | `--primary`(+`-strong`,`-fg`), `--secondary`(+`-hover`), `--muted`, `--ring` | Buttons, links, focus rings, and status chips consume these — never raw hex. |

All values exist in both `:root`/dark and `[data-theme='light']` blocks. **Never add a token to only one theme.**

Do / Don't:

| Do | Don't |
| --- | --- |
| `background: var(--card)` inside `.card` | `background: var(--shell)` on a card (invisible against page) |
| `border-color: var(--card-border)` | hardcoded `rgba(...)` borders |
| `color: var(--muted)` for secondary text | inventing new gray hexes |
| Rely on border + surface step for idle cards | idle glow/heavy shadows (reserve for hover/focus) |

## 2. Card recipe

```astro
<a class="card card-pad card-interactive" style="display:flex; flex-direction:column; height:100%;">
  <div class="card-header"><span class="mono-label">Kind</span></div>
  <h3 style="font-size: var(--text-xl); font-weight: 500; color: var(--fg);">Title</h3>
  <p class="card-desc" style="flex: 1;">Description.</p>
  <div class="card-meta">…chips…</div>
</a>
```

Rules:
- Exactly one interactive target per card (the whole card is a link, chips inside are plain text).
- Kicker via `.mono-label`, meta via `.card-meta` + `.chip`, description via `.card-desc`.
- Long lists: `height: 100%` + `flex: 1` on description so meta rows align.

## 3. Page grammar

- Every page opens with `PageHero` (kicker → serif title → lede) inside `BaseLayout`.
- Sections: `.section` rhythm, separated by `<hr class="hairline col" />`, headers via `SectionHeader` (don't hand-roll kicker/title/lede).
- Lists longer than ~8 items: group or decompose into cards (see homepage phases); a full flat list belongs on its own listing page (`ListingPage`).

## 4. Typography scale

`--text-2xs … --text-4xl` from tokens only; headings: `.display-hero` / `.display-section` (they already set `text-wrap: balance`). Never introduce raw `px` font sizes.

## 5. Motion & accessibility

- Durations/easings from `--duration-*` / `--ease-*`; no `transition: all`.
- Honor `prefers-reduced-motion` (guarded animations + JS `matchMedia` check; see `index.astro` hero).
- Every icon-only control gets `aria-label`; every form input gets a `<label>` or `aria-label`; `outline: none` requires a visible `box-shadow`/`--ring` replacement.
- New colors must meet WCAG AA (≥ 4.5:1 for body text, ≥ 3:1 for large text) in **both** themes — verify with the WebAIM checker.

## 6. Migration checklist (per component)

1. Replace raw colors with tokens from layer table above.
2. Route card/panel surfaces through `--card*` tokens.
3. Swap `transition: all` → property list from tokens.
4. Check focus-visible, aria-labels, reduced-motion.
5. Inspect dark + light theme at 375px and 1440px.
6. `npm run check` + `npm run build` — both must stay green.
