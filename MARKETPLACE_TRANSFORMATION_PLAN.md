# DE//AGENT Marketplace Transformation Plan
## From Registry → Rule-Rated Marketplace with 13-Stage Alignment

---

## Vision
Transform DE//AGENT into a **rule-rated marketplace** where every artifact (skill, MCP, plugin, hook, agent, template, starter, runbook, architecture, reference) gets a **computed quality score** based on objective criteria. Users can install, rate, review, and share artifacts — all aligned to the 13-stage Data Engineering roadmap.

---

## Phase 1: Core Schema & Rating Engine (Week 1-2)

### 1.1 Extend Registry Schemas (`packages/registry-core/src/schemas.ts`)

Add marketplace-specific fields to `ResourceSchema`:

```typescript
// NEW: Marketplace-specific computed fields
export const MarketplaceMetricsSchema = z.object({
  // Installation & usage
  install_count: z.number().int().min(0).default(0),
  install_success_rate: z.number().min(0).max(1).default(0), // successful installs / attempts
  last_installed_at: z.string().datetime().optional(),

  // Ratings & reviews
  rating_average: z.number().min(0).max(5).default(0),
  rating_count: z.number().int().min(0).default(0),
  rating_distribution: z.record(z.number().int().min(0)).default({}), // { "5": 10, "4": 5, ... }

  // Rule-based quality scores (computed, never hand-written)
  quality_scores: z.object({
    // Performance (0-100) — execution benchmarks, latency, resource usage
    performance: z.number().min(0).max(100).nullable().default(null),
    // Completeness (0-100) — how well canonical fields are filled
    completeness: z.number().min(0).max(100).default(0),
    // Test coverage (0-100) — evidence of tests, CI, smoke tests
    test_coverage: z.number().min(0).max(100).nullable().default(null),
    // Security (0-100) — secret handling, least privilege, vulnerability scans
    security: z.number().min(0).max(100).default(0),
    // Documentation (0-100) — README, examples, inline docs
    documentation: z.number().min(0).max(100).default(0),
    // Maintainability (0-100) — versioning, deprecation policy, changelog
    maintainability: z.number().min(0).max(100).default(0),
    // Community (0-100) — stars, forks, contributors, issue response time
    community: z.number().min(0).max(100).nullable().default(null),
  }),

  // Composite score (weighted average, 0-100)
  composite_score: z.number().min(0).max(100).default(0),
  composite_label: z.enum(['exemplary', 'strong', 'adequate', 'weak', 'unproven']).default('unproven'),

  // Verification & trust
  verification_level: z.enum(['community', 'reviewed', 'tested', 'verified']).default('community'),
  evidence_summary: EvidenceSummarySchema.optional(),

  // Roadmap alignment
  roadmap_stages: z.array(z.string()).default([]), // stage IDs this artifact maps to
  roadmap_phase: z.enum(['foundations', 'platforms', 'trust-operations', 'advanced-agentic']).optional(),

  // Marketplace metadata
  is_featured: z.boolean().default(false),
  is_official: z.boolean().default(false), // published by DE//AGENT team
  publisher_tier: z.enum(['community', 'verified_publisher', 'official']).default('community'),
});
```

### 1.2 New Resource Types for "Rules & Settings"

Add to `RESOURCE_TYPES`:
- `policy` — OPA/Rego policies, Kyverno policies, Guard rules
- `rule_pack` — SQLFluff configs, Great Expectations suites, Soda checks, dbt test packages
- `config_template` — Warehouse configs, Spark job configs, Airflow pool configs
- `governance_pack` — Tag taxonomies, glossary terms, classification rules, access policies

### 1.3 Rating Computation Engine (`pipelines/lib/marketplace-score.mjs`)

Create a new pipeline step that computes all quality scores **deterministically**:

```javascript
// Scoring weights (configurable via meta.scoring.weights)
const WEIGHTS = {
  performance: 0.20,
  completeness: 0.15,
  test_coverage: 0.20,
  security: 0.15,
  documentation: 0.10,
  maintainability: 0.10,
  community: 0.10,
};

// Each dimension has rule-based checks:
// - Performance: exec-runner benchmarks, latency p95, memory/CPU
// - Completeness: existing CANONICAL_FIELDS + type-specific required fields
// - Test coverage: evidence checks (tests_passed, build_passed, smoke_passed) + CI configs
// - Security: security_flags, secret patterns, least-privilege configs, vulnerability scans
// - Documentation: README length, examples, diagram presence, inline comments
// - Maintainability: version format, changelog, deprecation notices, release cadence
// - Community: GitHub stars/forks/contributors, issue response time, release frequency
```

### 1.4 Pipeline Integration

Add `MARKETPLACE_SCORE` step in `pipelines/run.mjs` after `EVIDENCE`:

```
... → EVIDENCE → VERIFY → MARKETPLACE_SCORE → ELIGIBILITY → RELATED → FRESHNESS → PUBLISH
```

---

## Phase 2: Installation & Execution Tracking (Week 2-3)

### 2.1 Install Manifest Standard

Define `install_manifest` in each resource (already partially exists via `install_command`):

```yaml
# In curated YAML for each resource
install_manifest:
  id: skill-sqlfluff-linter
  version: "1.2.0"
  commands:
    - name: "install"
      argv: ["pip", "install", "sqlfluff==3.0.0"]
      timeout_ms: 120000
    - name: "verify"
      argv: ["sqlfluff", "--version"]
      timeout_ms: 10000
    - name: "test_lint"
      argv: ["sqlfluff", "lint", "--help"]
      timeout_ms: 10000
  requirements:
    - python >= 3.8
    - pip
  limits:
    timeout_ms: 180000
    max_output_bytes: 500000
```

### 2.2 Installation API Endpoints (`src/pages/api/marketplace/`)

```
POST   /api/marketplace/install          # Record install attempt, return manifest
POST   /api/marketplace/install/result   # Receive install result (success/failure + logs)
GET    /api/marketplace/stats/:id        # Get install count, success rate, ratings
POST   /api/marketplace/rate             # Submit rating + review
GET    /api/marketplace/reviews/:id      # Get reviews with pagination
```

### 2.3 Analytics Events (`packages/analytics/src/events.ts`)

Add marketplace events:
```typescript
export const MarketplaceInstallEventSchema = BaseEventSchema.extend({
  event: z.literal('marketplace_install'),
  properties: z.object({
    resource_id: z.string(),
    resource_type: z.string(),
    manifest_version: z.string(),
    backend: z.enum(['dry', 'local', 'docker']),
    success: z.boolean(),
    duration_ms: z.number().int().min(0),
    error_category: z.string().optional(),
  }),
});

export const MarketplaceRateEventSchema = BaseEventSchema.extend({
  event: z.literal('marketplace_rate'),
  properties: z.object({
    resource_id: z.string(),
    rating: z.number().int().min(1).max(5),
    review_text: z.string().max(2000).optional(),
    is_verified_install: z.boolean(), // only allow rating after verified install
  }),
});
```

---

## Phase 3: Marketplace UI (Week 3-4)

### 3.1 Enhanced Marketplace Page (`src/pages/marketplace.astro`)

Add to existing filters:
- **Sort by**: Composite Score ↓, Rating ↓, Installs ↓, Recently Updated, Verification Level
- **Score filter**: Minimum composite score slider (0-100)
- **Quality badges**: Show score breakdown on hover (radar chart or bar segments)
- **Verification pills**: Community / Reviewed / Tested / Verified with evidence count

### 3.2 Resource Card Redesign (`src/components/ResourceCard.astro`)

Show on card:
- Composite score badge (color-coded: exemplary=green, strong=blue, adequate=yellow, weak=orange, unproven=gray)
- Star rating + review count
- Install count + success rate
- Verification level
- Security posture icons
- Roadmap stage/phase badge

### 3.3 Resource Detail Page (`src/pages/[type]/[slug].astro`)

New sections:
- **Quality Score Breakdown** — radar chart or horizontal bars for each dimension
- **Install Button** — copies command, records analytics, shows success rate
- **Rate & Review** — 5-star + text (only after verified install)
- **Install History** — recent installs, success/failure, common errors
- **Evidence Panel** — expandable check-by-check evidence
- **Roadmap Context** — which stage/phase, prerequisites, next steps

### 3.4 User Dashboard (`src/pages/dashboard.astro`)

- My installed artifacts
- My ratings & reviews
- My contributed artifacts (if publisher)
- Roadmap progress tracker (which stages I have artifacts for)

---

## Phase 4: 13-Stage Roadmap Integration (Week 4-5)

### 4.1 Stage-Artifact Mapping

Each artifact declares `roadmap_stages: ["foundations", "python-sql", ...]` or auto-derived from `category.stage`.

### 4.2 Stage Pages Enhancement (`src/pages/roadmap.astro`)

Show for each stage:
- **Required artifacts** (skills, templates, starters that teach the stage outcomes)
- **Recommended artifacts** (MCPs, plugins, hooks that accelerate the stage)
- **Verification status** — how many verified/tested resources per stage
- **Quality heatmap** — average composite score per type per stage
- **My progress** — if logged in, show which stage artifacts I've installed

### 4.3 Learning Path Generator

API: `GET /api/roadmap/path?stage=warehousing&persona=data-engineer`

Returns curated sequence:
1. Tutorial → 2. Skill → 3. Starter → 4. Architecture → 5. Runbook → 6. Reference

---

## Phase 5: Discovery & Curation Automation (Week 5-6)

### 5.1 Enhanced Discovery (`pipelines/discover.mjs`)

Add sources for new rule/settings artifacts:
- OPA policies from `open-policy-agent/opa` repo
- SQLFluff configs from `sqlfluff/sqlfluff` examples
- Great Expectations suites from community
- Soda checks from `sodadata/soda-core` examples
- Kyverno policies from `kyverno/policies`

### 5.2 Auto-Scoring on Discovery

When drafts are promoted, run:
1. **Static analysis** — clone repo, run linters, check for tests, CI configs
2. **Security scan** — secret detection, dependency audit, least-privilege check
3. **Documentation score** — README quality, examples, diagrams
4. **Execution test** — run `install_manifest` in dry/local mode, capture results
5. **Compute initial scores** — publish with `composite_score` from day 1

### 5.3 Curation Workflow Enhancement (`agents/draft-writer/`)

Add briefs for new types:
- `policy.md` — how to write OPA/Kyverno/Guard policy drafts
- `rule_pack.md` — SQLFluff, GX, Soda, dbt test pack drafts
- `config_template.md` — infrastructure config templates

---

## Phase 6: Publisher & Community Features (Week 6-7)

### 6.1 Publisher Portal (`src/pages/publisher/`)

- Claim ownership of resources
- Publish new versions
- View install analytics, ratings, feedback
- Manage verification evidence submission

### 6.2 Verification Submission UI

- Curators submit evidence for `reviewed`/`tested`/`verified`
- Pipeline auto-generates evidence from successful executions
- Evidence review queue in `/admin/queue`

### 6.3 Community Features

- **Follow artifact** — get notified on updates
- **Collections** — curated lists (e.g., "AWS Data Platform Starter Kit")
- **Discussion threads** — per artifact (GitHub Discussions integration?)
- **Badge system** — "Early Adopter", "Verified Publisher", "Stage Master"

---

## Technical Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      MARKETPLACE LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  UI: marketplace.astro, [type]/[slug].astro, dashboard.astro   │
│  API: /api/marketplace/* (install, rate, review, stats)        │
│  Analytics: marketplace_install, marketplace_rate events       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SCORING ENGINE                               │
├─────────────────────────────────────────────────────────────────┤
│  pipelines/lib/marketplace-score.mjs (deterministic, rule-based)│
│  Inputs: registry.json, execution results, GitHub API, evidence │
│  Outputs: quality_scores, composite_score, labels on each resource │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXECUTION LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  pipelines/execute.mjs + exec-runner.mjs + exec-policy.mjs     │
│  Backends: dry | local | docker (future)                       │
│  Outputs: execution transcripts, SHA256, evidence entries      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REGISTRY CORE                                │
├─────────────────────────────────────────────────────────────────┤
│  packages/registry-core/src/schemas.ts (extended)              │
│  packages/registry-core/src/api.ts (new marketplace endpoints) │
│  data/curated/*.yaml (install_manifest, roadmap_stages)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PIPELINE                                     │
├─────────────────────────────────────────────────────────────────┤
│  discover.mjs → normalize → validate → score → evidence         │
│           → verify → MARKETPLACE_SCORE → eligibility → publish │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| P0 | Extend schemas with marketplace fields | 2 days | — |
| P0 | Create marketplace-score.mjs engine | 3 days | schemas, evidence |
| P0 | Add MARKETPLACE_SCORE pipeline step | 1 day | score engine |
| P0 | Install manifest standard + execution tracking | 3 days | exec-runner |
| P1 | Marketplace API endpoints | 3 days | analytics, schemas |
| P1 | Enhanced marketplace UI (sort, filter, badges) | 3 days | API, schemas |
| P1 | Resource detail page with score breakdown | 2 days | API, schemas |
| P1 | Roadmap-stage artifact mapping | 2 days | taxonomy |
| P2 | New resource types (policy, rule_pack, etc.) | 2 days | schemas, taxonomy |
| P2 | Discovery sources for new types | 2 days | discover.mjs |
| P2 | Publisher portal & verification UI | 4 days | auth, API |
| P3 | User dashboard & collections | 3 days | auth, API |
| P3 | Learning path generator | 2 days | roadmap mapping |

---

## Success Metrics

- **Coverage**: ≥80% of 13 stages have ≥3 verified artifacts each
- **Quality**: ≥50% of artifacts have composite_score > 60 ("adequate")
- **Adoption**: ≥100 installs/week within 30 days of launch
- **Trust**: ≥30% of artifacts reach "reviewed" or higher verification
- **Engagement**: ≥5 ratings/week, ≥10 reviews/week

---

## Next Steps

1. **Start with Phase 1** — schema extensions + scoring engine (foundational)
2. **Run pipeline** to compute initial scores on existing 152 resources
3. **Identify gaps** — which stages/types have low scores, missing artifacts
4. **Prioritize curation** — target discovery for high-value missing artifacts
5. **Iterate UI** — marketplace page first, then detail pages, then dashboard

---

*This plan transforms DE//AGENT from a static registry into a living, rule-rated marketplace where every artifact earns its place through measurable evidence — exactly what the agent-era data engineer needs.*