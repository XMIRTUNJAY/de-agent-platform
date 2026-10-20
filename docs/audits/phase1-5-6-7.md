# DE//AGENT Platform Audit — Phases 1, 5, 6, 7

**Date:** 2026-10-20
**Auditor:** Automated evidence-based review
**Scope:** Information architecture, tutorial quality, scoring model, taxonomy

---

## 1. Information Architecture (Phase 1)

### 1.1 Top Nav vs Homepage Verbs: Structural Mismatch

The homepage defines four action verbs (`src/pages/index.astro:48-53`):

| Verb | href | Purpose |
|------|------|---------|
| Learn | /roadmap | 13-stage roadmap with exit gates |
| Build | /projects | Starter projects and reference architectures |
| Install | /marketplace | Agent skills and MCP servers |
| Operate | /runbooks | Production runbooks for incidents |

The top nav has six items (`src/site.config.ts:36-43`):

| Label | href |
|-------|------|
| Roadmap | /roadmap |
| Marketplace | /marketplace |
| Categories | /categories |
| Tutorials | /tutorials |
| Runbooks | /runbooks |
| Docs | /docs |

**Mismatch:** The homepage verb "Build" maps to `/projects`, but "Projects" does not appear in the top nav. A user who clicks "Build" on the homepage lands on `/projects`, which is mapped to the "Roadmap" nav section via `NAV_SECTION_MAP` (`src/site.config.ts:71`: `['/projects', '/roadmap']`). This means the active nav highlight will show "Roadmap" when the user is on the Projects page, creating a disorienting navigation context switch.

The homepage verb "Install" maps to `/marketplace`, which aligns with the nav item "Marketplace." However, the word "Install" does not appear anywhere in the top nav, so users scanning the nav bar for installation-related content must infer that "Marketplace" is where installable artifacts live.

The homepage verb "Learn" maps to `/roadmap`, which aligns with the nav item "Roadmap." But "Tutorials" is a separate nav item, splitting learning-oriented content across two top-level destinations without clear differentiation.

### 1.2 Sidebar: Learn/Build/Operate Presence

The sidebar (`src/site.config.ts:80-156`) has 8 groups with 38 total items:

| Group | Items | Maps to Homepage Verb? |
|-------|-------|----------------------|
| Get Started | 5 | No (meta/onboarding) |
| Learn | 4 | Partially ("Learn") |
| Marketplace | 8 | Partially ("Install") |
| Build | 2 | Yes ("Build") |
| Operate | 2 | Yes ("Operate") |
| Agentic Data Engineering | 4 | No |
| Reference | 7 | No |
| Curation | 3 | No (admin) |

**Finding:** Learn/Build/Operate exist as sidebar group titles (`src/site.config.ts:92`, `114`, `121`), but they are NOT reflected consistently in the top nav. The top nav uses "Roadmap" instead of "Learn," "Marketplace" instead of "Install," and omits "Build" entirely. The three-tier verb model (Learn/Build/Operate) from the homepage is fragmented across 6 top-nav items that use different terminology.

### 1.3 Beginner vs Senior Engineer Onboarding

**Beginner path:** The homepage hero CTA is "Explore the roadmap" (`src/pages/index.astro:76`), sending beginners to `/roadmap`. The roadmap's first phase is "Foundations" covering stages 1-3 (`src/lib/phases.ts:15`). However, the sidebar's "Get Started" group (`src/site.config.ts:82-89`) contains 5 items including "Introduction," "How the platform works," and "Verification Levels" — none of which appear in the top nav or homepage CTAs. A beginner arriving at the homepage has no visible path to the introductory docs without opening the sidebar.

**Senior engineer path:** A senior engineer looking for production runbooks would need to find "Operate" in the sidebar (group 5 of 8, `src/site.config.ts:121-126`) or "Runbooks" in the top nav. There is no direct homepage CTA targeting experienced practitioners. The "Top-rated entries" section (`src/pages/index.astro:163-174`) uses composite scores, which could serve senior users, but the section title "Registry highlights" does not signal expertise level.

**Root cause:** The platform has three competing IA models simultaneously:
1. Four verbs (Learn/Build/Install/Operate) on the homepage
2. Six destination-based labels in the top nav (Roadmap/Marketplace/Categories/Tutorials/Runbooks/Docs)
3. Eight task-based groups in the sidebar

These three models are not reconciled. `NAV_SECTION_MAP` (`src/site.config.ts:48-76`) attempts to bridge routes to nav items but creates hidden mappings (e.g., `/projects` → Roadmap) that confuse rather than clarify.

### 1.4 Recommendations (Phase 1)

1. **Align top nav with homepage verbs.** Either change the top nav to match Learn/Build/Install/Operate, or change the homepage verbs to match the top nav. Maintaining both creates two parallel mental models. (`src/pages/index.astro:48-53` vs `src/site.config.ts:36-43`)
2. **Add "Projects" to top nav or remove it from homepage verbs.** The `/projects` route should not silently highlight "Roadmap" in the nav. (`src/site.config.ts:71`)
3. **Surface "Get Started" for beginners.** Add a beginner entry point to the homepage or top nav so the 5 sidebar intro items are reachable without prior knowledge of the sidebar. (`src/site.config.ts:82-89`)
4. **Consolidate IA to one model.** Choose either verb-based (homepage) or destination-based (top nav) as the primary model and derive the other from it programmatically.

---

## 2. Scoring Model (Phase 6)

### 2.1 Two Separate Scoring Systems

The platform runs **two independent scoring systems** that produce different outputs for the same resources:

**System A — `score.mjs`** (`pipelines/lib/score.mjs:15-26`): Produces `r.scores` with three fields:
- `quality`: Average of numeric values in `r.quality` object, or `null` if absent
- `completeness`: Percentage of 16 canonical fields that are filled (0-100)
- `trust`: Derived from verification level, security flags, and staleness (0-5 scale)
- `qualityLabel`: Mapped from `quality` score using external guide thresholds

**System B — `marketplace-score.mjs`** (`pipelines/lib/marketplace-score.mjs:51-107`): Produces `r.marketplace` with:
- 7 dimension scores (performance, completeness, test_coverage, security, documentation, maintainability, community)
- `composite_score`: Weighted average of non-null dimension scores (0-100)
- `composite_label`: One of exemplary/strong/adequate/weak/unproven

These two systems compute **different completeness scores** using overlapping but non-identical logic. `score.mjs:37-45` checks 16 canonical fields. `marketplace-score.mjs:138-156` checks the same 16 canonical fields PLUS type-specific required fields from `TYPE_REQUIRED_FIELDS`. A resource can have two different completeness numbers depending on which system reads it.

### 2.2 Composite Score Computation

The composite score (`pipelines/lib/marketplace-score.mjs:69-74`) is computed as:

```
validScores = dimensions where value !== null
totalWeight = sum of MARKETPLACE_WEIGHTS[k] for valid dimensions
composite = sum of (v * (MARKETPLACE_WEIGHTS[k] / totalWeight)) for each valid dimension
```

Weights (`pipelines/lib/marketplace-score.mjs:11-19`):

| Dimension | Weight |
|-----------|--------|
| performance | 0.20 |
| completeness | 0.15 |
| test_coverage | 0.20 |
| security | 0.15 |
| documentation | 0.10 |
| maintainability | 0.10 |
| community | 0.10 |

**Critical behavior when dimensions are null:** When a dimension returns `null`, its weight is redistributed proportionally among remaining non-null dimensions. If `performance` is null (no execution data), `test_coverage` is null (no evidence array), and `community` is null (no GitHub enrichment), then only completeness, security, documentation, and maintainability contribute — and their weights are scaled up to sum to 1.0. This means a resource with minimal data can still receive a high composite score because the missing dimensions don't penalize it; they simply vanish from the denominator.

### 2.3 Quality, Completeness, Trust Collapsed Into One Number

In System A, quality/completeness/trust remain separate fields on `r.scores`. They are NOT collapsed into a single number.

In System B, the `composite_score` collapses 7 dimensions (which implicitly include completeness, security, and test coverage) into one number. Trust is not a direct input to the marketplace composite, but `security` (weight 0.15) and `test_coverage` (weight 0.20) serve as proxies. The original trust score from System A (`r.scores.trust`, 0-5 scale) is completely ignored by System B's composite.

**Finding:** The two systems are never reconciled. A resource carries both `r.scores.trust` (0-5) and `r.marketplace.composite_score` (0-100) with no documented relationship between them.

### 2.4 Community-Submitted Resources Getting Authoritative-Looking Scores

Every resource defaults to `verification: 'community'` during normalization (`pipelines/lib/normalize.mjs:133`). In the marketplace scoring system, `publisher_tier` is hardcoded to `'community'` for all resources (`pipelines/lib/marketplace-score.mjs:101`).

However, the composite score computation does NOT factor in verification level or publisher tier. A community-submitted resource with a long description, semver version string, and a changelog URL can score higher on `documentation` and `maintainability` dimensions than a verified resource with shorter metadata. The `computeDocumentationScore` function (`pipelines/lib/marketplace-score.mjs:211-257`) awards points purely based on string lengths and field presence — it cannot distinguish authoritative content from well-formatted unverified content.

The evidence system (`pipelines/lib/evidence.mjs:33-51`) computes an `earned` verification level based on passed checks, and a `gap` value showing how far the claimed level exceeds earned. But this gap is stored on `r.evidence_summary` and is **never consumed** by the marketplace scoring pipeline. A resource claiming `verification: 'verified'` with zero passing checks gets `gap: 3` recorded, but its composite score is unaffected.

### 2.5 Missing Evidence Behavior

**Performance score:** Returns `null` if no execution data exists (`pipelines/lib/marketplace-score.mjs:114-116`). Null dimensions are excluded from the weighted average, so missing performance data does not penalize the composite.

**Community score:** Returns `null` unless pre-populated by GitHub enrichment (`pipelines/lib/marketplace-score.mjs:305-313`). The comment says "Can be enriched later" — meaning currently, every resource without prior GitHub enrichment gets null for community (10% weight effectively removed).

**Test coverage score:** If `resource.evidence` is empty or absent, `passedChecks` is empty, `evidenceScore` is 0. The score then relies entirely on boolean field presence (`tests`, `ci_config`, etc.) capped at `testSignals * 0.5` (`pipelines/lib/marketplace-score.mjs:162-178`). A resource with no evidence but with `tests: [something]` and `ci_config: true` gets `(0 * 0.5) + (35 * 0.5) = 17.5`.

**Quality score (System A):** Returns `null` if `r.quality` is not an object with numeric values (`pipelines/lib/score.mjs:29-30`). The `qualityLabel` then also becomes `null` (`pipelines/lib/score.mjs:71`).

**Trust score (System A):** If `last_verified` is missing, `isStale()` returns `true` (`pipelines/lib/score.mjs:56`), applying a 0.5 penalty. A community resource with no `last_verified` and no security flags gets: `base = 0`, `raw = 0 + 1 - 0 - 0.5 = 0.5`, final = `round(max(0, min(5, 0.5 * 1.25)))` = `0.63` (`pipelines/lib/score.mjs:47-53`).

### 2.6 Recommendations (Phase 6)

1. **Unify the two scoring systems.** Either retire `score.mjs` or make `marketplace-score.mjs` consume its outputs. Two parallel scoring pipelines create confusion about which number is "real." (`pipelines/lib/score.mjs:15` vs `pipelines/lib/marketplace-score.mjs:51`)
2. **Penalize null dimensions instead of redistributing weights.** A resource missing performance data should not get its other scores inflated. Use a default score of 0 for null dimensions, or apply a fixed penalty. (`pipelines/lib/marketplace-score.mjs:70-73`)
3. **Factor evidence gap into composite score.** The `gap` computed in `evidence.mjs:50` should reduce the composite score. Currently, overclaiming verification has zero scoring consequence. (`pipelines/lib/evidence.mjs:50`, `pipelines/lib/marketplace-score.mjs:69-74`)
4. **Gate composite labels on minimum evidence.** A resource should not earn "strong" or "exemplary" labels without at least `reviewed`-level evidence, regardless of how many metadata fields are filled. (`pipelines/lib/marketplace-score.mjs:77-80`)
5. **Implement community score computation.** Returning null permanently removes 10% of the scoring model. (`pipelines/lib/marketplace-score.mjs:310-312`)
6. **Document which score the UI displays.** If the homepage "Top-rated entries" sorts by `composite_score` (`src/pages/index.astro:44`), users see a number that ignores trust level and evidence gaps.

---

## 3. Taxonomy (Phase 7)

### 3.1 Structure Overview

`data/curated/taxonomy.yaml` defines:
- 13 stages (lines 7-86)
- 38 categories (lines 87-125)
- 31 technologies (lines 127-158)

### 3.2 Potential Duplicate or Overlapping Concepts

| Category A | Category B | Issue |
|------------|------------|-------|
| `cat-data-lakes` (line 94): "Data Lakes" | `cat-lakehouse` (line 95): "Lakehouse" | Both in stage `lakehouse`, both in group `Storage`. Data Lakes covers "object-storage data lakes, zones, partitioning" while Lakehouse covers "Delta/Iceberg/Hudi ACID tables." These are closely related concepts split into adjacent categories within the same stage. Resources about Iceberg on S3 could plausibly belong to either. |
| `cat-streaming` (line 98): "Streaming" | `cat-kafka` (line 99): "Kafka" | Both in stage `streaming`, group `Processing`. Kafka is a streaming technology, yet has its own category separate from the general Streaming category. A Kafka resource must choose between `cat-streaming` and `cat-kafka`. |
| `cat-ingestion` (line 101): "APIs & Ingestion" | `cat-file-ingestion` (line 102): "File & Partner Ingestion" | Both in stage `data-processing`, group `Processing`. Splitting ingestion by protocol (API vs file) creates two categories where one "Ingestion" category with sub-tags might suffice. |
| `cat-data-quality` (line 105): "Data Quality" | `cat-testing` (line 121): "Testing" | Data Quality is in stage `data-quality`, Testing is in stage `reiability`. Both deal with validating data correctness. Their keywords overlap conceptually (expectations, tests, contracts). |
| `cat-warehouses` (line 93): "Data Warehouses" | `cat-snowflake` (line 114): "Snowflake" | Warehouses covers "columnar MPP serving layers" generically. Snowflake has its own category in the `cloud` stage. A Snowflake dimensional modeling resource could go in either. |

### 3.3 Stage-to-Phase Mapping Inconsistency

`src/lib/phases.ts:14-19` maps stages to phases:
- Foundations: `foundations`, `python-sql`, `data-processing`
- Platforms: `warehousing`, `lakehouse`, `cloud`, `streaming`
- Trust & Operations: `data-quality`, `observability`, `orchestration`, `reliability`
- Advanced & Agentic: `system-design`, `agentic`

But `marketplace-score.mjs:331-347` has its own `phaseMap` that duplicates this mapping with a hardcoded dictionary. The two files can drift out of sync. Additionally, `marketplace-score.mjs:337` maps `orchestration` to `platforms`, while `phases.ts:17` maps `orchestration` to `Trust & Operations`. **This is a direct contradiction** — the same stage maps to different phases depending on which file you read.

### 3.4 Categories With Potentially Zero Resources

Without running the full pipeline against all curated YAML files, static analysis of the glob results shows:
- Only 1 tutorial file exists: `data/curated/tutorials/01-sql-fanout.yaml` (category: `cat-sql`)
- Tutorial-type categories like `cat-engineering-foundations`, `cat-python`, `cat-data-formats` likely have 0 tutorials
- Governance packs: only 1 file (`data/curated/governance-packs/01-data-classification.yaml`)
- Policies: only 1 file (`data/curated/policies/01-opa-data-access.yaml`)
- Rule packs: only 1 file (`data/curated/rule-packs/01-sqlfluff-core.yaml`)
- Config templates: only 1 file (`data/curated/config-templates/01-snowflake-warehouse.yaml`)

Categories like `cat-system-design` (line 123) have `tools: []` — an empty tools array, suggesting the category was defined speculatively without concrete technology mappings.

### 3.5 Technology-to-Category Mapping Gaps

Technologies reference categories by ID (e.g., `tech-python` → `cat-python`). But several technologies lack `repo` or `license` fields:
- `tech-sql` (line 129): no homepage, no license, no repo
- `tech-pyspark` (line 136): no repo
- `tech-databricks` (line 150): no license, no repo
- `tech-snowflake` (line 151): no license, no repo
- `tech-bigquery` (line 152): no license, no repo
- `tech-aws` (line 158): no license, no repo

This is inconsistent with open-source technologies that all carry licenses and repos. For proprietary tools, the absence is expected but undocumented — there is no schema note explaining why some technologies lack these fields.

### 3.6 Recommendations (Phase 7)

1. **Resolve the orchestration phase mapping contradiction.** `src/lib/phases.ts:17` places `orchestration` in "Trust & Operations"; `pipelines/lib/marketplace-score.mjs:338` places it in "platforms". Pick one and eliminate the duplicate mapping.
2. **Eliminate `phaseMap` in marketplace-score.mjs.** Import `PHASES` from `src/lib/phases.ts` instead of maintaining a second copy. (`pipelines/lib/marketplace-score.mjs:331-347`)
3. **Merge or clearly differentiate overlapping categories.** Kafka/Streaming, Data Lakes/Lakehouse, and APIs Ingestion/File Ingestion pairs need explicit scoping notes or consolidation. (`data/curated/taxonomy.yaml:98-99`, `94-95`, `101-102`)
4. **Audit categories for minimum resource count.** Categories with 0-1 resources after initial curation should carry a "planned" marker or be collapsed into parent categories until content arrives.
5. **Document why proprietary technologies lack license/repo.** Add a schema comment or normalize to `license: 'proprietary'` explicitly. (`data/curated/taxonomy.yaml:150-158`)

---

## 4. Tutorial Quality (Phase 5)

### 4.1 Sample Size

Only **one tutorial file** exists: `data/curated/tutorials/01-sql-fanout.yaml`. This makes statistical analysis impossible; findings below are structural.

### 4.2 Field Population Analysis

For `tutorial-sql-fanout-review`:

| Field | Status | Detail |
|-------|--------|--------|
| `learning_objectives` | Populated | 3 objectives (lines 17-20) |
| `prerequisites` | **Absent** | Not present in the YAML at all. `normalize.mjs:114` defaults it to `[]`. |
| `what_you_need` | Populated | 3 items (lines 21-24). Note: normalize.mjs maps this to `what_you_need` in the type payload (line 168), but the canonical field list in score.mjs:8 checks for `prerequisites`, not `what_you_need`. |
| `steps` | Populated | 4 steps (lines 25-37), each with `text`, `from_id`, `from_field` |
| `check_yourself` | Populated | 2 items (lines 38-40) |

### 4.3 Prerequisites vs what_you_need Mismatch

The canonical field list used for completeness scoring (`pipelines/lib/score.mjs:8`) includes `prerequisites` but NOT `what_you_need`. The tutorial uses `what_you_need` (line 21) instead of `prerequisites`. During normalization (`pipelines/lib/normalize.mjs:114`), `prerequisites` defaults to `[]` because the field is absent from the source YAML. This means:

1. The tutorial's completeness score loses credit for `prerequisites` (counted as empty)
2. The `what_you_need` content is preserved in the type payload but invisible to the canonical completeness check
3. The tutorial author followed a reasonable convention ("what you need" for a tutorial), but the scoring model expects a different field name ("prerequisites")

### 4.4 Step Provenance

All 4 steps cite `from_id: agent-sql-reviewer` and `from_field: workflow` (`data/curated/tutorials/01-sql-fanout.yaml:27-37`). This is consistent with the design principle stated in `normalize.mjs:165-166`: "Steps stay verbatim with source provenance; beginner-friendliness comes from structure (need/steps/check), never from rephrasing." This is well-implemented.

### 4.5 Verification Level

The tutorial is marked `verification: community` (line 48) with `last_verified: 2026-10-16` (line 49). Given today's date (2026-10-20), this is 4 days old — well within the 180-day staleness window (`pipelines/lib/score.mjs:60`). However, as a community-level resource, it has no evidence entries, meaning `evaluateEvidence` will return `earned: 'community'` with all checks `unclaimed` (`pipelines/lib/evidence.mjs:42`).

### 4.6 Recommendations (Phase 5)

1. **Reconcile `prerequisites` and `what_you_need`.** Either add `what_you_need` to the canonical field list in `score.mjs:8`, or rename the tutorial field to `prerequisites`. The current mismatch silently penalizes tutorial completeness scores. (`pipelines/lib/score.mjs:8` vs `data/curated/tutorials/01-sql-fanout.yaml:21`)
2. **Add more tutorials.** One tutorial across 38 categories is insufficient for a learning platform. Prioritize at least one tutorial per roadmap stage.
3. **Validate tutorial schema in pipeline.** Add a lint step that warns when `prerequisites` is empty for type=tutorial resources, since the field is canonical but commonly omitted in favor of `what_you_need`.
4. **Consider adding `estimated_time` or `difficulty_context` fields.** The tutorial has `difficulty: beginner` but no time estimate, making it hard for learners to plan sessions.

---

## 5. Root Causes and Recommendations Summary

### Root Cause 1: Three Parallel IA Models Without Reconciliation

- **Where:** `src/pages/index.astro:48-53` (verbs), `src/site.config.ts:36-43` (top nav), `src/site.config.ts:80-156` (sidebar)
- **Impact:** Users encounter Learn/Build/Install/Operate on the homepage, Roadmap/Marketplace/Categories/Tutorials/Runbooks/Docs in the nav, and 8 differently-named groups in the sidebar. No single mental model wins.
- **Fix:** Choose one primary model. Derive the others from it via code, not manual duplication.

### Root Cause 2: Duplicate Phase Mapping With Contradictory Values

- **Where:** `src/lib/phases.ts:14-19` vs `pipelines/lib/marketplace-score.mjs:331-347`
- **Impact:** `orchestration` maps to "Trust & Operations" in phases.ts but "platforms" in marketplace-score.mjs. Resources in the orchestration stage get different phase assignments depending on which code path runs.
- **Fix:** Delete the `phaseMap` in marketplace-score.mjs. Import from phases.ts.

### Root Cause 3: Two Independent Scoring Pipelines

- **Where:** `pipelines/lib/score.mjs:15-26` vs `pipelines/lib/marketplace-score.mjs:51-107`
- **Impact:** Resources carry two sets of scores with overlapping but divergent semantics. Completeness is computed differently in each. Trust from System A is ignored by System B.
- **Fix:** Merge into one pipeline, or make System B consume System A's outputs as inputs.

### Root Cause 4: Null Dimensions Inflate Composite Scores

- **Where:** `pipelines/lib/marketplace-score.mjs:70-73`
- **Impact:** Missing evidence doesn't penalize resources — it removes the dimension from the denominator, inflating remaining scores. A resource with only documentation metadata can achieve "strong" or "exemplary" labels.
- **Fix:** Treat null as 0 in the weighted sum, or require minimum dimension coverage before assigning labels above "unproven."

### Root Cause 5: Evidence Gap Has No Downstream Consequence

- **Where:** `pipelines/lib/evidence.mjs:50` computes `gap`; nothing in marketplace-score.mjs reads it
- **Impact:** A resource claiming `verified` with zero passing checks gets the same composite score treatment as one that genuinely earned it. The gap is informational only.
- **Fix:** Apply a composite score multiplier based on gap. E.g., `composite *= max(0.25, 1 - gap * 0.25)`.

### Root Cause 6: Canonical Field List Excludes Tutorial-Specific Fields

- **Where:** `pipelines/lib/score.mjs:8` lists `prerequisites` but not `what_you_need`; `data/curated/tutorials/01-sql-fanout.yaml:21` uses `what_you_need`
- **Impact:** Tutorials are systematically penalized on completeness scoring for using the tutorial-appropriate field name.
- **Fix:** Add `what_you_need` to CANONICAL_FIELDS, or treat it as an alias for `prerequisites` during normalization.

### Root Cause 7: Taxonomy Over-Specification Relative to Content Volume

- **Where:** `data/curated/taxonomy.yaml:87-125` defines 38 categories; glob shows ~60 total curated YAML files across all types
- **Impact:** Many categories have 0-1 resources. Near-duplicate categories (Kafka/Streaming, Lakes/Lakehouse) force arbitrary categorization decisions for curators.
- **Fix:** Collapse categories below a minimum resource threshold. Merge near-duplicates. Mark speculative categories as "planned" rather than live.

</content>