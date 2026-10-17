# DE//AGENT — Full-Platform Design Audit

Date: 2026-10-17 · Method: repo recon + Playwright crawler (`tests/audit/audit-crawler.mjs`)
Coverage: 30 routes × 4 viewports (375 / 768 / 1024 / 1440) = 120 page audits,
screenshots in `test-results/audit/`, raw metrics in `test-results/audit/audit-report.json`.

## 1. Route inventory (from `src/pages`, grouped by template)

| Template family | Routes | Shared template |
|---|---|---|
| Home | `/` | `index.astro` (no sidebar) |
| Marketplace | `/marketplace` | custom grid + sticky filter `<aside>` |
| Type listings (12) | `/skills` `/mcp` `/agents` `/hooks` `/plugins` `/templates` `/patterns` `/projects` `/runbooks` `/references` `/tutorials` `/resources` (+ `/guides`, `/references`) | `ListingPage.astro` (sidebar, no filters) |
| Resource detail | `/[type]/[slug]` — all 157 resources | `ResourceDetail.astro` (sidebar) |
| Tutorial detail | `/tutorials/sql-fanout-review` | dedicated tutorial layout |
| Roadmap | `/roadmap` | custom (sidebar) |
| Taxonomy | `/taxonomy`, `/categories` | custom (sidebar) |
| Category | `/categories/[slug]` — 35 categories | custom (sidebar, filters) |
| Docs | `/docs`, `/docs/*` (13 pages) | `DocsLayout.astro` |
| Search | `/search` | custom |
| Agentic | `/agentic` | custom |
| Admin/curation | `/admin`, `/admin/queue`, `/admin/health` | custom |
| Publisher | `/publisher` | custom |
| Dashboard | `/dashboard` | custom |
| 404 | `/404` + fallback | custom |

Orphans/dead ends: `/guides` exists but nothing links to it in TOP_NAV; `Incident assistant`
sidebar item deep-links to one agent. No other dead ends found (crawler: only intentional 404s).

## 2. Findings (severity-ordered)

### P0 — broken or blocking

| # | Where | Problem | Evidence |
|---|---|---|---|
| P0-1 | Resource detail (`ResourceDetail.astro:263`) | **Body markdown rendered as raw text** — `<div class="prose-de">{res.body}</div>` prints literal `# SQL Review ## …` on every detail page. No markdown pipeline exists. | screenshot `desktop--_skills_sql-review.png` |
| P0-2 | Tablet 768px, **all 30 routes** | **Horizontal overflow of exactly 54px**: header right cluster (`ml-auto` search+theme+github+Explore) doesn't fit once the 4-item top nav appears at `md` (768px). `scrollWidth 822 vs 768`. | audit JSON, all tablet rows |
| P0-3 | Roadmap, mobile 375px | **220px overflow**: `.chip { white-space: nowrap }` — long provider-track chips (w=137–236px) can't shrink inside `minmax(0,1fr)` tracks and push the page to 595px. | `probe-roadmap.mjs` output |

### P1 — the four user-reported complaints

| # | Complaint | Root cause |
|---|---|---|
| P1-1 | "Navbar not moving/staying side in page view" | Shell inconsistency: the 300px docs sidebar appears on listings/details/roadmap/categories but is **absent on home, marketplace, search, taxonomy, agentic, admin, publisher, dashboard, 404** — the frame jumps on every navigation. Sidebar itself *is* sticky (verified: top 56px→56px after 1500px scroll); it's the presence/absence that feels broken. Sidebar also lacks inner-scroll affordance and active-section context on detail pages. |
| P1-2 | "Navbar doesn't show categories properly; each item needs an icon on short screens" | TOP_NAV has only 4 text links (Roadmap/Marketplace/Projects/Runbooks) with **no icons anywhere**; Categories/Taxonomy/Tutorials/Docs are reachable only through the text-only sidebar. Mobile drawer items are plain text (verified `anyIcons: false` across 40 items). |
| P1-3 | "Filters are sticky and look odd" | Marketplace `<aside class="sticky top-16">` holds 6 plain `<details>` boxes with tiny checkboxes and "(count)" parens; no selected-filter chips, no clear-all, no mobile drawer for filters, no URL sync. Visually dated vs the rest. |
| P1-4 | "Pages and content not centered" | With the sidebar present, the 1120px `.col` centers inside the remaining 1140px → reads left-shifted against the viewport; pages without sidebar center differently. Reading column also varies: 1120 (`.col`) vs marketplace grid vs prose width — no single consistent measure. |

### P2 — design quality

- **Card noise**: score chips render raw decimals ("adequate (57.14)", "weak (44.86)" in red) — unfriendly and alarming; tag chips + verification + difficulty + score on every card = chip soup; weak hierarchy (6+ same-weight chips per card).
- **Inconsistent card internals**: tag rows float at different heights (no `mt-auto` on some cards → mid-card whitespace, see `desktop--_skills.png` Delta Optimization Advisor card).
- **Light theme wash**: light mode background tint + grid-lines backdrop reads low-contrast; grid texture behind content adds noise.
- **Header**: no active state on detail pages (none of the 4 top-nav items match `/skills/...` → no context); `⌘K` hint assumes Mac; search button grows at sm.
- **Empty states**: type listings have no filters/hero differentiation — 12 near-identical pages.
- **Category pages** (`/categories/[slug]`): filters duplicated as bare `<details>` like marketplace; count chips unstyled against hero.
- **Rating widget**: "★ 5 · 1 vote(s) · popularity 23/100" — singular "vote(s)", tiny star targets, no hover/focus states.
- **Footer** only on non-sidebar pages (`{!sidebar && <Footer />}`) — majority of pages have no footer at all.

### P3 — accessibility & polish

- Sidebar drawer: no focus trap, no Escape handling (Escape only closes palette; sidebar close is wired), no `aria-modal`.
- Chips inside `<summary>` — clickable area small; checkbox labels lack hover states.
- `kbd ⌘K` shown on Windows/Linux (should reflect platform).
- Reveal animations don't check `prefers-reduced-motion` before transform transitions (CSS `visible` transitions run regardless — verified `.reveal` CSS).
- Detail-page `<h1>` present ✓; heading order in ResourceDetail sections inconsistent (h2 sections, ok) — no violations found by crawler beyond contrast queries pending manual pass.

### Verified-good (no change needed)

- Header stickiness works at all 4 viewports on all 30 routes (headerTop=0 after 700px scroll).
- No console errors on 12 of 15 families (only intentional 404 paths log).
- `/docs/*` pages all resolve (200, correct h1s).
- No page-level overflow on mobile/desktop for 29 of 30 routes (roadmap chips + tablet header aside).
- Sitemap/RSS/canonical/noindex infrastructure intact.

## 3. Severity → fix mapping (summary)

1. Render markdown bodies (marked, server-side, zero client JS) — P0-1
2. Header: responsive collapse plan (nav at lg, icons, compact right cluster) — fixes P0-2 + P1-2
3. `.chip` wrap policy + roadmap provider chips — fixes P0-3
4. Persistent shell: sidebar on ALL content pages (or drop sidebar pattern for a unified left rail) + icons — fixes P1-1/P1-2
5. Marketplace filter revamp: grouped panel, selected-chips, clear-all, mobile drawer, URL sync — fixes P1-3
6. Consistent centered reading column system — fixes P1-4
7. Card redesign: score as labeled meter, tag cap, `mt-auto` alignment — P2
8. Footer everywhere — P2
