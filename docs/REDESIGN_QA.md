# DE//AGENT Redesign — QA Report

Date: 2026-10-18 · Scope: full-platform premium design overhaul
(plan: `docs/superpowers/plans/2026-10-17-de-agent-design-overhaul.md`,
audit: `docs/REDESIGN_AUDIT.md`).

> **2026-10-18 (later same day):** the premium-platform-redesign phase (plan
> `docs/superpowers/plans/2026-10-18-premium-platform-redesign.md`) shipped on top
> of this work — see "Redesign phase 2" below. The original overhaul report follows
> unchanged.

## Verification summary — all green

| Check | Command | Result |
| --- | --- | --- |
| Unit + pipeline tests | `npm test` | **225 pass / 0 fail** |
| Type check | `npm run check` (astro check) | **183 files, 0 errors** |
| E2E (full suite) | `npx playwright test --workers=1` | **36 pass / 0 fail** (desktop + mobile projects) |
| Production build | `VERCEL=1 npm run build` | **succeeds** (server output + Vercel adapter) |
| Audit crawler | `node tests/audit/audit-crawler.mjs` | **120 pages, 0 horizontal overflow, 0 console errors** |

## Crawler matrix (after overhaul)

120 routes × 4 viewports (375 / 768 / 1024 / 1440) → `test-results/audit/`:
`0` pages with `document.scrollWidth - clientWidth > 1`, `0` console errors
(screenshots per route/viewport in the same directory). Baseline (pre-overhaul)
report is in git history; the audit findings it produced are enumerated in
`docs/REDESIGN_AUDIT.md`.

## Findings → fixes (traceability)

| Audit ID | Finding | Fix | Contract |
| --- | --- | --- | --- |
| P0-1 | Raw markdown (`##`, `**`) rendered literally on detail pages | `marked`-rendered HTML in `.prose-de.prose-measure` | shell.spec P0-1 |
| P0-2 | 54px horizontal overflow at 768px (header) | `lg` breakpoint nav; overflow contract across 7 routes | shell.spec P0-2 |
| P0-3 | 220px overflow on roadmap at 375px | `.chip` wrap policy | shell.spec P0-3 |
| P1-1 | Sidebar missing on most pages (shell jump) | `BaseLayout` defaults `sidebar=true`; footer on all pages | shell.spec P1-1 |
| P1-2 | No icons in nav or drawer | `Icon.astro` glyph set; every sidebar/drawer item iconized | shell.spec P1-2 |
| P1-3 | Sticky odd filters, no URL sync | `FilterPanel`, URL sync, chips, clear-all, mobile drawer | shell.spec P1-3 + `filter-state` unit tests |
| P1-4 | Inconsistent centering/measures | `.prose-measure` (72ch centered) / `.prose-measure-l` (hero-aligned) | shell.spec P1-4 |
| P2 | Raw decimal score chips ("adequate (57.14)") | Score meter (track/fill/integer/label) from canonical banding | `format-score` unit tests |
| P2 | Rating stars tiny targets | 44×44px buttons, focus-visible rings, plural votes | visual + manual |

Latent bugs fixed en route: sort read nonexistent `data-marketplace`/`data-updated`
(every sort was a no-op); quality + agent filters referenced nonexistent card
attributes (checking them hid all cards); duplicate sidebar scrim; dev query-strip
root cause in `astro/dist/core/request.js` (all API routes now `prerender = false`).

## E2E stability notes

- Playwright manages its own dev server on port 4322 (`reuseExistingServer` off-CI).
  Under `fullyParallel` (2 workers) the dev server intermittently dies on this Windows
  machine (`ERR_ABORTED`, connection refused mid-run) — full-suite runs use
  `--workers=1` (36 pass). CI should do the same or raise the server timeout.
- `getStaticPaths() ignored in dynamic page` warnings for `categories/[slug]` and
  `[type]/[slug]` are pre-existing server-mode behavior (pages render per request on
  Vercel); not a regression.

## Limitations / known gaps

- Lighthouse not run in CI; perf numbers are not part of the contract yet.
- The audit crawler's overflow metric uses `scrollWidth - clientWidth > 1` — subpixel
  rounding below 1px is tolerated by design.
- Category-page filters don't URL-sync yet (marketplace does); the shared helper
  (`src/lib/filter-state.mjs`) makes it a mechanical follow-up.
- Deploy chain (emanisha.in embed) is verified by the emanisha-site workflow +
  Hostinger manual pull; this report covers the platform only.

---

## Redesign phase 2 — premium platform implementation (2026-10-18)

Plan: `docs/superpowers/plans/2026-10-18-premium-platform-redesign.md` (11 tasks, all
executed and committed to `main`).

### Final verification — all green

| Check | Command | Result |
| --- | --- | --- |
| Unit + pipeline + gate tests | `npm test` | **247 pass / 0 fail** |
| E2E (full suite, desktop + mobile) | `npx playwright test --workers=1` | **62 pass / 0 fail** |
| Type check | `npm run check` | **195 files, 0 errors** |
| Production build | `VERCEL=1 npm run build` | **succeeds** |
| Audit crawler (post-redesign) | `node tests/audit/audit-crawler.mjs` | **120 pages, 0 overflow, 0 console errors** |

### Shipped (commits 899e8be → 2440056)

| Area | What changed |
| --- | --- |
| Canonical data | `src/lib/phases.ts` — the 4-phase/13-stage grouping lives in one module (was hard-coded in the homepage); homepage/roadmap/categories all consume it |
| `/categories` | Phase-grouped stage sections, compact category rows, URL-synced search/phase/sort (`?q=&phase=&sort=`), clearable; full catalogue stays in static HTML; e2e covers reload/back/forward/Escape |
| `/taxonomy` | Derived structure strip, stage tables (category → count → types present), technology table with usage counts; O(n²) frontmatter scans fixed |
| Shell | Breadcrumbs (Home / Category / Resource) on detail pages, platform-aware ⌘K/Ctrl K hint, `prefers-reduced-motion` guard, listing empty states |
| Homepage | Split technical hero with original PipelineDiagram SVG, Learn/Build/Install/Operate quartet, top-rated entries (derived from real composite scores), four-level trust panel with derived counts, contribution invite |
| `/roadmap` | Phase rail + phase-grouped journey; per-stage outcomes rendered; prerequisites omitted (field does not exist in data — nothing fabricated) |
| `/tutorials` | Editorial walkthroughs (type=tutorial) separated from practicum; honest plurals; duration omitted (no data) |
| `/guides` | Index derived from md frontmatter — the old hard-coded arrays carried invented badges; real `kicker`/`kind`/`validation` fields used |
| Type listings | Derived hero stats (entries, verified subset, avg composite, difficulty spread) — pages differentiated |
| Runbooks | Symptoms/Diagnosis/Possible causes sections; severity = icon + word (never color alone) |
| Architecture | Original ArchitectureCanvas SVG on pattern details |
| Curation | Health page: source health as a table; 4 duplicate `style` attributes fixed (second attr was silently dropped) |

### Standing gates added (regression tripwires)

- `tests/no-hardcoded-totals.test.mjs` — bans literal "38 categories"-style counts in
  templates (caught and fixed 2 real offenders on roadmap + taxonomy).
- `tests/trust-copy.test.mjs` — bans fabricated trust claims ("independently
  verified", "audited", "enterprise-grade", …) in templates.
- `tests/phases.test.mjs`, `tests/category-filters.test.mjs` — canonical grouping and
  URL round-trip contracts.

### Before/after evidence

- Before screenshots: regenerated by the audit crawler into `test-results/audit/`
  (gitignored — run `node tests/audit/audit-crawler.mjs` to reproduce; 120 pages ×
  4 viewports with metrics JSON).
- After: same crawler run post-redesign (identical matrix, 0/0). Homepage after-shots
  at 4 widths: `test-results/audit/home-{375,768,1024,1440}-after.png`.
- Honest note: the two crawler runs are not pixel-diffed; the comparison is the
  finding→fix traceability table above plus the 0-overflow/0-console-error matrix.

### Deliberately deferred (with acceptance criteria owed)

1. **Registry comparison view** (brief §4C "comparison") — needs product decision on
   which fields compare side-by-side; data layer ready (`marketplace` on every resource).
2. **Category `[slug]` page URL-sync** — filters work but don't serialize to the URL
   yet (marketplace + `/categories` do); mechanical follow-up using
   `src/lib/filter-state.mjs` conventions.
3. **Lighthouse/axe CI measurement** — reduced-motion, focus-visible and contrast are
   e2e-covered where feasible; measured scores still owed.
4. **Incident-assistant interactive tooling & finance vertical** — separate features
   per brief §G; not started, not silently dropped.

### Pre-existing issues not caused by the redesign

- `getStaticPaths() ignored in dynamic page` build warnings (server-mode behavior).
- One editorial tutorial exists; the tutorials page honestly reflects the thin library.
