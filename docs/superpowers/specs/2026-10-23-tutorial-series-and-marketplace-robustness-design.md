# Design — 13×10 Tutorial Series + Marketplace Robustness

Date: 2026-10-23 · Status: approved in chat ("continue" on the recommendation:
discovery-first sourcing + robustness #1–3).

## Intent

DE//AGENT should read as a real tutorial site: every one of the 13 roadmap
stages carries an ordered 10-lesson series, and the marketplace behaves like a
trustworthy marketplace (real signals, no stale or fake data).

## Track 1 — Tutorial series

### Data model
- Tutorial YAML gains: `series: <stage-key>`, `series_title: <string>`,
  `lesson: <1..10>`.
- normalize.mjs passes `series`, `series_title`, `lesson` through to the
  registry; emit computes the ordered lesson list per series.
- Existing 44 tutorials keep ids/slugs; they gain series + lesson numbers
  (re-sequenced where needed). data-quality's 8 become lessons 1–8 + 2 new.

### Pages
- New `/series/<stage>/` page: series intro, ordered lessons (1–10) with
  descriptions, "what you'll be able to do" line, cites from registry. SEO
  head-term target ("learn streaming data engineering").
- Tutorial detail page (ResourceDetail, type tutorial): breadcrumb chip
  "Lesson N of 10 · <series_title>" linking to the series page + prev/next
  lesson links.
- Stage pages + tutorials.astro link to their series page.

### Pedagogical arc (every series)
1 mental model · 2 first hands-on · 3–4 core skills · 5–6 intermediate
patterns · 7 tooling · 8 production gotchas · 9 incident/scaling · 10 capstone
checklist.

### Sourcing (no-fabrication rule unchanged)
- Every lesson cites ≥1 real registry resource via from_id/from_field.
- Thin stages (foundations: 2 resources, system-design: 1, observability: 7):
  run discovery first to add real sources; if discovery can't supply enough,
  lessons cite the few sources at field level (honest, slightly repetitive).

### Authoring operation
- 86 new tutorials via parallel subagents in batches of 2–3 stages; each
  batch must pass `node pipelines/run.mjs --check` (citations, schema,
  duplicate slugs) before the next batch starts.
- Series order = roadmap main_path order.

## Track 2 — Marketplace robustness (priority order)

1. **Votes DB → real ratings** (was: hardcoded zeros). POST /api/ratings with
   validation + per-visitor dedupe, Turso/sqlite storage; pipeline reads
   aggregates into `rating_avg`/`rating_count`/`install_count`.
2. **Trust-scan freshness gate**: run.mjs emits trust findings fresh each
   build (local scan, no network); detail pages hide the card when older
   than 7 days or missing.
3. **URL-shape validation** in VALIDATE: `github_url` must match
   `https://github.com/<owner>/<repo>` when present — kills the 404 class.

## Non-goals

- No paid/locked content. No fabricating sources to fill stages. No new
  framework (Astro + existing pipeline only).

## Verification

- Unit: series payload/normalize, prev/next computation, URL validation,
  trust-gate age logic.
- e2e: series page renders 10 ordered lessons; tutorial page shows
  Lesson-N-of-10 + prev/next.
- `pipelines/run.mjs --check` green per authoring batch; sitemap includes
  /series/*.
