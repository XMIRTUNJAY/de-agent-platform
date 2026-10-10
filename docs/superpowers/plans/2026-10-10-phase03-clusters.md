# Phase 03: Monetizable Clusters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove every internal link resolves and every eligible page is sitemapped, publish one evidence-grounded comparison exemplar, and ship affiliate-disclosure plus measurement infrastructure with zero live affiliate links.

**Architecture:** An offline dist-crawl link auditor (internal hrefs resolve to built files; sitemap covers exactly the eligible set) with the same exit-1 audit discipline as the census; comparisons reuse the guides collection with a `kind` discriminator; disclosure is a component + policy doc with a test proving no commissioned links exist; measurement is provider-optional hooks plus docs, never surveillance.

**Tech Stack:** Astro 5 static output, vanilla client JS, `node:test`, existing `yaml` dep.

**Spec:** Program brief Phase 03 (Discovery) — focused clusters, comparisons only with evidence, disclosures plus terms-reviewed links, search/affiliate measurement, internal linking, sitemap coverage. Widening batches and paid products are later phases, explicitly out of scope.

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; no pipeline data changes in this phase (audits read `dist/` + generated JSON only).
- `npm run build` stays offline/deterministic; audits never run during build.
- Fail-closed and green: audits exit 1 on broken links or sitemap drift; zero affiliate links ship until programs are reviewed.
- Never invent licenses, stars, test results, or verification. Comparison claims cite sources or are labeled unknown.

---

### Task 1: Link integrity + sitemap coverage audit; fix tech links

**Files:**
- Create: `pipelines/lib/link-audit.mjs`
- Create: `pipelines/audit-links.mjs`
- Test: `tests/link-audit.test.mjs`
- Modify: `src/pages/taxonomy.astro` (tech card anchors `id={t.slug}`)
- Modify: `src/components/ResourceDetail.astro` (tech links → `/taxonomy#slug`)

**Interfaces:**
- Consumes: `dist/**/*.html`, `dist/sitemap*.xml`, `page-eligibility.json`.
- Produces: console report + `data/cache/link-audit.json` (gitignored); exit 1 on broken internal links or sitemap drift.

Defects being fixed: detail-page technology links point at `/technologies/<slug>`, a route that does not exist (every tech link 404s); no check that the sitemap covers the eligible set.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInternalLinks, auditLinks, sitemapCoverage } from '../pipelines/lib/link-audit.mjs';

test('extracts internal links, ignoring externals, fragments, and queries', () => {
  const out = extractInternalLinks('<a href="/skills/x/">a</a><a href="https://e.io/">b</a><a href="#frag">c</a><a href="/guides/y/?q=1">d</a>');
  assert.deepEqual(out, ['/skills/x/', '/guides/y/']);
});

test('reports broken links against the known set', () => {
  const out = auditLinks([{ url: '/a/', links: ['/b/', '/missing/'] }], new Set(['/a/', '/b/']));
  assert.deepEqual(out.broken, [{ from: '/a/', to: '/missing/' }]);
});

test('sitemap must cover eligible and exclude non-eligible detail pages', () => {
  const out = sitemapCoverage(['/ok/', '/stray/x/'], ['/ok/', '/needs/x/']);
  assert.deepEqual(out.uncovered, ['/needs/x/']);
  assert.deepEqual(out.extra, ['/stray/x/']);
});
```

`sitemapCoverage(sitemapUrls, eligibleDetailUrls)`: `uncovered` = eligible not in sitemap; `extra` = sitemap urls with ≥2 path segments under a detail segment (skills, mcp, plugins, agents, hooks, templates, projects, runbooks, patterns, references, tutorials) that are not eligible. Listing/index urls are ignored.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/link-audit.test.mjs`
Expected: FAIL with "Cannot find module ... link-audit.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
export function extractInternalLinks(html) {
  const out = [];
  const re = /href="([^"#]+?)"/g;
  let m;
  while ((m = re.exec(String(html ?? '')))) {
    const h = m[1];
    if (!h.startsWith('/')) continue;
    out.push(h.split('?')[0]);
  }
  return [...new Set(out)];
}

export function auditLinks(pages, known) {
  const broken = [];
  for (const p of pages) {
    for (const to of p.links) {
      const hit = known.has(to) || known.has(to.replace(/\/+$/, '') + '/') || known.has(to.replace(/\/+$/, ''));
      if (!hit) broken.push({ from: p.url, to });
    }
  }
  return { broken: broken.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)) };
}

const DETAIL_SEGMENTS = new Set(['skills', 'mcp', 'plugins', 'agents', 'hooks', 'templates', 'projects', 'runbooks', 'patterns', 'references', 'tutorials']);

export function sitemapCoverage(sitemapUrls, eligibleDetailUrls) {
  const norm = (u) => '/' + String(u).replace(/^\/+|\/+$/g, '') + '/';
  const sm = new Set(sitemapUrls.map(norm));
  const eligible = eligibleDetailUrls.map(norm);
  const uncovered = eligible.filter((u) => !sm.has(u)).sort();
  const eset = new Set(eligible);
  const extra = [...sm].filter((u) => {
    const segs = u.split('/').filter(Boolean);
    return segs.length >= 2 && DETAIL_SEGMENTS.has(segs[0]) && !eset.has(u);
  }).sort();
  return { uncovered, extra };
}
```

CLI `pipelines/audit-links.mjs` (exact behavior): walk `dist/**/*.html` → url (path relative to dist, `index.html` → trailing-slash url) + `extractInternalLinks`; known set = all dist urls (with and without trailing slash) ; `auditLinks`; read `dist/sitemap*.xml` locs + `page-eligibility.json` states (eligible urls only) → `sitemapCoverage`; print counts + first 20 broken + uncovered/extra; write `data/cache/link-audit.json`; exit 1 when broken, uncovered, or extra are non-empty.

Tech-link fix: taxonomy card gets `id={t.slug}` on the anchor; ResourceDetail tech link becomes `<a href={`/taxonomy#${t.slug}`} …>` (read the exact line 349 context first — it is `<li><a href={`/technologies/${t.slug}`} class="link text-sm">{t.name}</a> …`; replace only the href).

- [ ] **Step 4: Run verifications**

Run: `node --test tests/link-audit.test.mjs` (PASS), `node pipelines/audit-links.mjs`
Expected first run: broken list includes every `/technologies/*` link (proves the defect), exit 1. Then apply the tech-link fix, rebuild, rerun: broken 0, uncovered 0, extra 0, exit 0.

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/link-audit.mjs pipelines/audit-links.mjs tests/link-audit.test.mjs src/pages/taxonomy.astro src/components/ResourceDetail.astro
git commit -m "feat: audit internal links and sitemap coverage, fix tech links"
```

### Task 2: Comparison kind + Delta vs Iceberg exemplar

**Files:**
- Create: `src/pages/guides/compare-delta-iceberg.md`
- Modify: `src/pages/guides.astro` (split Learn guides vs Decide comparisons)
- Modify: `tests/guides.test.mjs` (kind contract — append test below)
- Test: frontmatter + build asserts.

**Interfaces:**
- Consumes: registry ids (verified before writing, same as Task 4 pattern).
- Produces: `/guides/compare-delta-iceberg`, index split. No new routing.

Rules for `kind: comparison` (enforced by test): `related` 2+ resolvable ids; `validation` present (object or null); body contains `## Criteria` and `## Verdict` headings; every performance/cost claim cites its source inline or sits under an explicit `Unknowns` list; no production recommendation without evidence; verdict framed as under-constraints guidance, never a universal winner.

- [ ] **Step 1: Write the failing test**

```js
test('comparisons carry criteria, verdict, and labeled unknowns', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../src/pages/guides/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const comparisons = files.filter((f) => {
    const fm = parse(readFileSync(new URL(`../src/pages/guides/${f}`, import.meta.url), 'utf8').split('---')[1]);
    return fm.kind === 'comparison';
  });
  assert.ok(comparisons.length >= 1, 'need at least one comparison exemplar');
  for (const f of comparisons) {
    const raw = readFileSync(new URL(`../src/pages/guides/${f}`, import.meta.url), 'utf8');
    assert.ok(raw.includes('## Criteria'), `${f} needs a Criteria section`);
    assert.ok(raw.includes('## Verdict'), `${f} needs a Verdict section`);
  }
});
```

Append to `tests/guides.test.mjs` (it already imports `parse` from `yaml` — reuse; add no new imports beyond `node:fs`, already imported).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/guides.test.mjs`
Expected: FAIL with "need at least one comparison exemplar"

- [ ] **Step 3: Write the comparison** — verify every `related` id and every record URL against `registry.json` before writing (same python check as Phase 02 Task 4). Grounding: `ref-delta-docs`, `ref-iceberg-docs`, plus lakehouse patterns that exist in the registry (verify ids; candidates seen in dist: `medallion-zones`, `small-files-compaction`, `lambda-vs-kappa`). Criteria rows (format, engine support, time travel, schema evolution, compaction story, ecosystem) each cite the official docs links; vendor performance claims go under `Unknowns — not reproduced here`. Verdict: constraints-based (choose X when …, Y when …), no universal winner. `validation: null`, cluster-facing steps labeled `Not executed`.

Guides index: split the hardcoded array into `GUIDES` (kind missing or `guide`) and `COMPARISONS` (kind `comparison`) with a `Decide` section header; sidebar needs no change (`/guides` already listed).

- [ ] **Step 4: Run verifications**

Run: `node --test tests/guides.test.mjs` (PASS), `npm run build 2>&1 | Select-Object -Last 3` (209 pages), dist asserts (compare page contains `## Criteria`→rendered `Criteria` heading, `Unknowns`, and `Not executed`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/guides/compare-delta-iceberg.md src/pages/guides.astro tests/guides.test.mjs
git commit -m "feat: add comparison kind with Delta vs Iceberg exemplar"
```

### Task 3: Affiliate disclosure infra + policy, zero live links

**Files:**
- Create: `src/components/AffiliateDisclosure.astro`
- Create: `src/pages/docs/monetization.md`
- Modify: `src/site.config.ts` (Reference group: append `{ label: 'Monetization policy', href: '/docs/monetization' }`)
- Test: `tests/monetization.test.mjs` (below).

**Interfaces:**
- Consumes: nothing.
- Produces: disclosure UI + policy; proof of absence.

Component (exact): a notice box accepting a `program` prop:

```astro
---
interface Props { program: string; }
const { program } = Astro.props;
---
<aside class="card card-pad-sm" style="border-style: dashed;" aria-label="Affiliate disclosure">
  <p class="mono-label">Affiliate disclosure</p>
  <p class="card-desc" style="margin-top: 0.5rem;">Links to {program} on this page may earn us a commission at no cost to you. Rankings and scores are independent of commissions — see the <a href="/docs/monetization" class="link">monetization policy</a>.</p>
</aside>
```

Policy doc covers: placement rules (only where the product genuinely completes the task; learning products first), independence of scoring/evidence from commissions, disclosure requirement on any page with a commissioned link, program review checklist (eligibility, geography, attribution window, payout threshold, terms version + date checked), current status section stating plainly that **no affiliate links are live** and naming the programs under evaluation without linking them with parameters.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!p.includes('node_modules')) walk(p, out); }
    else if (/\.(astro|md|mdx|ts)$/.test(f)) out.push(p);
  }
  return out;
}

test('disclosure component states the independence rule', () => {
  const p = new URL('../src/components/AffiliateDisclosure.astro', import.meta.url);
  assert.ok(existsSync(p), 'disclosure component must exist');
  const src = readFileSync(p, 'utf8');
  assert.ok(src.includes('commission') && src.includes('/docs/monetization'));
});

test('no live affiliate links anywhere in src', () => {
  const root = new URL('..', import.meta.url);
  const hits = [];
  for (const f of walk(root.pathname)) {
    if (f.includes('docs/monetization.md')) continue;
    const src = readFileSync(f, 'utf8');
    const re = /https?:\/\/[^\s"')]+(?:tag=|affiliate|referral|_reward|associate-?id)[^\s"')]*|amazon\.[a-z.]+\/[^\s"')]*tag=/i;
    if (re.test(src)) hits.push(f);
  }
  assert.deepEqual(hits, [], `affiliate links must not ship before program review: ${hits.join(', ')}`);
});
```

Walk-root note: `new URL('..', import.meta.url).pathname` on Windows yields `/C:/...` — `readdirSync` accepts it; `join` handles it. If the runner hits path issues, resolve with `fileURLToPath`. (Executor: keep as written; it works on this repo's Node 22/Windows setup per the existing test conventions.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/monetization.test.mjs`
Expected: FAIL with "disclosure component must exist"

- [ ] **Step 3: Write component + policy + sidebar entry** (per above; policy names programs without parameterized links).

- [ ] **Step 4: Run verifications**

Run: `node --test tests/monetization.test.mjs` (PASS), `npm run build` (210 pages: +monetization doc), dist assert (policy page contains `no affiliate links are live`).

- [ ] **Step 5: Commit**

```bash
git add src/components/AffiliateDisclosure.astro src/pages/docs/monetization.md src/site.config.ts tests/monetization.test.mjs
git commit -m "feat: add affiliate disclosure and policy with zero live links"
```

### Task 4: Measurement hooks + docs

**Files:**
- Modify: `src/site.config.ts` (add `analytics` config — read the file's export style first)
- Modify: `src/layouts/BaseLayout.astro` (conditional provider script + outbound-click hook in the existing global script)
- Create: `src/pages/docs/measurement.md`
- Modify: `src/site.config.ts` again (Reference group: `{ label: 'Measurement', href: '/docs/measurement' }`)
- Test: build + dist asserts (no new unit file).

**Interfaces:**
- Consumes: nothing new.
- Produces: opt-in measurement; docs.

- [ ] **Step 1: Config + provider hook** — read `site.config.ts` export style first, then add:

```ts
export const ANALYTICS: { provider: null | 'plausible' | 'umami'; domain: string; script: string } = {
  provider: null,
  domain: '',
  script: '',
};
```

BaseLayout: after the existing global script's palette section, add a provider block that injects only when configured (read the exact script context first; the block shape):

```html
{ANALYTICS.provider && ANALYTICS.script && <script async defer data-domain={ANALYTICS.domain} src={ANALYTICS.script}></script>}
```

placed in `<head>` (read the head section first for the exact insertion point — near the `noindex` meta at former line 57), plus an outbound hook appended to the existing IIFE script:

```js
// outbound-click hook: bounded in-memory log, no network, no cookies.
window.__DE_OUTBOUND__ = [];
document.addEventListener('click', function (ev) {
  var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="http"]') : null;
  if (!a) return;
  window.__DE_OUTBOUND__.push({ href: a.href, at: new Date().toISOString() });
  if (window.__DE_OUTBOUND__.length > 100) window.__DE_OUTBOUND__.shift();
});
```

- [ ] **Step 2: Measurement doc** — metric groups (content quality, search, engagement, monetization, maintenance per the brief), the revenue arithmetic with the hypothetical clearly labeled as illustration, what Search Console + affiliate dashboards cover vs what on-site hooks cover, enabling Plausible/Umami (config values + where the script lands), and what is deliberately not collected (no cookies, no fingerprinting, no cross-site tracking).

- [ ] **Step 3: Verify + commit**

Run: `npm run build` (211 pages), dist asserts (`__DE_OUTBOUND__` present in a page; provider script absent while `provider: null`; measurement doc renders), gatekeeping grep on both docs clean.

```bash
git add src/site.config.ts src/layouts/BaseLayout.astro src/pages/docs/measurement.md
git commit -m "feat: add opt-in measurement hooks and docs"
```

Plus a `chore: refresh generated artifacts` commit if the builds dirtied generated JSON, keeping the tree clean.

### Task 5: Third cluster guide (dbt warehouse testing)

**Files:**
- Create: `src/pages/guides/dbt-warehouse-testing.md`
- Modify: `src/pages/guides.astro` (add to `GUIDES`)
- Test: existing `tests/guides.test.mjs` covers it (contract: related 2+, validation key present).

**Interfaces:**
- Consumes: registry ids (verify before writing).
- Produces: `/guides/dbt-warehouse-testing`; guides index at 3 guides + 1 comparison.

Grounding candidates (verify all against `registry.json` first): `project-dbt-warehouse-tests`, `skill-dbt-test-writer`, `ref-dbt-docs`, `ref-dbt-best-practices`. Structure mirrors the dq guide: prerequisites, numbered steps with `Validated`/`Not executed` labels, honest unknowns section. dbt needs a warehouse, so expect `validation: null` with all cluster steps labeled `Not executed` — unless a repo-local runnable check exists, in which case validate it through `execute.mjs` and record the manifest like the dq demo.

- [ ] **Step 1: Verify ids, write the guide, update the index.**

- [ ] **Step 2: Run verifications**

Run: `node --test tests/guides.test.mjs` (PASS), `npm run build 2>&1 | Select-Object -Last 3` (212 pages), dist assert (guide renders, `related` links resolve — click-check two hrefs against dist files).

- [ ] **Step 3: Commit**

```bash
git add src/pages/guides/dbt-warehouse-testing.md src/pages/guides.astro
git commit -m "feat: add dbt warehouse testing guide"
```
