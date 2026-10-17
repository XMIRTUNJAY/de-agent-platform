# DE//AGENT Redesign — QA Report

Date: 2026-10-18 · Scope: full-platform premium design overhaul
(plan: `docs/superpowers/plans/2026-10-17-de-agent-design-overhaul.md`,
audit: `docs/REDESIGN_AUDIT.md`).

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
