# Foundation Phase: Trustworthy Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove what the site actually publishes, retire 135 duplicate detail pages, gate indexability on content + evidence, triage the evidence gaps visibly, and establish one authoritative CI result.

**Architecture:** A pure page-census auditor proves the duplicate-route defect; deleting the legacy `resources/[slug]` route removes it. A pure eligibility module (`eligible | needs_review | internal_only | retired`) computed from depth + evidence gap + staleness drives the existing `noindex` prop, route inclusion, and the sitemap filter via an emitted `page-eligibility.json`. A CI workflow runs check + tests + build; the stale `check-errors.txt` is retired.

**Tech Stack:** Node 22 plain ESM, `node:test`, Astro 5 (`getStaticPaths`, sitemap filter), GitHub Actions.

**Spec:** Program brief Phase 01 (Foundation) — audit + reconcile the 340 count, thin descriptions, 121 over-claims, separate validation/evidence/eligibility, one authoritative CI result. Affiliate, metrics, LLM drafting, and widening are later phases, explicitly out of scope.

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; only ADD `page_eligibility` (per-resource), `page-eligibility.json`, `stats.eligibility`. Never reshape or remove.
- `npm run build` stays offline/deterministic.
- Fail-closed and green: eligibility only ever removes pages from crawlers/routes, never fails the build. `retired` is curator-set only — nothing auto-retires.
- Never invent licenses, stars, test results, or verification.

---

### Task 1: Page census auditor (prove the duplication)

**Files:**
- Create: `pipelines/lib/page-census.mjs`
- Create: `pipelines/audit-pages.mjs`
- Test: `tests/page-census.test.mjs`

**Interfaces:**
- Consumes: `dist/**/*.html` (walked by the CLI), `registry.json` resources.
- Produces: `{ total, duplicates, orphans, missing }` + `data/cache/page-audit.json` (gitignored; `data/cache/` already is).

Detail routes audited: `resources/*` plus every `TYPED_DIRS` key mapped through the emit `ROUTE` table (`starter→projects`, `architecture→patterns`, `reference→references`, `tutorial→tutorials`, `tool→tools`, `checklist→checklists`, else same name). Import both maps — `TYPED_DIRS` from `load.mjs`; the ROUTE table lives in `emit.mjs` unexported, so export it (one-word change, no behavior change) and import it.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { census } from '../pipelines/lib/page-census.mjs';

test('detects same slug under legacy and typed routes', () => {
  const out = census(
    ['/resources/kafka-x/', '/skills/kafka-x/', '/skills/only-typed/'],
    ['/skills/kafka-x/', '/skills/only-typed/', '/skills/missing-page/']
  );
  assert.equal(out.duplicates.length, 1);
  assert.equal(out.duplicates[0].slug, 'kafka-x');
  assert.deepEqual(out.duplicates[0].urls.sort(), ['/resources/kafka-x/', '/skills/kafka-x/']);
  assert.deepEqual(out.orphans, ['/resources/kafka-x/']);
  assert.deepEqual(out.missing, ['/skills/missing-page/']);
});

test('clean registry audits clean', () => {
  const out = census(['/skills/a/'], ['/skills/a/']);
  assert.equal(out.duplicates.length, 0);
  assert.equal(out.orphans.length, 0);
  assert.equal(out.missing.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/page-census.test.mjs`
Expected: FAIL with "Cannot find module ... page-census.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
export function slugOf(url) {
  return String(url ?? '').replace(/\/+$/, '').split('/').pop() ?? '';
}

export function census(distDetailUrls, resourceUrls) {
  const norm = (u) => '/' + String(u ?? '').replace(/^\/+|\/+$/g, '') + '/';
  const dist = distDetailUrls.map(norm);
  const expected = new Set(resourceUrls.map(norm));
  const bySlug = new Map();
  for (const u of dist) {
    const s = slugOf(u);
    if (!bySlug.has(s)) bySlug.set(s, []);
    bySlug.get(s).push(u);
  }
  const duplicates = [...bySlug.entries()]
    .filter(([, urls]) => new Set(urls).size > 1)
    .map(([slug, urls]) => ({ slug, urls: [...new Set(urls)].sort() }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const orphans = dist.filter((u) => !expected.has(u)).sort();
  const missing = [...expected].filter((u) => !dist.includes(u)).sort();
  return { total: dist.length, duplicates, orphans, missing };
}
```

CLI `pipelines/audit-pages.mjs` (exact behavior): walk `dist/` for `.html` files keeping only detail-like paths (first segment in `resources` + ROUTE values), load `src/data/generated/registry.json`, map `resources[].url`, call `census`, print `total/duplicates/orphans/missing` counts plus the first 20 duplicate slugs, write `data/cache/page-audit.json`, exit 1 when duplicates or missing are non-empty (audit signal, not part of build).

- [ ] **Step 4: Run test to verify it passes + run the audit to prove the defect**

Run: `node --test tests/page-census.test.mjs` (PASS)
Run: `node pipelines/audit-pages.mjs`
Expected: `duplicates: 135` (every resource under both routes), exit 1. This red audit is the evidence for Task 2.

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/page-census.mjs pipelines/audit-pages.mjs tests/page-census.test.mjs pipelines/lib/emit.mjs
git commit -m "feat: add page-census auditor proving duplicate detail routes"
```

### Task 2: Retire the legacy resources route

**Files:**
- Delete: `src/pages/resources/[slug].astro`
- Modify: nothing else (sitemap regenerates from built pages automatically)
- Test: `node pipelines/audit-pages.mjs` goes green + build asserts.

**Interfaces:**
- Consumes: census from Task 1.
- Produces: ~205 unique pages; `duplicates: 0`.

External links to `/resources/*` will 404 on the static host (no server redirects possible). Document this in the commit message body and in the audit output note. Internal links already use typed `r.url` (verified: command palette + listings consume `registry.json` urls).

- [ ] **Step 1: Confirm internal-link safety**

Run: `Select-String -R "src" -Pattern "/resources/" | Select-Object -First 10`
Expected: no hits in components/pages (only historical docs may mention it — docs prose is fine).

- [ ] **Step 2: Delete the route and rebuild**

Run: `git rm "src/pages/resources/[slug].astro"` then `npm run build 2>&1 | Select-Object -Last 3`
Expected: Complete, ~205 pages (340 − 135).

- [ ] **Step 3: Verify the audit is green and no orphans remain**

Run: `node pipelines/audit-pages.mjs`
Expected: `duplicates: 0`, `missing: 0`, exit 0. Orphans other than removed legacy URLs: none.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: retire legacy resources route, removing 135 duplicate pages"
```

### Task 3: Page eligibility with crawler teeth

**Files:**
- Create: `pipelines/lib/eligibility.mjs`
- Test: `tests/eligibility.test.mjs`
- Modify: `pipelines/run.mjs` (ELIGIBILITY step + emit `page-eligibility.json`)
- Modify: `pipelines/lib/emit.mjs` (`stats.eligibility`)
- Modify: `src/pages/[type]/[slug].astro` (read first: filter `getStaticPaths` with `isRoutable`, pass `noindex` for non-eligible)
- Modify: `astro.config.mjs` (sitemap filter reads `page-eligibility.json` with missing-file fallback)
- Seed: `src/data/generated/page-eligibility.json` as `{}` so `astro check`/`dev` work before the first pipeline run (same pattern as `source-health.json`).

**Interfaces:**
- Consumes: `r.depth?.level` (depth plan) with description-length fallback, `r.evidence_summary?.gap`, `r.stale`, curator `r.publish` / `r.retired`.
- Produces: `r.page_eligibility`, `page-eligibility.json` (`{ generated_at, states: { url: state } }`), `stats.eligibility`, noindex + route + sitemap enforcement.

States: `eligible` (indexed, listed); `needs_review` (browsable + internal search, `noindex,follow`); `internal_only` (browsable, `noindex,follow`, hidden from listing grids — listings read `page_eligibility` to filter; implement the filter in the shared `ListingPage.astro` + `marketplace.astro` category grids — read both first); `retired` (no route built, curator-set only).

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageEligibility, isRoutable } from '../pipelines/lib/eligibility.mjs';

const base = (over = {}) => ({
  id: 'x', verification: 'reviewed', description: 'd '.repeat(300), stale: false,
  depth: { level: 'adequate', score: 60 }, evidence_summary: { earned: 'reviewed', claimed: 'reviewed', gap: 0 }, ...over,
});

test('adequate + aligned evidence is eligible', () => {
  assert.equal(pageEligibility(base()).state, 'eligible');
});

test('over-claim needs review, stays routable', () => {
  const out = pageEligibility(base({ evidence_summary: { earned: 'community', claimed: 'reviewed', gap: 1 } }));
  assert.equal(out.state, 'needs_review');
  assert.equal(isRoutable(base({ evidence_summary: { earned: 'community', claimed: 'reviewed', gap: 1 } })), true);
});

test('thin community record is internal only', () => {
  const out = pageEligibility(base({ verification: 'community', description: 'short', depth: { level: 'thin', score: 20 }, evidence_summary: { earned: 'community', claimed: 'community', gap: 0 } }));
  assert.equal(out.state, 'internal_only');
});

test('curator retired wins over everything', () => {
  const out = pageEligibility(base({ retired: true }));
  assert.equal(out.state, 'retired');
  assert.equal(isRoutable(base({ retired: true })), false);
});

test('curator override is honored and labeled', () => {
  const out = pageEligibility(base({ publish: 'eligible' }));
  assert.equal(out.state, 'eligible');
  assert.ok(out.reasons.includes('curator override'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/eligibility.test.mjs`
Expected: FAIL with "Cannot find module ... eligibility.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
export function pageEligibility(r) {
  if (r.retired === true || r.publish === 'retired') return { state: 'retired', reasons: ['curator retired'] };
  if (['eligible', 'needs_review', 'internal_only'].includes(r.publish)) return { state: r.publish, reasons: ['curator override'] };
  const len = String(r.description ?? '').length;
  const depthLevel = r.depth?.level ?? (len >= 500 ? 'deep' : len >= 200 ? 'adequate' : 'thin');
  const gap = r.evidence_summary?.gap ?? 0;
  const stale = !!r.stale;
  const claimed = r.verification ?? 'community';
  if (depthLevel === 'thin' && claimed === 'community') return { state: 'internal_only', reasons: ['thin and unreviewed'] };
  const reasons = [];
  if (depthLevel === 'thin') reasons.push('thin content');
  if (gap > 0) reasons.push('claimed more than evidence supports');
  if (stale) reasons.push('past re-verify threshold');
  if (reasons.length > 0) return { state: 'needs_review', reasons };
  return { state: 'eligible', reasons: [] };
}

export function isRoutable(r) {
  return pageEligibility(r).state !== 'retired';
}
```

Pipeline step (after EVIDENCE/DEPTH position — place after VERIFY, before PUBLISH; needs `r.depth` if the depth plan has executed, else the description fallback applies — deterministic either way):

```js
// ELIGIBILITY
step('ELIGIBILITY', () => {
  const states = {};
  for (const r of resources) {
    r.page_eligibility = pageEligibility(r);
    if (r.url) states[r.url] = r.page_eligibility.state;
  }
  emitEligibility(states);
  const counts = {};
  for (const s of Object.values(states)) counts[s] = (counts[s] ?? 0) + 1;
  info('eligibility: ' + Object.entries(counts).map(([k, n]) => `${k}:${n}`).join('  '));
  return null;
});
```

`emitEligibility` mirrors `emitDuplicates` (write `page-eligibility.json` to both generated dirs). `stats.eligibility` counting mirrors `verification_earned` in `buildStats`. Detail route: `getStaticPaths` filters with `isRoutable`; the page passes `noindex={res.page_eligibility.state !== 'eligible'}` to the layout (the `noindex` prop already renders `<meta name="robots" content="noindex,follow" />`). Astro config sitemap filter — exact replacement (keys are normalized both sides because sitemap URLs may trail-slash while registry urls do not):

```js
import { existsSync, readFileSync } from 'node:fs';

let pageStates = {};
try {
  if (existsSync('./src/data/generated/page-eligibility.json')) {
    pageStates = JSON.parse(readFileSync('./src/data/generated/page-eligibility.json', 'utf8')).states ?? {};
  }
} catch { pageStates = {}; }
const strip = (u) => String(u).replace(/\/+$/, '') || '/';
```

and the integration option becomes:

```js
sitemap({
  filter: (page) => {
    if (page.includes('/admin') || page.includes('/search')) return false;
    const hit = Object.entries(pageStates).find(([url]) => strip(url) === strip(new URL(page).pathname));
    if (hit) return hit[1] === 'eligible';
    return true;
  },
  changefreq: 'weekly',
  priority: 0.6,
}),
```

Missing-file fallback keeps pre-pipeline builds at current behavior. Listing filter for `internal_only`: apply in `ListingPage.astro` + `marketplace.astro` grids (read both files first for their resource loops; exact predicate: `.filter((r) => (r.page_eligibility?.state ?? 'eligible') !== 'internal_only')`, defaulting to shown when the field is absent so pre-pipeline renders never blank a page).

- [ ] **Step 4: Run verifications**

Run: `node --test "tests/**/*.test.mjs"` (all PASS), `node pipelines/run.mjs --check` (ELIGIBILITY line visible), `npm run build` (~205 pages), `python -c` assert a known thin record's dist HTML contains `noindex` and `sitemap` excludes a `needs_review` URL.

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/eligibility.mjs tests/eligibility.test.mjs pipelines/run.mjs pipelines/lib/emit.mjs "src/pages/[type]/[slug].astro" astro.config.mjs src/components/ListingPage.astro src/pages/marketplace.astro src/data/generated/page-eligibility.json public/data/generated/page-eligibility.json src/data/generated/stats.json src/data/generated/registry.json
git commit -m "feat: gate indexability on content depth and evidence"
```

### Task 4: Evidence-gap triage on admin health

**Files:**
- Modify: `src/pages/admin/health.astro` (gap-sorted triage list, display-only, same card style as evidence section)
- Test: build + dist assert.

**Interfaces:**
- Consumes: `registry.json` resources with `evidence_summary.gap` (read the registry in the page frontmatter — check import weight; `ResourceDetail.astro` already imports the full registry per page, so this pattern is accepted).
- Produces: UI only.

- [ ] **Step 1: Add a "Triage queue" section** listing the top 20 records by `gap` desc (then id asc), each row linking to its `url` with `claimed → earned` text, plus a one-line backfill pointer to `/docs/verification`. Empty-state fallback when no gaps (matches existing section style).

- [ ] **Step 2: Verify**

Run: `npm run build 2>&1 | Select-Object -Last 3` (page count per Task 2/3 state), `python -c "h=open('dist/admin/health/index.html',encoding='utf-8').read(); assert 'Triage' in h; print('triage ok')"`

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/health.astro
git commit -m "feat: surface evidence-gap triage queue on admin health"
```

### Task 5: One authoritative CI + retire the stale error log

**Files:**
- Create: `.github/workflows/ci.yml`
- Delete: `check-errors.txt` (`git rm`; superseded by CI output)
- Test: YAML parses + contains the three gates (repo-hygiene test asserting file presence and command strings — cheap, honest about what it checks).

**Interfaces:**
- Consumes: nothing new.
- Produces: green/red verdict per push and PR.

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: node pipelines/run.mjs --check
      - run: npm test
      - run: npm run build
```

`astro check` is deliberately excluded until the 80 stale type errors are triaged (tracked follow-up, not this plan — saying so in the workflow comment). The workflow comment must state that exclusion and why, so nobody reads it as approval of the type debt.

- [ ] **Step 1: Write the hygiene test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('ci workflow gates check, tests, and build', () => {
  const p = new URL('../.github/workflows/ci.yml', import.meta.url);
  assert.ok(existsSync(p), 'ci.yml must exist');
  const yml = readFileSync(p, 'utf8');
  for (const cmd of ['pipelines/run.mjs --check', 'npm test', 'npm run build']) {
    assert.ok(yml.includes(cmd), `ci must run ${cmd}`);
  }
});
```

Append to `tests/page-census.test.mjs` (repo-hygiene lives with the audit tests) or a new `tests/ci.test.mjs` — use a new file, one test, no fixtures.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ci.test.mjs`
Expected: FAIL with "ci.yml must exist"

- [ ] **Step 3: Create the workflow, remove the stale log, run everything**

Create the file above. Run: `git rm check-errors.txt`. Run full suite + `pipeline --check` + `npm run build` (all green).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml tests/ci.test.mjs
git commit -m "feat: add authoritative CI with stale error log retired"  # plus the git rm in the same commit
```

Ensure the `git rm` is staged in the same commit. Final: `git log --oneline` shows 5 task commits; `git status` clean.
