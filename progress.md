# Amp-Format Redesign — Progress

Contract: `docs/superpowers/specs/2026-10-07-amp-format-redesign-design.md`

## 1. Foundation: global.css cleanup ✓
- [x] Read remaining lines ~620–1052
- [x] Delete dead `@font-face` blocks (fonts come from @fontsource imports in BaseLayout)
- [x] Dedupe reduced-motion block (kept the one in @layer utilities)
- [x] Remove dead CSS: `.toast*`, `.avatar*`, `.divider*`, `.line-draw`, `.shimmer`, `.card-bordered`, `.shell-x` (replaced by `.col`), `.mono-label-sm`, `.btn-icon`, `.char-bounce`, `.pulse-glow`, duplicate tokens (`--border-focus`, `--stagger-max`, `--shadow-xs`)
- [x] Add amp-style utilities: `.kicker`, `.display-hero`, `.display-section`, `.lede`, `.hairline`/`.hairline-block`, `.link-arrow`, `.col` (1120px), `.section`/`.section-sm`

## 2. Shared components (`src/components/`) ✓
- [x] `PageHero.astro`
- [x] `SectionHeader.astro`
- [x] `ResourceCard.astro`

## 3. BaseLayout fixes ✓
- [x] Single ⌘K keydown handler (removed duplicate block + duplicate sidebar wiring)
- [x] Single `#sidebar-scrim` (moved to BaseLayout; removed from TopBar/SidebarNav)
- [x] Skip-link: `.skip-link` plain CSS (replaced invalid `focus:btn`)

## 4. Homepage rebuild (`src/pages/index.astro`) ✓
- [x] Hero rotating headline (no-JS fallback shows first line; reduced-motion static)
- [x] "A Day in the Platform" (13 stages → `/roadmap#<slug>`)
- [x] Five feature cards w/ real faux UI (install, verification, security, runbook, architecture)
- [x] "Learn by building" (starters + architectures)
- [x] "Registry in numbers" stat band (from stats.json)
- [x] Install band
- [x] "Fresh from the registry" (6 newest + View all)
- [x] Removed `.char-bounce`/`.pulse-glow` usage + CSS pruned; build passes (184 pages)

## 5. Reskin group A ✓
- [x] /roadmap chapter timeline (01–13, #<slug> anchors)
- [x] /marketplace FilterGroup + ResourceCard grid
- [x] /resources/[slug] prose + sticky meta rail (fixed .surface)

## 6. Reskin group B ✓
- [x] Listing pages via shared ListingPage.astro (skills, mcp, agents, hooks, projects, runbooks)
- [x] /taxonomy
- [x] /categories/[slug]
- [x] /search

## 7. Fixes
- [x] `.surface` class → replaced across all components/pages (grep clean)
- [x] `ResourceDetail.astro` extracted from resources/[slug]; new `[type]/[slug]` route so `r.url` pretty paths (/skills/…, /mcp/…) no longer 404
- [x] `site.config.ts`: TOP_NAV real routes only; sidebar/footer dead routes → `soon` badge, non-links (SidebarNav + Footer)
- [x] `src/pages/404.astro` (branded)
- [x] `src/pages/rss.xml.ts` (`@astrojs/rss`, last_verified w/ generated_at fallback)
- [x] `public/og.svg` (1200×630)

## 8. Verify
- [x] `npm run build` (320 pages)
- [x] `npm run check` (0 errors; installed @astrojs/check+typescript dev deps; fixed ~80 type errors in new/reskinned files)
- [x] web-design-guidelines audit (fixed: search input a11y attrs, ResourceCard Intl dates + content-visibility; focus/labels/reduced-motion/color-scheme verified)
- [x] re-verify after audit fixes: check 0 errors, build 320 pages

## 9. Strengthen pass (content + cards + homepage)
- [x] Docs Get Started set (DocsLayout + docs/index, how-it-works, verification, security); nav un-badged (324 pages)
- [x] Preview server running (localhost:4321)
- [ ] Token layer: shell/card separation + semantic --primary/--secondary/--card tokens (nextjs.org-style)
- [x] Homepage: 13-row list → 4 phase cards (Foundations/Platforms/Trust & Ops/Advanced & Agentic) + roadmap CTA
- [x] docs/ui-refactoring.md (token layers, card recipe, page grammar, motion/a11y, migration checklist) (token layer, card recipe, dos/donts)
- [x] Verify: check 0 errors, build 324 pages, preview shows phase cards

## 9. Strengthen pass (content + cards + homepage)
- [x] Docs Get Started set (DocsLayout + 4 docs pages); nav un-badged (324 pages)
- [x] Preview server running (localhost:4321)
- [x] Token layer: --shell deepened, --card/--card-hover/--card-border(+hover), --primary/--secondary/--muted/--ring (both themes); .card + hover consume them
- [ ] Homepage: decompose 13-stage list into 4 phase cards + roadmap CTA
- [ ] docs/ui-refactoring.md
- [ ] Verify: check 0 errors, build green

## 10. Palette/matrix + filters + content pipeline
- [x] stronger dark/light palettes (shell #050706/#dfe3d8, borders 19%/22%)
- [x] .card-grid 3-col matrix on all listing pages
- [ ] verify light+dark screenshots in preview
- [ ] marketplace + category: sticky scrollable filter rail (mobile: details panel)
- [ ] pipelines/refresh-provenance.mjs (GitHub metadata → data/cache/provenance.json, demote stale)
- [ ] .github/workflows/weekly-refresh.yml (cron Mon 06:00 UTC → opens PR)
- [ ] full content pages: content: markdown in curated YAML → ResourceDetail prose
- [ ] seed 3-5 exemplar content bodies; verify build green

## 11. All "soon" routes implemented (2026-10-09)
- [x] /categories — grid of 38 canonical categories w/ counts + stage chips
- [x] /tutorials — 30 entries with learning_objectives, grouped Beginner/Intermediate/Advanced
- [x] /plugins, /templates (template+starter), /patterns (architecture) — ListingPage routes
- [x] /agentic — five-primitive overview, blast-radius signal counts, stage-13 grid, docs CTAs
- [x] Docs: skill-anatomy, tooling, content-model, scoring, ingestion, relationships, contributing (DocsLayout, grounded in score.mjs / normalize.mjs / registry-meta.yaml / run.mjs)
- [x] /admin — six-step curation workflow + verification tier state (stats.json)
- [x] /admin/health — coverage (135, 90% reviewed+tested, 0 stale), type/difficulty mix, trust signals, stage bars
- [x] site.config.ts: all badge:'soon' removed (sidebar + footer)
- [x] Fix: BaseLayout pageTitle guard so titles don't double the site suffix
- [x] Fix: emit.mjs now also writes public/data/generated/search-index.json (palette fetch 404 resolved)
- [x] npm run check: 0 errors · npm run build: 339 pages green; preview spot-checks OK (tutorials, agentic, admin/health)

## 12. Content scale: online discovery loop (2026-10-09)
- [x] Brainstorm: deeper curated content, agent-drafted + human-reviewed, full auto-classification of feed items
- [x] data/curated/sources.yaml — 12 verified trusted sources (AWS Big Data, Databricks, Snowflake, Confluent, dbt Labs, Netflix, Airbnb, DuckDB + 3 GitHub topic searches); broken feeds disabled fail-closed
- [x] docs/style-guide.md — plain-language voice rules (gatekeeping words banned, style lint in validate.mjs)
- [x] pipelines/discover.mjs — FETCH->EXTRACT->CLASSIFY->DRAFT; rules classifier backend; seen-URL dedupe; excerpt cap (summarize-link only)
- [x] data/drafts/ isolation contract + tests (drafts physically outside curated; artifacts scanned for draft markers)
- [x] /admin/queue — review queue page grouped by classifier confidence
- [x] .github/workflows/content-discovery.yml — weekly cron + manual, opens draft-batch PR via gh
- [x] Live run: 215 items fetched, 36 drafts written, dedupe confirmed on rerun
- [x] 12/12 unit tests (feed fixtures + classification + isolation) · npm run check 0 errors · build 340 pages green
- Phase 2 next: bodies for 111 thin resources; then category chapters; then registry widening 135->~350

## 13. Source expansion: 57 verified trusted sources (2026-10-09)
- [x] sources.yaml 12 -> 57 sources in 6 lanes: vendor-eng (11) · company-eng (7) · llm-labs (8) · education (11) · youtube (4) · github (16: 9 orgs + 7 topic searches)
- [x] LLM-lab lane covers the artifact request: OpenAI, Mistral, HF, Google AI/Dev, LangChain blogs + GitHub orgs for Anthropic/DeepMind/Google/DeepSeek/Kimi/Moonshot/Zhipu/Mistral/CrewAI/MCP
- [x] Education lane: Coursera, freeCodeCamp x2, TDS, Medium data-science, PyBites, Joseph Machado, SeattleDataGuy, Martin Heinz, SQLServerCentral, SQLskills, Percona
- [x] YouTube lane (project-based -> tutorial): ArjanCodes, freeCodeCamp, TechWorld with Nana, sentdex (atom feeds)
- [x] Fail-closed policy held: datacamp/udemy/kdnuggets (403), anthropic/deepmind/cohere (no RSS) documented-disabled, working endpoints only
- [x] Per-source default_category / default_type hints (safe-fallback only, never override confident rules)
- [x] New source kinds: github-org (org repos API); classify signals expanded (LLM labs, tutorial vocab); hint resolution via resolveClassification
- [x] Politeness + robustness: per-host UA override (YouTube), GITHUB_TOKEN auth when set, 400ms inter-source pacing
- [x] Full dry run: 3,318 items fetched · 0 source failures with token-less github throttling isolated · 12/12 tests · check 0 errors · build 340 pages
