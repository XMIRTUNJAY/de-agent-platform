# DE//AGENT 90-Day Implementation Plan

**Objective**: Transform DE//AGENT from a static registry into an executable, measurable, team-ready platform with automated verification.

---

## Phase 1: Analytics + Feedback (Weeks 1-2)

### 1.1 Privacy-Friendly Analytics
- **Provider**: Plausible (self-hostable, GDPR-compliant, no cookies)
- **Events to track**:
  - `search_query` — query, results_count, filters
  - `resource_view` — resource_id, type, source (search/direct/browse)
  - `install_click` — resource_id, command_copied
  - `feedback_submit` — resource_id, helpful (yes/no), comment
  - `signup_newsletter` — email, source_page

### 1.2 Feedback Component
- **Location**: Bottom of every resource detail page
- **Question**: "Did this solve your problem?"
- **Options**: Yes / Partially / No + optional text
- **Storage**: GitHub Issues (auto-create with label `feedback`) or lightweight DB

### 1.3 Dashboard
- **Route**: `/admin/analytics` (protected)
- **Metrics**: Top searches, zero-result searches, conversion funnel, feedback sentiment

---

## Phase 2: CLI + API (Weeks 3-4)

### 2.1 CLI Tool (`de-agent`)
```bash
npm install -g @de-agent/cli
de-agent search "spark skew"
de-agent install spark-skew-diagnosis
de-agent verify spark-skew-diagnosis --env databricks-14.3
de-agent init  # scaffold new skill template
```

### 2.2 REST API (Edge Functions on Vercel)
```
GET  /api/v1/resources?q=spark&type=skill&verification=tested
GET  /api/v1/resources/:id
GET  /api/v1/resources/:id/evidence
GET  /api/v1/search?q=spark+skew
POST /api/v1/feedback
```

### 2.3 Auth (Future-Proof)
- API keys for CLI (scoped: read / write:feedback)
- OAuth for team workspaces (Phase 3)

---

## Phase 3: Team Workspaces MVP (Weeks 5-8)

### 3.1 Data Model
```yaml
# New schema additions
workspace:
  id: ws_abc123
  name: "Acme Data Team"
  slug: acme-data
  owner: user_123
  plan: "team"  # free | team | enterprise
  members:
    - user_id: user_123, role: admin
    - user_id: user_456, role: member
  settings:
    private_registry: true
    sso_enabled: false
    audit_log_retention_days: 90

resource_override:
  workspace_id: ws_abc123
  resource_id: skill-spark-skew
  verification: tested  # override public 'community'
  notes: "Validated on our 14.3 LTS cluster"
  tested_at: "2026-10-15T10:00:00Z"
  tested_by: user_456
```

### 3.2 Features
- **Private registry**: Fork public registry, add internal resources
- **Override verification**: Teams mark resources as tested/verified internally
- **Shared evidence**: Team members see each other's test results
- **Audit log**: Who viewed/installed/verified what, when
- **SSO placeholder**: OIDC config (implement later)

### 3.3 Billing Integration (Stripe)
- Team plan: $29/user/mo (min 5 seats)
- Usage-based: $0.10/verification-run (Phase 4)

---

## Phase 4: Automated Verification (Weeks 9-12)

### 4.1 Test Harness
```yaml
# .deagent/test.yaml in each skill repo
test:
  environment:
    - databricks: "14.3.x"
    - spark: "3.4.x"
    - python: "3.11"
  steps:
    - name: Install
      run: pip install -r requirements.txt
    - name: Run skill
      run: python -m skill_spark_skew --sample-data
    - name: Validate output
      expect:
        exit_code: 0
        stdout_contains: "skew_detected"
  artifacts:
    - path: output/report.json
      type: json
```

### 4.2 Pipeline Integration
- **Trigger**: Nightly cron + on skill update PR
- **Runner**: GitHub Actions (self-hosted runners for Databricks/AWS)
- **Output**: Evidence entries auto-added to registry
- **Status badge**: `verified` if all environments pass

### 4.3 Compatibility Matrix
- **Page**: `/compatibility` — shows skill × environment pass/fail
- **API**: `GET /api/v1/compatibility?skill=spark-skew-diagnosis`

---

## Technical Architecture

### Repository Structure (New)
```
de-agent-platform/
├── apps/
│   ├── web/              # Astro site (existing)
│   ├── cli/              # @de-agent/cli (NEW)
│   └── api/              # Vercel Edge Functions (NEW)
├── packages/
│   ├── registry-core/    # Shared types, validation (NEW)
│   ├── analytics/        # Event definitions (NEW)
│   └── test-harness/     # Test runner, evidence collector (NEW)
├── pipelines/            # Existing registry pipeline
└── docs/
```

### Shared Package: `packages/registry-core`
- TypeScript types for Resource, Evidence, Workspace, Feedback
- Zod schemas for validation (client + server)
- API client helpers

---

## Implementation Order (Dependencies)

```
Phase 1 (Analytics) ──┐
                      ├──► Phase 3 (Team Workspaces needs analytics)
Phase 2 (CLI/API) ────┘
                      │
                      └──► Phase 4 (Automated Verification needs API + CLI)
```

**Start Phase 1 & 2 in parallel** — they're independent.

---

## Success Metrics (Per Phase)

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | Analytics coverage | 100% pages instrumented |
| 1 | Feedback rate | >5% of resource views |
| 2 | CLI installs | 50+ unique users/week |
| 2 | API latency | p95 < 200ms |
| 3 | Team workspaces | 5 beta teams onboarded |
| 3 | MRR | $1K+ by week 8 |
| 4 | Verified skills | 20+ skills with nightly test passes |
| 4 | Environments | 3+ (Databricks, Spark OSS, EMR) |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Self-hosted runner costs | High | Medium | Start with GitHub Actions free tier; optimize later |
| Stripe integration complexity | Medium | Low | Use Stripe Checkout + Billing Portal (no custom UI) |
| CLI adoption | Medium | High | Dogfood internally; make `de-agent init` delightful |
| Evidence schema drift | Low | High | Versioned schemas in `registry-core`; CI validation |

---

## Definition of Done (per Phase)

- [ ] Code merged to `main`
- [ ] Tests pass (unit + integration)
- [ ] Deployed to staging (Vercel preview)
- [ ] Smoke tested manually
- [ ] Documentation updated
- [ ] Metrics baseline recorded