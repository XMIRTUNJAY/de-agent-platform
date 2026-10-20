# DE//AGENT — Remediation Plan

**Generated:** 2026-10-20
**Source:** `docs/audits/DEAGENT_AUDIT_ISSUES.json` (15 issues)
**Referenced audits:** `phase2-marketplace.md`, `phase3-4-detail-pages.md`, `phase1-5-6-7.md`

---

## Horizon A: Critical Defects (fix this week)

These are P0/P1 issues that break core user journeys or render incorrect content.

### Task A1: Remove duplicate Commands section
- **Issues:** AUD-003
- **Goal:** Eliminate contradictory double-rendering of `res.commands`
- **Affected files:** `src/components/ResourceDetail.astro:491-496`
- **Root cause:** Copy-paste duplication
- **Approach:** Delete lines 491-496. Keep lines 332-342 (code-block version with copy buttons).
- **Acceptance:** `grep "res.commands" src/components/ResourceDetail.astro` returns exactly 1 match
- **Tests:** `npm run check` passes
- **Effort:** 0.5h
- **Risk:** None — pure deletion of duplicate

### Task A2: Fix raw object rendering in detail sections
- **Issues:** AUD-009
- **Goal:** No `[object Object]` or raw JSON on any detail page
- **Affected files:** `src/components/ResourceDetail.astro:317,323,329,476,482,488,603`
- **Root cause:** Template assumes strings but data contract allows objects
- **Approach:**
  - Symptoms/Diagnosis/Possible causes (`:317,:323,:329`): If item is object, render `<strong>{key}</strong>: {value}` instead of `Object.values(s)[0]`
  - Skills/Hooks/MCP (`:476,:482,:488`): Use `s.title || s.name || s.id || String(s)` for link text
  - Limitations (`:603`): Use `String(l)` instead of `JSON.stringify(l)`
- **Acceptance:** Grep rendered HTML for `[object Object]` = 0 across all detail pages
- **Tests:** Unit test with mock resource containing object-type symptoms/skills
- **Effort:** 3h
- **Risk:** Low — defensive rendering changes only

### Task A3: Guard rating widget and install button for static builds
- **Issues:** AUD-004
- **Goal:** No dead interactive widgets in static output
- **Affected files:** `src/components/ResourceDetail.astro:236-285,755-815`
- **Root cause:** No build-mode awareness
- **Approach:** Wrap both sections in `{import.meta.env.SSR || import.meta.env.MODE !== 'production'}` check, or add `Astro.request.headers.has('x-vercel-id')` guard. Alternative: check if `/api/marketplace/stats` exists before rendering. Simplest: replace silent `.catch(() => {})` with user-visible "Ratings require server mode" text.
- **Acceptance:** Static build produces no fetch calls to `/api/marketplace/*`
- **Tests:** `Remove-Item -Recurse src/pages/api; npx astro build; grep -r "api/marketplace" dist/` = 0
- **Effort:** 2h
- **Risk:** Medium — must not break Vercel SSR mode

### Task A4: Type-specific section ordering for detail pages
- **Issues:** AUD-002
- **Goal:** Each artifact type shows its most relevant sections first
- **Affected files:** `src/components/ResourceDetail.astro:111-496`
- **Root cause:** Flat sequential rendering regardless of type
- **Approach:** Define ordered section arrays per type. Extract each section into a named fragment. Render via type-keyed lookup with generic fallback.
  - **Runbook order:** Severity banner → Symptoms → Diagnosis → Possible causes → Fix → Commands → Prevention → Monitoring → Security scan → Details → Related
  - **Skill order:** Install → What you need → Prerequisites → Steps → Inputs → Outputs → Tools → Hooks → MCP → Capabilities → Example → Tests → Details
  - **Tutorial order:** Learning objectives (ADD THIS) → What you need → Steps → Check yourself → Sourced from → Details
  - **Architecture order:** Context → Problem → Forces → Solution → Diagram → Repo structure → Architecture → Tradeoffs → Details
  - **Starter/Project order:** Setup → Repo structure → Sample data → Steps → Tests → Failure scenarios → Production hardening → Details
  - **Reference/Generic:** Current order minus duplicates
- **Acceptance:** On runbook pages, Symptoms is within first 3 visible sections
- **Tests:** E2E per type verifying heading order
- **Effort:** 8h
- **Risk:** High — large refactor of 816-line component. Do in PR with visual diff review.
- **Rollback:** Revert single file

### Task A5: Add learning_objectives section to detail pages
- **Issues:** AUD-012
- **Goal:** Tutorials show their objectives on the detail page
- **Affected files:** `src/components/ResourceDetail.astro` (insert before Steps section ~line 191)
- **Approach:** Add `{(res.learning_objectives ?? []).length > 0 && (<section><h2>Learning Objectives</h2><ul>{res.learning_objectives.map(...)}</ul></section>)}`
- **Acceptance:** `/skills/sql-review` (has objectives) shows them on detail page
- **Tests:** E2E: detail page for resource with objectives contains "Learning Objectives" heading
- **Effort:** 1h
- **Risk:** Low — additive only

---

## Horizon B: Structural Improvements (next 2 weeks)

### Task B1: Marketplace filter progressive disclosure
- **Issues:** AUD-005
- **Goal:** <=5 primary filters visible on load; advanced behind toggle
- **Affected files:** `src/pages/marketplace.astro:83-93`, `src/components/FilterPanel.astro`, `src/lib/filter-state.mjs`
- **Approach:**
  1. Split `filters` array into `primaryFilters` (Category, Type-grouped, Difficulty, Agent) and `secondaryFilters` (Verification, Security, Technology, Stage)
  2. Group 14 types into 5 super-categories: Automation (skill/hook/runbook), Configuration (config_template/rule_pack/governance_pack/policy), Integration (mcp/plugin), Blueprint (template/starter/architecture/reference), AI (agent)
  3. Remove Quality Score as filter (already available as sort option)
  4. Render primary filters always-visible in FilterPanel. Wrap secondary in single `<details>` labeled "Advanced filters"
  5. Update `filter-state.mjs` to maintain URL serialization compatibility
- **Acceptance:** Initial marketplace load shows <=5 filter groups. All existing URL query params still work.
- **Tests:** E2E: count visible filter groups on load. Verify URL round-trip with advanced filters.
- **Effort:** 6h
- **Risk:** Medium — URL compatibility must be preserved for bookmarked searches

### Task B2: ResourceCard hierarchy restructuring
- **Issues:** AUD-013, AUD-001
- **Goal:** Clear visual hierarchy with <=6 elements, install action prominent
- **Affected files:** `src/components/ResourceCard.astro`
- **Approach:**
  1. Remove wrapping `<a>`. Make title an `<a>`. Make install button standalone.
  2. New layout: Row 1 = type badge + score gauge. Row 2 = title (linked). Row 3 = tagline (max 2 lines, deduplicated against title). Row 4 = install button (if exists). Row 5 = difficulty + 2 tags + verification chip.
  3. Add fallback chain for description: `tagline || summary || first_sentence(description) || objectives_preview`
  4. Extract inline styles to scoped `<style>` block
  5. Add `interface Props { resource: RegistryResource }` replacing `any`
  6. Hide install success rate percentage from chip label
  7. Replace truncated command preview with "Copy install" label
- **Acceptance:** Visual diff shows cleaner cards. Max 6 elements. Description >= 40 chars on all cards.
- **Tests:** E2E: card-desc textContent.length >= 40 for all marketplace cards
- **Effort:** 6h
- **Risk:** Medium — affects every listing page. Visual regression testing required.

### Task B3: Unify scoring pipelines
- **Issues:** AUD-007, AUD-008, AUD-010
- **Goal:** One scoring system, null dimensions penalized, phase map deduplicated
- **Affected files:** `pipelines/lib/score.mjs`, `pipelines/lib/marketplace-score.mjs`, `pipelines/lib/evidence.mjs`, `src/lib/phases.ts`
- **Approach:**
  1. Delete `phaseMap` in `marketplace-score.mjs:331-347`. Import `PHASES` from `src/lib/phases.ts`.
  2. Treat null dimensions as 0 in weighted composite (change `marketplace-score.mjs:69-74`)
  3. Apply evidence gap multiplier: `composite *= max(0.25, 1 - gap * 0.25)`
  4. Gate composite labels: "strong"/"exemplary" require `reviewed`+ evidence level
  5. Retire `score.mjs` completeness calculation; use marketplace-score's version as canonical
  6. Add `what_you_need` as alias for `prerequisites` in canonical field list
- **Acceptance:** Each resource has exactly one score set. Null dimensions reduce composite. Phase mapping consistent.
- **Tests:** Unit: composite with 3 nulls < composite with all populated at same values. Unit: phaseOf('orchestration') consistent.
- **Effort:** 8h
- **Risk:** High — changes all composite scores. Run full pipeline + compare before/after.

### Task B4: Empty state improvement
- **Issues:** AUD-015
- **Goal:** Actionable recovery from zero-result filters
- **Affected files:** `src/pages/marketplace.astro:153`
- **Approach:** Replace static `<p>` with component containing: "Clear all filters" button (calls existing `clearBtn` logic), suggestion to remove last filter, link to browse all.
- **Acceptance:** Zero-result state includes clickable recovery action
- **Tests:** E2E: apply impossible filters, verify clear button visible and restores results
- **Effort:** 2h
- **Risk:** Low

### Task B5: Taxonomy consolidation
- **Issues:** AUD-011
- **Goal:** Eliminate overlapping categories, mark thin ones as planned
- **Affected files:** `data/curated/taxonomy.yaml`, `pipelines/lib/normalize.mjs`
- **Approach:**
  1. Merge `cat-kafka` → `cat-streaming` (update all resources referencing kafka)
  2. Merge `cat-file-ingestion` → `cat-ingestion`
  3. Add `status: planned` field to categories with <3 resources
  4. Pipeline: skip planned categories in page generation but keep in taxonomy docs
  5. Document proprietary technology license convention (`license: 'proprietary'`)
- **Acceptance:** No overlapping category pairs. All live categories have >=3 resources.
- **Tests:** Unit: no two categories share >50% keywords. Pipeline: planned categories don't generate pages.
- **Effort:** 4h
- **Risk:** Medium — URL redirects needed for merged categories

---

## Horizon C: Quality & Polish (month 2)

| Task | Issues | Effort | Description |
|------|--------|--------|-------------|
| C1: IA reconciliation | AUD-006 | 4h | Align top nav with homepage verbs. Fix NAV_SECTION_MAP. |
| C2: TutorialCard variant | AUD-012 | 3h | Dedicated card showing objectives + step count for tutorial listings |
| C3: Runbook severity on cards | AUD-012 | 1h | CSS `[data-runbook-severity]` border-left or pass severity to card |
| C4: Inline style extraction | AUD-013 | 3h | Move ResourceCard inline styles to scoped CSS |
| C5: Prop typing | AUD-013 | 1h | Replace `resource: any` with TypeScript interface |

---

## First Implementation Batch (Recommended Order)

Execute A1 → A2 → A5 → A3 → A4 in a single PR. Rationale:

1. **A1** (delete duplicate) is risk-free and immediately removes a visible bug
2. **A2** (object rendering) fixes broken UI that signals low quality
3. **A5** (learning objectives) adds missing content that the tutorials page already promises
4. **A3** (static guards) prevents confusing dead widgets
5. **A4** (type-specific ordering) is the highest-impact change but also highest-risk — doing it last in the batch means the other fixes are already clean

Then B1 + B2 in a second PR (marketplace UX overhaul). Then B3 in a third PR (scoring unification, requires pipeline re-run and score comparison).

---

## Testing Strategy

| Test Type | Command | When |
|-----------|---------|------|
| Type check | `npm run check` | After every file edit |
| Unit tests | `npm test` | After pipeline/scoring changes |
| E2E suite | `npx playwright test --workers=1` | After component changes |
| Static build | `rm -rf src/pages/api; npx astro build` | Before push |
| Link audit | `node pipelines/audit-links.mjs` | After taxonomy changes |
| Content audit | `node pipelines/audit-content.mjs` | After enrichment changes |
| Contrast probe | `node tests/audit/probe-contrast.cjs` | After CSS changes |
| Overflow probe | `node tests/audit/probe-320.cjs` | After layout changes |

---

## Verification Status Summary

| Category | Confirmed | Strongly Indicated | Hypothesis |
|----------|-----------|-------------------|------------|
| Content quality | 3 (AUD-001,009,012) | 0 | 0 |
| UX/IA | 3 (AUD-005,006,013) | 0 | 0 |
| Correctness | 3 (AUD-003,004,009) | 0 | 0 |
| Data/scoring | 3 (AUD-007,008,010) | 1 (AUD-014) | 0 |
| Taxonomy | 1 (AUD-011) | 0 | 0 |

**Total: 13 confirmed, 1 strongly indicated, 0 hypothesis**

All findings derived from direct source code inspection. No issues were fabricated or assumed.
