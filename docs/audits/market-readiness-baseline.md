# DE//AGENT Market-Readiness Baseline Audit

**Date**: 2026-10-11
**Repository**: https://github.com/XMIRTUNJAY/de-agent-platform
**Production**: https://de-agent-platform.vercel.app

---

## 1. Actual Architecture

### Tech Stack
- **Framework**: Astro 5.14.1 (static site generation)
- **Styling**: Tailwind CSS 4.1.14 (via Vite plugin)
- **Content**: MDX via @astrojs/mdx, YAML data files
- **Registry**: 152 resources in `data/curated/` (YAML) → pipeline → `src/data/generated/registry.json`
- **Pipeline**: 10 stages (normalize → dedupe → license → validate → score → evidence → depth → eligibility → related → freshness → verify → publish)
- **Tests**: 85 Node.js native tests (84 passing, 1 failing)
- **CI**: GitHub Actions (ci.yml, content-discovery.yml)
- **Deploy**: Vercel (auto-deploy on push to main)

### Data Flow
```
data/curated/*.yaml (135 original + 17 promoted drafts)
    → pipelines/run.mjs (10 stages)
    → src/data/generated/registry.json (636 KB)
    → src/data/generated/search-index.json (158 KB)
    → src/data/generated/graph.json (95 KB)
    → src/data/generated/stats.json
    → astro build → dist/ (231 pages)
    → Vercel deploy
```

### Resource Types (152 total)
| Type | Count | Verification |
|------|-------|--------------|
| skill | 24 | community |
| mcp | 12 | community |
| plugin | 10 | community |
| hook | 10 | community |
| agent | 12 | community |
| template | 7 | community |
| starter | 6 | community |
| runbook | 15 | community |
| architecture | 15 | community |
| reference | 41 | community |

---

## 2. Current Product Capabilities

### Working
- ✅ Registry browse with multi-facet filtering (type, category, difficulty, verification, agent, security, technology, stage)
- ✅ Search page with client-side filtering
- ✅ Resource detail pages with security posture, related links, install commands
- ✅ Learning roadmap (13 stages, 4 phases)
- ✅ Admin dashboard (health, evidence, depth, freshness, triage, source health)
- ✅ Automated content discovery pipeline (GitHub Actions, weekly)
- ✅ Draft review workflow (PR-based, human-gated promotion)
- ✅ Evidence model (10 checks, 4 levels: community → reviewed → tested → verified)
- ✅ Sitemap generation (eligible pages only)
- ✅ RSS feed

### Broken / Misleading
- ❌ **Test failure**: 17 promoted drafts still have `curation_state: draft` in curated directory
- ❌ **Misleading verification UI**: ResourceCard shows "✓ community [date]" implying verification
- ❌ **Wrong production URL**: `site.config.ts` has `https://de-agent.example.dev`
- ❌ **Broken GitHub link**: Footer/header point to `github.com/de-agent/platform` (404)
- ❌ **Zero reviewed/tested resources**: All 152 are `community` level only
- ❌ **Homepage metrics**: "Reviewed or tested" shows 0 but feature card claims "reviewed"
- ❌ **No analytics**: `ANALYTICS.provider = null`

---

## 3. Critical Bugs (P0)

| # | Finding | Severity | Evidence | User Impact | Fix | Blocked |
|---|---------|----------|----------|-------------|-----|---------|
| 1 | 17 draft records in curated dir | P0 | `tests/isolation.test.mjs:17` fails (17 leaked) | Pipeline integrity broken; drafts pollute registry | Update `curation_state: draft` → `curated` in 17 YAML files | No |
| 2 | Site URL is placeholder | P0 | `src/site.config.ts:10` = `https://de-agent.example.dev` | Canonical URLs, sitemap, OG tags all wrong | Update to `https://de-agent-platform.vercel.app` | No |
| 3 | GitHub repo link 404 | P0 | `src/site.config.ts:15` = `https://github.com/de-agent/platform` | Footer, header, admin all link to dead org | Update to `https://github.com/XMIRTUNJAY/de-agent-platform` | No |
| 4 | Misleading verification badges | P0 | `ResourceCard.astro:25-29` shows "✓ community" as badge | Users trust unverified resources | Show "community" without checkmark; only badge reviewed+ | No |
| 5 | Homepage "verifiedCount" = 0 | P0 | `index.astro:35` uses `reviewed + tested` (both 0) | Metric card shows 0; feature card contradicts | Hide metric or show honest "0 reviewed/tested" | No |

---

## 4. Security & Reliability Risks

### Dependency Vulnerabilities (npm audit)
```
75 vulnerabilities (4 critical, 51 high, 20 moderate)
```
**Critical/High in production deps**:
- `zod` (via dependencies) - validation library
- `esbuild` (via @astrojs/*) - bundler
- `next` (devDependency only - cypress, jest transitive)

**Dev dependencies with high/critical**:
- `cypress` - E2E testing
- `jest` - testing (not used, native test runner used)
- Various transitive deps

### Pipeline Security
- ✅ Exec policy blocks: network, absolute paths, writable mounts, host escapes
- ✅ Docker runner uses pinned images, no privileged, read-only root
- ✅ Secrets redacted from logs/argv
- ⚠️ No CodeQL scanning in CI
- ⚠️ No Dependabot configuration
- ⚠️ No branch protection rules

---

## 5. Automated Pipeline Status

| Stage | Status | Duration | Notes |
|-------|--------|----------|-------|
| NORMALIZE | ✅ | 748ms | 152 resources, 38 cats, 31 tech |
| DEDUPLICATE | ✅ | 25ms | 0 duplicate slugs, 1 fork candidate |
| LICENSE CHECK | ✅ | 2ms | 27 proprietary, 0 non-reproducible |
| VALIDATE | ✅ | 13ms | 2 warnings, 0 errors |
| QUALITY SCORE | ✅ | 5ms | avg 3.97/5, completeness 70% |
| DEPTH | ✅ | 6ms | deep:4, adequate:148, thin:0 |
| EVIDENCE | ✅ | 3ms | 0 over-claims (gap=0) |
| VERIFY | ✅ | 1ms | community:152, earned:community:152 |
| ELIGIBILITY | ✅ | 5ms | eligible:152 |
| RELATED | ✅ | 56ms | computed for 152 |
| FRESHNESS | ✅ | 1ms | 6 upstream-changed, 0 archived/stale |
| PUBLISH | ✅ | 36ms | registry + search-index + graph + stats |

**Total**: ~910ms, all green

---

## 6. Missing / Misleading Trust Indicators

| Indicator | Current State | Required |
|-----------|---------------|----------|
| Verification levels displayed | Shows "✓ community" as success badge | Only badge `reviewed`/`tested`/`verified`; `community` = no badge |
| Evidence backfill | Only `metadata_validated` auto-added | Need `source_reachable`, `license_reviewed`, `build_passed`, `tests_passed` |
| Staleness tracking | 0 stale (180-day threshold) | ✅ Working |
| Provenance freshness | 6 upstream-changed detected | ✅ Working |
| License compliance | 27 proprietary (summarized only) | ✅ Working |

---

## 7. SEO & Accessibility Gaps

### SEO
- ❌ Canonical URL wrong (placeholder domain)
- ❌ `robots.txt` not verified
- ❌ Structured data (JSON-LD) not implemented
- ❌ Open Graph images not configured
- ❌ No Google Search Console configured
- ✅ Sitemap filters eligible-only pages
- ✅ Semantic HTML structure

### Accessibility
- ⚠️ Focus visibility needs audit
- ⚠️ Color contrast needs audit (Tailwind defaults likely OK)
- ⚠️ Reduced motion respected (hero rotation has media query)
- ✅ Heading hierarchy appears correct
- ✅ Keyboard navigation works on marketplace filters

---

## 8. Monetization Implementation

### Current State
- ✅ `AffiliateDisclosure.astro` component exists
- ✅ Monetization policy doc (`/docs/monetization`)
- ❌ No affiliate links in registry schema
- ❌ No sponsored content markers
- ❌ No payment integration
- ❌ No premium content gating

### Schema Gaps
Resource schema lacks:
- `affiliate_url` field
- `sponsored: boolean` field
- `sponsor_name` field

---

## 9. Test Results

```
85 tests, 84 pass, 1 fail
FAIL: tests/isolation.test.mjs:17 "the curated loader never yields draft records"
  Expected: 0 draft records
  Actual: 17 draft records
```

---

## 10. Dependency & Deployment Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Vercel deploy fails | Low | High | Build passes locally; 231 pages generated |
| npm audit critical in prod | Medium | High | Audit production deps only; update zod, esbuild |
| GitHub Actions token expiry | Low | Medium | Use GITHUB_TOKEN (auto-rotating) |
| Content drift undetected | Medium | Medium | Freshness stage detects 6 upstream-changed |
| Draft promotion without review | Low | High | CI opens PR; human must merge |

---

## 11. Highest-Value Improvements (Priority Order)

1. **Fix 17 draft records** - Unblocks CI, restores pipeline integrity
2. **Fix site URL & GitHub links** - Enables correct SEO, trust signals
3. **Fix verification badge UI** - Stops misleading trust claims
4. **Update homepage metrics** - Honest representation of trust state
5. **Resolve npm audit critical/high in production deps** - Security hygiene
6. **Add Dependabot + CodeQL + branch protection** - Supply chain security
7. **Implement evidence backfill workflow** - Move resources to `reviewed`/`tested`
8. **Add structured data (JSON-LD)** - SEO readiness
9. **Configure analytics (privacy-friendly)** - Measurement foundation
10. **Create production-readiness audit** - Launch gate

---

## 12. Known Unknowns

- Actual Vercel deploy status (last build log shows success)
- Real Core Web Vitals (no RUM data)
- Search Console indexing status
- Affiliate program eligibility/terms
- Whether `github.com/de-agent` org can be created (manual step)
- Load testing results under traffic