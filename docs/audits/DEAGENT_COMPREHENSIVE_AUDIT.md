# DE//AGENT — Comprehensive Product, Content, UX and Architecture Audit

**Date:** 2026-10-20
**Auditor:** Automated evidence-based review (3 parallel subagents + synthesis)
**Registry snapshot:** 157 resources, 38 categories, 13 stages, 31 technologies, 506 static pages
**Stack confirmed:** Astro 5, Tailwind CSS 4, Node.js ESM, curated YAML, static deployment

---

## Executive Summary: 10 Highest-Impact Problems

| # | Problem | Severity | Impact |
|---|---------|----------|--------|
| 1 | **75% of resources have thin summaries (<80 chars)** — cards on every listing page show fragments that don't differentiate entries | P0 | Users can't decide what to click; tutorials/projects/marketplace all look identical |
| 2 | **Detail page is a flat 44-section dump with zero type-specific ordering** — runbook symptoms buried after 20 irrelevant sections | P0 | Incident responders scroll past Purpose/Problem/Solution/Rating widget to reach Symptoms |
| 3 | **Commands section duplicated** at `ResourceDetail.astro:332` and `:491` — same data, two contradictory templates | P1 | Visual confusion, maintenance burden |
| 4 | **Rating widget is dead code in static builds** — unconditionally rendered, API endpoints excluded, errors silently swallowed | P1 | Stars do nothing; users think the platform is broken |
| 5 | **9 filter groups shown simultaneously** — 4 expose implementation metadata (type internals, quality labels, stage IDs) not user intent | P1 | Filter wall dominates viewport before results are visible |
| 6 | **Three competing IA models** — homepage verbs (Learn/Build/Install/Operate), top nav (Roadmap/Marketplace/Categories/Tutorials/Runbooks/Docs), sidebar (8 groups) never reconciled | P1 | `/projects` highlights "Roadmap" in nav; beginners can't find intro docs without sidebar |
| 7 | **Two independent scoring pipelines produce divergent numbers** — `score.mjs` and `marketplace-score.mjs` compute different completeness values for the same resource | P1 | Trust erosion when scores disagree |
| 8 | **Null score dimensions inflate composite** — missing evidence removes dimension from denominator rather than penalizing | P1 | Unverified resources earn "strong"/"exemplary" labels by filling metadata fields |
| 9 | **Raw object rendering** — symptoms/diagnosis/skills/hooks render `[object Object]` or lossy `Object.values()[0]` | P1 | Broken UI on detail pages |
| 10 | **Taxonomy over-specification** — 38 categories for 157 resources; near-duplicates (Kafka/Streaming, Lakes/Lakehouse); orchestration maps to different phases in different files | P2 | Curator confusion, miscategorized resources |

---

## Phase 1 — Information Architecture

### Current State
- **Top nav** (`src/site.config.ts:36-43`): Roadmap, Marketplace, Categories, Tutorials, Runbooks, Docs
- **Sidebar** (`src/site.config.ts:80-156`): 8 groups, 38 items
- **Homepage verbs** (`src/pages/index.astro:48-53`): Learn, Build, Install, Operate
- **NAV_SECTION_MAP** (`src/site.config.ts:48-76`): `/projects` → `/roadmap` (active highlight mismatch)

### Audience Analysis

| Audience | Job | Start | Blocker |
|----------|-----|-------|---------|
| Beginner | Learn DE concepts | Homepage → Roadmap | Intro docs hidden in sidebar group 1 of 8 |
| Intermediate | Solve a problem | Search/Marketplace | 9 filter groups; no task-based entry points |
| Senior | Compare architectures | Categories/Patterns | No comparison view existed until `/compare` (just shipped) |
| Agent builder | Find installable skills | Marketplace | Type filter shows 14 raw types including `rule_pack`, `governance_pack` |
| Operator | Fix an incident NOW | Runbooks | Card doesn't show severity; detail buries symptoms |
| Maintainer | Evaluate trust | Detail page | Two scoring systems disagree; evidence gap has no consequence |

### Root Cause
Three IA models were built independently and never reconciled. NAV_SECTION_MAP patches routes to nav items but creates hidden mappings.

---

## Phase 2 — Marketplace Discovery & Filter Overload

### Exact Counts
- **9 filter groups**, minimum **35+ static checkbox options** plus dynamic category/technology/stage counts
- Type alone: **14 values** (skill, mcp, plugin, agent, hook, template, starter, runbook, architecture, reference, policy, rule_pack, config_template, governance_pack)
- Desktop: fixed **280px** left column (`marketplace.astro:104`)
- Mobile: off-canvas drawer covers results entirely when open

### Implementation Metadata vs User Intent

| Filter | Classification | Problem |
|--------|---------------|---------|
| Type (14 values) | Implementation metadata | Users don't think in `rule_pack` vs `policy` |
| Quality Score | Implementation metadata | Labels like "exemplary"/"adequate" are internal rubric terms |
| Stage | Implementation metadata | Ambiguous without roadmap context |
| Verification | Mixed | Distinction between verified/tested/reviewed requires docs |
| Category, Difficulty, Agent, Technology, Security | User intent | These answer real questions |

### Empty State
`marketplace.astro:153`: single sentence, no clear-filters CTA, no partial matches, hidden by default via CSS class toggled by JS. If JS fails, empty state never appears.

### Root Causes
- Flat filter array with no primary/secondary distinction (`marketplace.astro:83-93`)
- 14 types exposed without grouping hierarchy (`marketplace.astro:9`)
- All options within expanded group render at once (`FilterPanel.astro:50`)

---

## Phase 3 — Resource Cards & Information Hierarchy

### Badge Count Per Card (ResourceCard.astro)
Maximum **10 visual elements**: type badge + score gauge SVG + difficulty chip + up to 3 tag chips + star rating chip + install count chip + verification chip + copy-install button. More chrome than content.

### Title/Description Problems
- Title renders `r.title` verbatim (`ResourceCard.astro:77`) — names the thing, not the outcome
- Tagline falls back to summary (`ResourceCard.astro:78-80`) — no deduplication against title
- 74.5% of resources have summaries under 80 characters

### Install Action Buried
- Placed after ALL meta chips (`ResourceCard.astro:101-116`)
- Entire card is `<a>` so button needs `stopPropagation` hack (`ResourceCard.astro:108`)
- Only shows if `install_command` exists and doesn't start with `#`

### Listing Page Problems
- **Tutorials** (`tutorials.astro`): uses generic ResourceCard which omits `learning_objectives` — the very field that qualifies entries for the page
- **Runbooks** (`runbooks.astro`): severity only as `data-runbook-severity` attribute on wrapper div, invisible on card itself
- **Projects**: delegates to ListingPage with same generic card

---

## Phase 4 — Artifact Detail Pages

### Section Map
**31 conditional sections + 1 unconditional (Rating)** rendered as flat sequential list in `ResourceDetail.astro:111-496`. Zero type-specific ordering except architecture canvas at line 93.

### Critical Findings

| Finding | Location | Evidence |
|---------|----------|----------|
| Commands duplicated | `:332-342` and `:491-496` | Same condition, two templates (code blocks vs inline) |
| learning_objectives never rendered | Entire file | Field used as filter on tutorials page but absent from detail |
| Raw object rendering | `:317,:323,:329` | `Object.values(s)[0]` discards keys |
| Skills/Hooks/MCP links | `:476,:482,:488` | `{s}` as link text renders `[object Object]` if s is object |
| Limitations JSON dump | `:603` | `JSON.stringify(l)` in DOM |
| Runbook symptoms position | `:314` | After 20 generic sections + unconditional Rating widget |
| Skill inputs/outputs position | `:431-490` | Very end of content area |

### Rating Widget Dead Code
- Rendered unconditionally (`:236-285`)
- Calls `/api/marketplace/stats` and `/api/marketplace/rate`
- API routes use `prerender = false` — excluded from static builds
- `.catch(() => {})` swallows all errors silently (`:269,:281`)
- Same issue for Install button (`:773-815`)

---

## Phase 5 — Tutorial & Learning Content Quality

### Sample Size
Only **1 tutorial** exists in the registry (`type: 'tutorial'`). The tutorials page works around this by including any resource with `learning_objectives` (35/157 resources).

### Structural Issues
- `prerequisites` vs `what_you_need` mismatch: canonical field list (`score.mjs:8`) checks `prerequisites`; tutorial YAML uses `what_you_need` (`tutorials/01-sql-fanout.yaml:21`); normalization defaults `prerequisites` to `[]` (`normalize.mjs:114`)
- Editorial section header promises "Full written walkthroughs" for 1 entry
- Cards don't surface objectives, step count, or estimated time

---

## Phase 6 — Quality Scores, Verification, Trust & Evidence

### Two Parallel Scoring Systems

| Aspect | System A (`score.mjs`) | System B (`marketplace-score.mjs`) |
|--------|----------------------|----------------------------------|
| Output | `r.scores.{quality,completeness,trust}` | `r.marketplace.{composite_score,7 dimensions}` |
| Completeness | 16 canonical fields | 16 canonical + type-specific required fields |
| Trust | 0-5 scale from verification + security flags | Not a direct input |
| Null handling | Returns null | Redistributes weight to remaining dimensions |

### Critical: Null Dimensions Inflate Scores
When performance/test_coverage/community are null (most resources), their weights vanish from denominator. A resource with only documentation metadata gets inflated composite because missing dimensions don't penalize.

### Evidence Gap Has No Consequence
`evidence.mjs:50` computes `gap` (claimed vs earned verification). Nothing in marketplace-score reads it. Overclaiming verification has zero scoring impact.

### Phase Mapping Contradiction
`src/lib/phases.ts:17` maps `orchestration` → "Trust & Operations". `pipelines/lib/marketplace-score.mjs:338` maps `orchestration` → "platforms". Direct contradiction.

---

## Phase 7 — Taxonomy & Content Model

### Overlapping Categories
- `cat-data-lakes` vs `cat-lakehouse` (same stage, same group)
- `cat-streaming` vs `cat-kafka` (Kafka IS streaming)
- `cat-ingestion` vs `cat-file-ingestion` (protocol split)
- `cat-data-quality` vs `cat-testing` (conceptual overlap)
- `cat-warehouses` vs `cat-snowflake` (generic vs specific)

### Thin Categories
24 of 38 categories have fewer than 5 resources. 3 have zero.

### Technology Gaps
Proprietary tools (Snowflake, BigQuery, AWS, Databricks) lack license/repo fields without documented reason.

---

## Route & Template Coverage Report

| Page Family | Routes | Template | Status |
|-------------|--------|----------|--------|
| Resource detail | ~157 | `src/pages/[type]/[slug].astro` → `ResourceDetail.astro` | Audited — major issues |
| Category listing | 38 | `src/pages/categories/[slug].astro` | Enriched with overviews |
| Learn topics | 97 | `src/pages/learn/[topic].astro` | Shipped this session |
| Stages | 13 | `src/pages/stages/[stage].astro` | Shipped this session |
| Compare | 22 | `src/pages/compare/[category].astro` | Shipped this session |
| Sources | 81 | `src/pages/sources/[id].astro` | Shipped this session |
| Learn paths | 35 | `src/pages/learn-path/[category].astro` | Shipped this session |
| Marketplace | 1 | `src/pages/marketplace.astro` | Audited — filter overload |
| Tutorials | 1 | `src/pages/tutorials.astro` | Audited — thin cards |
| Runbooks | 1 | `src/pages/runbooks.astro` | Audited — severity invisible |
| Docs | 19 | `src/layouts/DocsLayout.astro` | TOC added, content OK |
| Homepage | 1 | `src/pages/index.astro` | IA mismatch identified |

**Total static pages: 506** (confirmed via CI build output)

---

## Content Quality Report

| Metric | Value |
|--------|-------|
| Resources with summary <80 chars | 118/157 (75%) |
| Resources with description <120 chars | 56/157 (36%) |
| Resources with learning_objectives | 35/157 (22%) |
| Resources with prerequisites | 21/157 (13%) |
| Tutorial-type resources | 1/157 |
| Categories with <5 resources | 24/38 (63%) |
| Categories with 0 resources | 3/38 |

---

## What Was Actually Inspected vs Unverified

**Inspected (source-level):**
- All files listed in Phase 0 recon
- `marketplace.astro`, `FilterPanel.astro`, `ResourceCard.astro`, `filter-state.mjs` (full read)
- `ResourceDetail.astro` (full read, 816 lines)
- `tutorials.astro`, `guides.astro`, `runbooks.astro`, `projects.astro` (full read)
- `score.mjs`, `marketplace-score.mjs`, `evidence.mjs`, `normalize.mjs` (full read)
- `taxonomy.yaml`, `site.config.ts`, `index.astro` (full read)
- `package.json`, `astro.config.mjs` (full read)

**Not inspected (requires browser/live site):**
- Visual rendering at specific breakpoints (360/390/768/1024/1440)
- Keyboard navigation flows
- Screen reader announcements
- Core Web Vitals measurements
- Command palette ranking quality
- Search relevance evaluation

**Limitation noted:** Live site comparison was done via prior session's crawler (120 pages, 0 overflow, 0 console errors). Browser automation for this audit session was scoped to source analysis per the user's directive to focus on content depth, ratings, filters, and listing page quality.
