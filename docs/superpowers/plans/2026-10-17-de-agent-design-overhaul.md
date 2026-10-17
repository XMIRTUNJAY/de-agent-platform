# DE//AGENT Full-Platform Design Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 3 P0 defects and the 4 user-reported shell/filter/centering problems, then lift every page family to one coherent premium standard per `docs/REDESIGN_AUDIT.md`.

**Architecture:** Keep Astro 5 + Tailwind 4 + global.css tokens. All redesign work is server-rendered CSS/markup + small vanilla JS (no new UI framework). Markdown bodies render server-side with `marked`. One new icon system component feeds header, sidebar, and mobile drawer. Marketplace keeps its client filter JS but moves the UI into a reusable `FilterPanel` and adds URL state.

**Tech Stack:** Astro 5, Tailwind 4 (tokens in global.css), `marked` (new, sole new dep), Playwright (existing), node:test (existing).

**Spec:** user's overhaul brief (this session) + `docs/REDESIGN_AUDIT.md` findings P0-1..P1-4, P2, P3.

## Global Constraints

- Never fabricate metadata, scores, verification, or popularity (user rule; scores display must come from real `marketplace.composite_score`).
- Source content stays verbatim: markdown bodies render as-authored, no rewriting.
- Keep Astro static/SSR split, route paths, canonical URLs, sitemap/RSS behavior.
- No new heavy client deps; `marked` is the only addition.
- WCAG 2.2 AA contrast for new UI; `prefers-reduced-motion` respected for transitions.
- Registry data (`registry.json`) is the only data source — no mock arrays.

## Review Focus

- Long unbreakable strings (install commands, provider chip paths) must never push page width past the viewport — pinned by overflow e2e (Task 2, Task 3).
- Detail-page bodies containing `##`/`*`/backticks must render as HTML, never literal text — pinned by e2e (Task 1).
- Every nav/sidebar item must have an icon (drawer included) — pinned by e2e (Task 4).
- Marketplace filter state must survive reload via URL and back/forward — pinned by e2e (Task 6).
- Tablet (768px) header must not overflow — pinned by overflow e2e (Task 3).

---

### Task 1: Render resource bodies as markdown (P0-1)

**Files:**
- Modify: `package.json` (add `marked`)
- Modify: `src/components/ResourceDetail.astro:260-264`

**Interfaces:**
- Produces: `renderBody(md: string): string` (marked.parse with GFM, sanitize=false — content is human-gated YAML) inlined in ResourceDetail frontmatter.

- [ ] **Step 1: Failing e2e** — in `tests/e2e/shell.spec.js` (new file): visit `/skills/sql-review`, assert `document.querySelector('.prose-de')?.innerHTML` contains `<h2>` or `<h3>` AND does NOT contain the literal substring `## The first question`.

- [ ] **Step 2:** `npm i marked` ; in ResourceDetail frontmatter: `import { marked } from 'marked'; marked.setOptions({ gfm: true, breaks: false });` and render `set:html={marked.parse(res.body ?? '')}`.

- [ ] **Step 3:** Run e2e shell spec → PASS. `npm run check` still 0 errors.

- [ ] **Step 4:** Commit `fix(detail): render resource bodies as markdown`.

### Task 2: Chip overflow policy (P0-3)

**Files:**
- Modify: `src/styles/global.css:530-544` (.chip)
- Test: `tests/e2e/shell.spec.js`

- [ ] **Step 1:** e2e: at 375×667 `/roadmap` `document.documentElement.scrollWidth - clientWidth <= 1`.
- [ ] **Step 2:** `.chip { white-space: normal; overflow-wrap: anywhere; min-width: 0; }` (replaces nowrap). Add `.card-meta > * { max-width: 100%; }`.
- [ ] **Step 3:** e2e PASS; commit `fix(css): chips wrap instead of pushing layout`.

### Task 3: Header/nav revamp with icons + tablet fix (P0-2, P1-2)

**Files:**
- Create: `src/components/Icon.astro` (name→inline SVG map: roadmap, market, projects, runbooks, categories, tutorials, docs, search, theme, github, menu, close, book, wrench, shield)
- Modify: `src/site.config.ts` — TOP_NAV items gain `icon?: string`; add Categories + Tutorials + Docs entries
- Modify: `src/components/TopBar.astro` — icons in links; nav dropdown `lg:flex` (fixes 768 overflow); compact right cluster (`Search` label hidden below xl, Explore stays); active section matching (detail routes map to their listing href)
- Test: `tests/e2e/shell.spec.js`

- [ ] **Step 1:** Failing e2e: at 768×1024 all 30 audit routes overflowX <= 1; header nav links each contain an svg; `/skills/sql-review` header shows Marketplace-group active state (aria-current present on a nav link).
- [ ] **Step 2:** Implement per files above. Active-section map: `/skills|/mcp|/agents|/hooks|/plugins|/templates|/references` → Marketplace; `/tutorials|/guides|/categories|/taxonomy` → Learn; `/projects|/patterns` → Projects; `/runbooks` → Runbooks; `/roadmap` → Roadmap; `/docs` → Docs.
- [ ] **Step 3:** e2e PASS + `npm test` PASS (add unit test: every TOP_NAV item has icon) ; commit `fix(shell): icon nav, tablet-safe breakpoints, section-aware active states`.

### Task 4: Persistent sidebar with icons + a11y (P1-1)

**Files:**
- Modify: `src/site.config.ts` — SIDEBAR items gain `icon?: string` (icon per item, mapped in config)
- Modify: `src/components/SidebarNav.astro` — render Icon per item; inner scroll with visible affordance; `aria-modal` drawer behavior; Escape closes; focus moves into drawer on open, restores on close
- Modify: `src/layouts/BaseLayout.astro` — `sidebar = true` default for all pages except home (home passes `sidebar={false}` explicitly); remove duplicate scrim render (line 107 vs 110); Footer renders on ALL pages
- Modify: `src/styles/global.css` — drawer focus styles, sidebar scrollbar styling
- Test: `tests/e2e/shell.spec.js`

- [ ] **Step 1:** Failing e2e: mobile drawer on `/marketplace` opens, first item has `svg`, Escape closes; footer exists on `/skills` (has `footer` element).
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** e2e + `npm test` PASS; commit `feat(shell): persistent icon sidebar, footer everywhere, drawer a11y`.

### Task 5: Marketplace filter revamp (P1-3)

**Files:**
- Create: `src/components/FilterPanel.astro` (grouped filter UI: sticky mini-header "Filters (n) · Clear all", sections with counts, styled checkboxes)
- Modify: `src/pages/marketplace.astro` — use FilterPanel; selected-filter chips row above results (removable); mobile: Filters button opens FilterPanel in drawer (reuses `.sidebar.open` mechanics); URL sync: filter state ↔ `?type=&category=&...` with `history.replaceState` + popstate restore
- Modify: `src/styles/global.css` — checkbox/panel styles
- Test: `tests/e2e/shell.spec.js`

- [ ] **Step 1:** Failing e2e: check `Type=Skill` checkbox → URL contains `type=skill`; reload page → checkbox still checked and cards filtered; back button restores prior state; "Clear all" empties URL params and results.
- [ ] **Step 2:** Implement (keep existing filter JS core, add serialization `serializeState()`/`applyParams()` helpers as pure functions in an inline module for testability).
- [ ] **Step 3:** e2e PASS; commit `feat(marketplace): filter panel, chips, drawer, URL sync`.

### Task 6: ResourceCard redesign (P2)

**Files:**
- Modify: `src/components/ResourceCard.astro` — score chip → compact meter (dot + integer + label, colored by band ≥70 accent / 50–69 neutral / <50 muted-red, no raw decimals); tags capped at 3 with `+n`; verification chip semantic color; `mt-auto` on tag row for aligned card bottoms
- Modify: `src/styles/global.css` — meter styles
- Test: `tests/nav-model.test.mjs` extend or new `tests/card-format.test.mjs`

- [ ] **Step 1:** Unit test `formatScore(57.14) → '57'`, `scoreBand(44.86) → 'weak'` pure helpers (in `src/lib/format.ts`).
- [ ] **Step 2:** Implement card changes using helpers.
- [ ] **Step 3:** `npm test` PASS; e2e detail/listing console-clean still green; commit `feat(cards): score meter, tag caps, aligned bottoms`.

### Task 7: Consistent centering + reading widths (P1-4)

**Files:**
- Modify: `src/styles/global.css` — define `.col` = `max-width: 1120px` inside sidebar pages too (unchanged), add `.prose-measure { max-width: 72ch; }` for article bodies; marketplace/results grid aligns to same gutter as sidebar text
- Modify: `src/components/ResourceDetail.astro` — wrap main prose in `.prose-measure`
- Modify: `src/pages/tutorials/...` + DocsLayout body measure

- [ ] **Step 1:** e2e: on `/skills/sql-review` at 1440, `.prose-measure` width ≤ 72ch+ε and centered within main.
- [ ] **Step 2:** Implement; commit `fix(layout): consistent centered measures`.

### Task 8: Page-family polish (Pass E)

**Files:**
- Modify: `src/pages/categories/[slug].astro` — reuse FilterPanel styles; hero alignment
- Modify: `src/pages/404.astro`, `src/pages/taxonomy.astro`, `src/pages/admin*.astro`, `src/pages/publisher.astro`, `src/pages/dashboard.astro` — spacing/typography to token scale; no functional changes
- Modify: `src/components/ResourceDetail.astro` — rating widget: plural via existing `format.ts`, larger star buttons (44px touch targets), focus-visible rings

- [ ] **Step 1:** Re-run audit crawler → no regressions (overflow 0, console clean).
- [ ] **Step 2:** Screenshots before/after for: home, marketplace, detail, roadmap, category, mobile drawer.
- [ ] **Step 3:** Commit `polish: page families to token scale`.

### Task 9: QA + docs (Pass G)

**Files:**
- Create: `docs/REDESIGN_DESIGN_SYSTEM.md` (tokens, type scale, components, responsive rules)
- Create: `docs/REDESIGN_QA.md` (build/test/e2e results, crawler before/after, screenshots, limitations)

- [ ] **Step 1:** `npm test` + `npx playwright test` + `npm run check` + production build all green.
- [ ] **Step 2:** Write QA doc with measured numbers (overflow matrix, console, Lighthouse if available).
- [ ] **Step 3:** Commit `docs: design system + QA report`.

**Execution method:** Native (this session) — tasks 1–7 share the shell/design-system surface and sequential interfaces; user opted out of process questions.
