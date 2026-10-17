# Premium Platform Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (user's standing method: native execution). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform DE//AGENT into a premium, developer-first knowledge platform — phase-grouped catalogue (`/categories` first), editorial homepage, connected roadmap journey, differentiated listings, operational curation views — while preserving all routes, data integrity, and the verification trust model.

**Architecture:** Astro 5 + Tailwind 4 static/SSR hybrid (unchanged). One canonical phase/stage mapping extracted to a lib module; all counts derived from `registry.json`/`stats.json` — no hard-coded totals. Client JS limited to progressive enhancement (search/filters URL-synced via pure, unit-tested state modules). Original inline-SVG diagrams; no new animation/3D dependencies.

**Tech Stack:** Astro 5, Tailwind 4, vanilla ESM client scripts, node:test + Playwright (existing).

**Spec:** The user brief of 2026-10-18 (premium platform redesign & full-site implementation, sections A–14). Existing foundations: `docs/REDESIGN_AUDIT.md`, `docs/REDESIGN_DESIGN_SYSTEM.md`, `docs/REDESIGN_QA.md`.

## Global Constraints

- No new dependencies (no search libraries, no animation libs, no DB/auth/workers — brief §G).
- Every count/total derived from canonical data (`registry.json`, `stats.json`); literals like "38 categories" forbidden in templates (brief §D).
- Verification/trust vocabulary unchanged: community/reviewed/tested/verified only, rendered only when the record supports it; never fabricate evidence (brief §D/§I).
- Preserve all existing URLs, route semantics, static rendering, sitemap/RSS/search, deploy config (brief §14).
- Content verbatim from registry; editorial additions only under "Our assessment" (existing rule).
- WCAG 2.2 AA targets: visible focus, keyboard nav, reduced-motion support, severity never color-alone (brief §A/§10).
- Commits per task, pushed to `main` (user's established workflow); each task leaves the suite green: `npm test`, `npx playwright test tests/e2e/shell.spec.js --workers=1`, `npm run check`.

## Review Focus

1. **Hard-coded totals** — a template containing "38", "13", or "157" as copy instead of derived counts; a reasonable person expects counts to survive registry growth. Test: unit gate scans `src/pages` + `src/components` for banned literals (Task 2 owns).
2. **URL round-trip loss** — category search/filter state must survive reload and back/forward exactly like marketplace filters; a reasonable person expects shareable filtered links. Test: e2e URL persistence (Task 2 owns).
3. **Reduced-motion** — new hover/mount effects must no-op under `prefers-reduced-motion: reduce`; a reasonable person expects zero transform animations then. Test: e2e emulates reduced motion and asserts no transition on mount elements (Task 4 owns).
4. **Fabricated trust language** — new homepage/listing copy must not invent verification claims ("independently verified", "audited"); a reasonable person expects trust text traceable to the verification policy doc. Test: unit gate greps new components for banned claim phrases (Task 5 owns).
5. **Keyboard trap in new catalogue search** — search input + phase nav must be reachable/escapable; a reasonable person expects Escape to clear/blur without trapping. Test: e2e keyboard flow (Task 2 owns).

---

### Task 1: Canonical phase mapping (`src/lib/phases.ts`)

**Files:**
- Create: `src/lib/phases.ts`
- Modify: `src/pages/index.astro:14-26` (consume module; delete local `PHASE_SLUGS`)
- Test: `tests/phases.test.mjs`

**Interfaces:**
- Consumes: `registry.json` → `taxonomy.stages` (`{id, slug, order, title, summary, outcomes[]}`).
- Produces: `PHASES: { index: number; name: string; tagline: string; stageIds: string[] }[]` (4 entries, 13 stage ids total, stable order); `phaseForStage(stageId: string): Phase | null`.

- [ ] **Step 1: Write failing test** — assert 4 phases named Foundations/Platforms/Trust & Operations/Advanced & Agentic; union of stageIds = the 13 registry stage ids exactly (no dupes, none missing); `phaseForStage('sql')` throws-or-null safe.
- [ ] **Step 2: Run** `node --test tests/phases.test.mjs` → FAIL (module missing).
- [ ] **Step 3: Implement** — move `PHASE_SLUGS` verbatim from `src/pages/index.astro:16-21`; keep taglines identical.
- [ ] **Step 4: Run** test → PASS; `npm test` → PASS (no regressions).
- [ ] **Step 5: Refactor index.astro to import from the module;** build homepage route (`npx astro dev` + fetch `/`) → identical section renders.
- [ ] **Step 6: Commit** `feat(data): canonical phase mapping module`.

### Task 2: `/categories` catalogue redesign

**Files:**
- Modify: `src/pages/categories.astro` (full rewrite)
- Create: `src/lib/category-filters.mjs` (pure state helpers)
- Create: `tests/category-filters.test.mjs`
- Test: append to `tests/e2e/shell.spec.js`

**Interfaces:**
- Consumes: `PHASES` (Task 1), `registry.taxonomy.categories/stages`, `countByCategory` derived in frontmatter, `stats.counts`.
- Produces: URL contract `?q=<text>&phase=<1-4|name>&sort=<roadmap|alpha|resources>`; pure helpers `categoryStateFromParams(params)`, `categoryParamsFromState(state)`, `filterCategories(categories, state, counts)`.

- [ ] **Step 1: Failing unit tests** for the three helpers (round-trip, unknown params ignored, `phase` accepts index or slug, deterministic sorts).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** helpers (mirror `filter-state.mjs` style). **Step 4: Run** → PASS.
- [ ] **Step 5: Rewrite page** — Phase nav (4 anchor groups + counts); per-phase stage sections (stage number, title, purpose, roadmap link); category entries as compact rows: title, one-sentence summary, resource count, stage context, link; hero shows derived totals; client script wires `q`/`phase`/`sort` with `history.pushState` + `popstate`, hides non-matching entries, empty state ("No categories match — clear filters") — full catalogue stays in static HTML.
- [ ] **Step 6: e2e** — `?q=sql` filters; `?phase=2` narrows; reload keeps state; back/forward restores; Escape clears `q`; all 38 category links present in DOM regardless of filter state; no literal "38" in template (unit grep gate in `tests/phases.test.mjs` or new `tests/no-hardcoded-totals.test.mjs`).
- [ ] **Step 7: Full suite + commit** `feat(categories): phase-grouped searchable catalogue`.

### Task 3: `/taxonomy` navigable structure

**Files:**
- Modify: `src/pages/taxonomy.astro`
- Test: extend shell.spec.js lightly (page renders, counts derived)

- [ ] **Step 1: Rewrite** — canonical-structure explainer (types → categories → stages → technologies), stage/technology tables with derived counts, links to `/categories/[slug]` and type listings; reuse `.prose-measure-l` for reading width.
- [ ] **Step 2: e2e** — h1 present, table rows count = registry technologies length, no console errors.
- [ ] **Step 3: Commit** `feat(taxonomy): derived-structure reference page`.

### Task 4: Shell polish — breadcrumbs, ⌘K hint, reduced motion, listing empty states

**Files:**
- Create: `src/components/Breadcrumbs.astro`
- Modify: `src/components/ResourceDetail.astro` (breadcrumbs under header), `src/components/TopBar.astro` (platform-aware kbd), `src/styles/global.css` (reduced-motion guard), `src/components/ListingPage.astro` (empty state)
- Test: shell.spec.js additions

**Interfaces:**
- Produces: `<Breadcrumbs items={[{ label, href? }]} />` (nav[aria-label="Breadcrumb"], last item aria-current).

- [ ] **Step 1: e2e first** — detail page shows breadcrumb trail with category link; kbd hint shows `Ctrl K` on Windows UA; reduced-motion emulation yields `transition-duration: 0s` on `.reveal`.
- [ ] **Step 2: Implement** all four items; `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }` plus targeted mount rules.
- [ ] **Step 3: Suite + commit** `feat(shell): breadcrumbs, platform kbd hint, reduced-motion, empty states`.

### Task 5: Homepage product composition

**Files:**
- Create: `src/components/diagrams/PipelineDiagram.astro` (original inline SVG: sources → ingestion → transformation → quality/quarantine → publication)
- Modify: `src/pages/index.astro` (recomposition)
- Create: `tests/trust-copy.test.mjs` (banned-claim grep)

**Interfaces:**
- Consumes: `PHASES`, `registry.resources` (featured: `marketplace.is_featured || is_official`, top composite), `stats.counts`, `last_verified` recency.
- Produces: `PipelineDiagram` (no props, static SVG with accessible `<title>`).

- [ ] **Step 1: Failing test** — grep homepage + new components for banned phrases (`independently verified`, `audited`, `secure by default`, `enterprise-grade`).
- [ ] **Step 2: Recompose** per brief §6: split technical hero (editorial left + PipelineDiagram right), two primary CTAs (roadmap, marketplace), Learn/Build/Install/Operate quartet, four-phase overview (from PHASES), featured resources (real composite scores via scoreBand), trust block (verification levels explained, evidence language from docs/verification), recently updated (derived), contribution invite. Remove metric soup; keep only derived counts.
- [ ] **Step 3: Crawler pass** on `/` at 4 viewports (0 overflow, 0 console errors); screenshots saved.
- [ ] **Step 4: Suite + commit** `feat(home): editorial product composition with pipeline diagram`.

### Task 6: Roadmap connected journey

**Files:**
- Modify: `src/pages/roadmap.astro`
- Test: shell.spec.js (phase timeline present, stage anchors resolve)

- [ ] **Step 1: Recompose** — phase timeline rail (4 phases from PHASES) above stage sections; stage sections gain prerequisites line (from `stage.prerequisites` if present in data; omit section when absent — no fabrication), outcomes list (data exists), exit gates (existing gate artifacts), resource availability counts; journey connector styling, no completion-tracking implication.
- [ ] **Step 2: e2e** — every stage anchor link scrolls to existing id; phase rail links match 4 phases.
- [ ] **Step 3: Suite + commit** `feat(roadmap): phase timeline journey composition`.

### Task 7: Tutorials & guides catalogue

**Files:**
- Modify: `src/pages/tutorials.astro`, `src/pages/guides.astro` (if distinct data exists)
- Test: shell.spec.js light

- [ ] **Step 1: Data check** — inventory actual tutorial/guide entries (skill level, objectives, duration fields present or absent). Record honestly in commit message.
- [ ] **Step 2: Compose** — editorial catalogue grouped by level (data-supported only); entries: title, summary, objectives (when present), related category; tutorials visually distinguished from skills (type label from typeLabel).
- [ ] **Step 3: Suite + commit** `feat(tutorials): editorial learning catalogue`.

### Task 8: Type-listing differentiation (12 near-identical pages)

**Files:**
- Modify: `src/components/ListingPage.astro`, per-type hero copy derived from data (typeLabel, counts, top resources by composite) — no per-type hardcoded prose beyond existing registry summaries
- Test: shell.spec.js (two distinct types show distinct hero stats; empty type listing shows empty state)

- [ ] **Step 1: Extend ListingPage** — type-specific hero stats (count, avg composite, verified count — all derived), compact entry rows option for large types (references: 41), tag-cap and mt-auto alignment carried over.
- [ ] **Step 2: e2e + suite + commit** `feat(listings): differentiated type pages`.

### Task 9: Runbooks, incident, architecture canvas

**Files:**
- Create: `src/components/diagrams/ArchitectureCanvas.astro` (sources/processing/contracts/destinations/failure paths, accessible)
- Modify: `src/pages/runbooks.astro` composition (severity: icon + text label, never color alone), `src/pages/[type]/[slug].astro` architecture rendering hook (use canvas where resource type = architecture and structured fields exist)
- Test: shell.spec.js (severity rendered with text; canvas svg has <title>)

- [ ] **Step 1: Runbook composition** — symptoms/diagnosis/recovery/validation sections derived from existing body headings (no content edits); severity chip = icon + word.
- [ ] **Step 2: ArchitectureCanvas** — original SVG, consistent visual language with PipelineDiagram; used on architecture patterns listing + details where data supports.
- [ ] **Step 3: Suite + commit** `feat(operate): runbook severity language + architecture canvas`.

### Task 10: Curation & registry-health operational pass

**Files:**
- Modify: `src/pages/admin.astro`, `src/pages/admin/queue.astro`, `src/pages/admin/health.astro`, `src/pages/publisher.astro`, `src/pages/dashboard.astro`
- Test: shell.spec.js (admin pages render table semantics, status text not color-only)

- [ ] **Step 1: Density pass** — operational tables (`.table` tokens), status vocabulary aligned with docs/verification terms, traceability links (source → resource), no marketing styling.
- [ ] **Step 2: Suite + commit** `feat(curation): operational interface pass`.

### Task 11: Full validation + final report

**Files:**
- Modify: `docs/REDESIGN_QA.md` (v2 section), `docs/REDESIGN_AUDIT.md` (status column update)

- [ ] **Step 1:** `npm test`, `npx playwright test --workers=1`, `npm run check`, `VERCEL=1 npm run build` — all green; record actual numbers.
- [ ] **Step 2:** Crawler full pass (120 pages, overflow/console matrix) + before/after screenshot comparison for the 8 representative pages (home, categories, marketplace, detail, roadmap, tutorial, runbook, admin) — record remaining differences honestly.
- [ ] **Step 3:** Commit + push `docs: redesign validation report v2`.

## Self-Review

- Spec coverage: §5 shell (T4), §6 home (T5), §7 categories (T2), §8 roadmap/tutorials/marketplace-detail/listings/runbooks/curation (T6–T10), §9 trust (existing + T5 gate), §10 diagrams (T5/T9), §12 QA (T11), §1 audit (existing docs + T11 refresh). §3 identity: tokens already exist — documented, reused, not reinvented. Deferred (recorded in T11): comparison feature, incident-assistant interactive tooling, finance vertical — acceptance criteria documented, not built.
- Step scan: every step names exact files, helpers, or assertions; no "handle edge cases" placeholders.
- Type consistency: `PHASES` shape used identically in T2/T5/T6; filter helper naming mirrors `filter-state.mjs` conventions.
- Proportion: plan shorter than the spec it implements; code bodies omitted (signatures + assertions only).
