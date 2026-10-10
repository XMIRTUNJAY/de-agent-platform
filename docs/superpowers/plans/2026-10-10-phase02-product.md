# Phase 02: Product Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the registry usable for solving real problems — working client-side search, computed related links, honest trust blocks on detail pages, two exemplar guides, and technology + stage filters.

**Architecture:** Search is rebuilt as a static shell + client script over the existing `search-index.json` (enriched with earned/eligibility fields); related links are computed at build time by a pure taxonomy-overlap scorer; detail pages gain a trust section from existing evidence/limitation fields; guides are `DocsLayout` markdown pages with validated frontmatter; filters extend the proven checkbox+data-attr pattern.

**Tech Stack:** Astro 5 static output, vanilla client JS (no framework), `node:test`, existing `yaml` dep.

**Spec:** Program brief Phase 02 (Product) — search across dimensions, useful filters, related links, detail pages with prerequisites/limitations/examples/evidence, a small set of runnable guides linked to resources. Affiliate, metrics, and widening are later phases, explicitly out of scope.

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; only ADD `earned` + `eligibility` to search-index entries. Never reshape or remove.
- `npm run build` stays offline/deterministic; search runs entirely in the browser.
- Fail-closed and green: search excludes retired records; guides label unexecuted steps as unexecuted.
- Never invent licenses, stars, test results, or verification. Guide validation claims need engine runs behind them.

---

### Task 1: Client-side search rebuild

**Files:**
- Modify: `src/pages/search.astro` (static shell + client script; remove server-side scoring)
- Modify: `pipelines/lib/emit.mjs` (`buildSearchIndex`: add `earned`, `eligibility` per entry)
- Test: `tests/search.test.mjs` (index-shape test below; dist asserts in Step 4)

**Interfaces:**
- Consumes: `search-index.json` entries + new fields.
- Produces: working `/search?q=` on the static host; facet chips that actually filter.

Defect being fixed: `search.astro` scores with `Astro.url.searchParams` at build time and ships no `<script>` — on the static host every query shows the pre-rendered empty page. Type chips link `?q=&type=` which the code ignores.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('search index carries earned and eligibility per entry', () => {
  const p = new URL('../src/data/generated/search-index.json', import.meta.url);
  assert.ok(existsSync(p));
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  assert.ok(doc.entries.length > 100);
  for (const e of doc.entries.slice(0, 20)) {
    assert.ok(typeof e.earned === 'string', `entry ${e.id} needs earned`);
    assert.ok(typeof e.eligibility === 'string', `entry ${e.id} needs eligibility`);
    assert.ok(typeof e.url === 'string');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/search.test.mjs`
Expected: FAIL with "entry ... needs earned"

- [ ] **Step 3: Write minimal implementation**

(a) In `emit.mjs` `buildSearchIndex`, add to the returned object: `earned: r.evidence_summary?.earned ?? 'community'`, `eligibility: r.page_eligibility?.state ?? 'needs_review'`. Both are computed before PUBLISH (EVIDENCE + ELIGIBILITY steps), so they are always present at emit time.

(b) Rewrite `search.astro`: keep the hero + form (method GET, action `/search`), replace the server-side block with `<div id="search-results" class="card-grid">` + `<p id="search-empty">` + a `<script>` that on load: reads `?q=`, fetches `/data/generated/search-index.json`, scores client-side (title 10, tags 5, technologies/categoryTitle 3, haystack 1 — mirror the palette weights plus the two new dimensions), excludes `eligibility === 'retired'`, sorts desc, renders cards (title link, type chip, earned chip: `earned: X` with `claimed Y` appended when they differ), renders type chips as buttons that filter the current result set in-page (not links), shows `N result(s)` and the empty state. No results pre-rendered. Escape query text when injecting into HTML (use `textContent`/DOM methods or a minimal `esc()` for `&<>"`).

- [ ] **Step 4: Run verifications**

Run: `node pipelines/run.mjs --check` (regenerates index with new fields), `node --test tests/search.test.mjs` (PASS), `npm run build 2>&1 | Select-Object -Last 3` (205 pages), `python -c "h=open('dist/search/index.html',encoding='utf-8').read(); assert 'search-index.json' in h and 'search-results' in h; print('client search ok')"`

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/emit.mjs src/pages/search.astro tests/search.test.mjs src/data/generated/search-index.json public/data/generated/search-index.json src/data/generated/registry.json
git commit -m "feat: rebuild search as client-side over enriched index"
```

### Task 2: Computed related resources

**Files:**
- Create: `pipelines/lib/related.mjs`
- Modify: `pipelines/run.mjs` (attach `r.related_computed` after ELIGIBILITY, before PUBLISH)
- Modify: `src/components/ResourceDetail.astro` ("Related in the graph" section resolving ids from `registry.resources`)
- Test: `tests/related.test.mjs`

**Interfaces:**
- Consumes: normalized resources with category/technologies/stage/type/url.
- Produces: `r.related_computed: [{ id, score }]` (max 5); UI section labeled computed, separate from curated relationships.

Scoring: shared category +3, each shared technology +2, shared stage +1, same type +1. Exclude self and `retired` records (use `isRoutable` from `eligibility.mjs` — import it; no cycle: eligibility imports nothing from related). Tiebreak by title asc. Only pairs with score > 0.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedFor } from '../pipelines/lib/related.mjs';

const r = (over = {}) => ({ id: 'a', title: 'A', type: 'skill', category: 'cat-sql', technologies: ['tech-spark'], stage: 's1', url: '/skills/a', ...over });

test('ranks shared category above shared stage', () => {
  const me = r();
  const pool = [me, r({ id: 'b', title: 'B', url: '/x/b', category: 'cat-other', stage: 's1' }), r({ id: 'c', title: 'C', url: '/x/c', category: 'cat-sql', technologies: [], stage: 'other' })];
  const out = relatedFor(me, pool, 5);
  assert.deepEqual(out.map((x) => x.id), ['c', 'b']);
});

test('excludes self and retired records', () => {
  const me = r();
  const pool = [me, r({ id: 'b', title: 'B', url: '/x/b' }), r({ id: 'z', title: 'Z', url: '/x/z', retired: true })];
  const out = relatedFor(me, pool, 5);
  assert.deepEqual(out.map((x) => x.id), ['b']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/related.test.mjs`
Expected: FAIL with "Cannot find module ... related.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
import { isRoutable } from './eligibility.mjs';

export function relatedScore(a, b) {
  let s = 0;
  if (a.category && a.category === b.category) s += 3;
  const at = new Set(a.technologies ?? []);
  for (const t of b.technologies ?? []) if (at.has(t)) s += 2;
  if (a.stage && a.stage === b.stage) s += 1;
  if (a.type && a.type === b.type) s += 1;
  return s;
}

export function relatedFor(resource, pool, limit = 5) {
  return pool
    .filter((r) => r.id !== resource.id && isRoutable(r))
    .map((r) => ({ id: r.id, score: relatedScore(resource, r) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}
```

In `run.mjs` after the ELIGIBILITY step add:

```js
// RELATED
step('RELATED', () => {
  const { relatedFor } = awaitImportRelated();
  return null;
});
```

No — top-level await imports are awkward in this file's style; instead add a static import at the top (`import { relatedFor } from './lib/related.mjs';`) and the step:

```js
// RELATED
step('RELATED', () => {
  for (const r of resources) r.related_computed = relatedFor(r, resources, 5);
  info(`related links computed for ${resources.length} resources`);
  return null;
});
```

ResourceDetail section (after the relationships/prerequisites area — read the exact context around line 328 first): a `Related in the graph` card listing `res.related_computed` resolved via `registry.resources.find`, each row a link with type label, plus the caption `Computed from shared taxonomy — not curator endorsements.`

- [ ] **Step 4: Run verifications**

Run: `node --test "tests/**/*.test.mjs"` (all PASS), `node pipelines/run.mjs --check` (RELATED line), `npm run build`, `python -c "import glob; fs=glob.glob('dist/skills/*/index.html'); h=open(fs[0],encoding='utf-8').read(); assert 'Related in the graph' in h; print('related ok', len(fs))"`

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/related.mjs tests/related.test.mjs pipelines/run.mjs src/components/ResourceDetail.astro src/data/generated/registry.json
git commit -m "feat: add computed related-resource links"
```

### Task 3: Trust block + honest cards

**Files:**
- Modify: `src/components/ResourceDetail.astro` ("Before you trust this" section)
- Modify: `src/components/ResourceCard.astro` (earned-aware verification label)
- Test: build + dist asserts (no new unit file; assertions below).

**Interfaces:**
- Consumes: `res` fields (`when_not`, `tradeoffs`, `security_notes`, `note`, `evidence_summary.checks`) + `r.evidence_summary.gap`.
- Produces: UI only.

Defect being fixed: cards show `✓ verified {date}` from `last_verified` alone — 121 over-claimed records wear unearned checkmarks.

- [ ] **Step 1: Edit the card** — replace the `verifiedLabel` line with earned-aware logic:

```astro
{r.evidence_summary && r.evidence_summary.gap > 0 ? (
  <span class="chip" style="margin-left: auto;">claimed {r.verification}</span>
) : (
  verifiedLabel && <span class="chip" style="margin-left: auto;">✓ {r.verification} {verifiedLabel}</span>
)}
```

Keep the existing chip untouched in the aligned case except prefixing the level name (today it hardcodes `✓ verified` even for reviewed records — the level name makes it honest).

- [ ] **Step 2: Add the trust section** to ResourceDetail after the provenance card (read exact context first): `Before you trust this` card with three rows — Limitations (coalesce `when_not`, `tradeoffs`, `security_notes`, `note`; honest empty state: `No documented limitations — treat the unknown as unknown, not as safe.`), Prerequisites (link existing `prereqs` computation — render titles or `None declared`), Evidence (render all 10 `evidence_summary.checks` as passed/failed/unclaimed chips + earned level). Guard every access with `?.`/`??` fallbacks so pre-evidence records render.

- [ ] **Step 3: Verify**

Run: `npm run build 2>&1 | Select-Object -Last 3`, then:
`python -c "h=open('dist/skills/sql-review/index.html',encoding='utf-8').read(); assert 'Before you trust this' in h; assert 'No documented limitations' in h; print('trust ok')"`
`python -c "h=open('dist/skills/index.html',encoding='utf-8').read(); assert 'claimed reviewed' in h; print('cards ok')"`

- [ ] **Step 4: Commit**

```bash
git add src/components/ResourceDetail.astro src/components/ResourceCard.astro
git commit -m "feat: add trust block and earned-aware card labels"
```

### Task 4: Guides infrastructure + two exemplars

**Files:**
- Create: `src/pages/guides/dq-starter-kit.md`, `src/pages/guides/kafka-lakehouse-ingest.md`
- Create: `src/pages/guides.astro` (index listing the two guides with descriptions)
- Modify: `src/site.config.ts` (SIDEBAR Learn group: add `{ label: 'Guides', href: '/guides' }`)
- Test: `tests/guides.test.mjs` (frontmatter contract test below) + build asserts.

**Interfaces:**
- Consumes: registry ids for `related` links (must resolve — tested).
- Produces: `/guides`, `/guides/<slug>` pages; sidebar entry.

Guide contract (frontmatter): `layout: '@/layouts/DocsLayout.astro'`, `title`, `description`, `related: [registry ids]` (min 2, all must exist), `validation: { manifest, at, result } | null`. Body rules: prerequisites section, numbered steps, every shell command in a fenced block, every step labeled `Validated` (engine run behind it, ref in frontmatter) or `Not executed — review before running`. No production-readiness claims without evidence.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { parse } from 'yaml';

test('every guide declares resolvable related ids and honest validation', () => {
  const dir = new URL('../src/pages/guides/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 2, 'need at least two exemplar guides');
  const reg = JSON.parse(readFileSync(new URL('../src/data/generated/registry.json', import.meta.url), 'utf8'));
  const ids = new Set(reg.resources.map((r) => r.id));
  for (const f of files) {
    const raw = readFileSync(new URL(`../src/pages/guides/${f}`, import.meta.url), 'utf8');
    const fm = parse(raw.split('---')[1]);
    assert.ok(fm.title && fm.description, `${f} needs title + description`);
    assert.ok(Array.isArray(fm.related) && fm.related.length >= 2, `${f} needs 2+ related ids`);
    for (const id of fm.related) assert.ok(ids.has(id), `${f} related id ${id} must exist in the registry`);
    assert.ok('validation' in fm, `${f} must declare validation (object or null)`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/guides.test.mjs`
Expected: FAIL (guides dir missing → ENOENT; proves the contract is new)

- [ ] **Step 3: Write the two guides** (ground every recommendation in registry records that exist today; verify each `related` id against `registry.json` before writing):
  - `dq-starter-kit.md` — data-quality starter: advent of quarantine pattern (`project-pipeline-dq-quarantine`), Great Expectations docs reference, Soda reference, dbt test skill (`skill-dbt-test-writer`), with a runnable local validation (a small `node --test`-style check or the registry pipeline itself — validate it with `execute.mjs` and record the manifest + result in frontmatter), unexecutable steps labeled honestly.
  - `kafka-lakehouse-ingest.md` — Kafka→lakehouse ingestion: runbook (`runbook-kafka...`? verify exact ids), Kafka docs, Delta/Iceberg references, streaming skill; validation limited to what runs without a cluster (config lint / dry plan), cluster steps labeled `Not executed`.
  - `guides.astro` index: hero + two cards linking the guides with their descriptions (hardcode the two entries — no glob magic; the test counts the .md files, the index mirrors them).

- [ ] **Step 4: Run verifications**

Run guide validations first (`node pipelines/execute.mjs --manifest <guide-manifest> --backend local --local-i-understand` for each runnable check; record manifest id + timestamp + result path in frontmatter), then `node --test tests/guides.test.mjs` (PASS), `npm run build` (207 pages: 205 + index + 2 guides), dist asserts (guide HTML contains `Not executed` label where applicable; sidebar has Guides link).

- [ ] **Step 5: Commit**

```bash
git add src/pages/guides src/pages/guides.astro src/site.config.ts tests/guides.test.mjs
git commit -m "feat: add guides infrastructure with two validated exemplars"
```

### Task 5: Technology + stage filters

**Files:**
- Modify: `src/pages/marketplace.astro` (two FilterGroups + data attrs + script branch)
- Modify: `src/pages/categories/[slug].astro` (same groups; its simpler script gains a technology split-branch)
- Test: build + dist asserts.

**Interfaces:**
- Consumes: `registry.taxonomy.technologies`, `registry.taxonomy.stages` (verify field names in `taxonomy.yaml`/normalized output first: stages have `id`+`title`; technologies have `id`+pretty names via the existing `prettyTech`-style mapping — reuse the search-index mapping convention).
- Produces: UI only; generic checkbox handler extended, no new JS framework.

- [ ] **Step 1: Add Technology (multi-value) + Stage (single-value) groups** following the existing FilterGroup shape exactly (`{ label, key, options: [{ value, label, count }] }`): technology options from the 31 taxonomy technologies (`value` = tech id, `label` = name) with counts over `r.technologies`; stage options from the 13 taxonomy stages (`value` = stage id, `label` = title) with counts over `r.stage`. Card attrs: `data-technology={(r.technologies ?? []).join(',')}`, `data-stage={r.stage ?? ''}`. Marketplace script: extend the split-branch to `} else if (key === 'agent' || key === 'security' || key === 'technology') {`. Categories page script (strict-equality only): add the branch —

```js
if (key === 'technology') {
  const has = val.split(',').some((v: string) => values.has(v));
  if (!has) { show = false; break; }
} else {
  if (!values.has(val)) { show = false; break; }
}
```

replacing its `if (!values.has(val)) { show = false; break; }` line. Stage needs no handler change (single value, strict equality fits).

- [ ] **Step 2: Verify**

Run: `npm run build`, then `python -c "h=open('dist/marketplace/index.html',encoding='utf-8').read(); assert 'data-technology' in h and 'data-stage' in h; print('filters ok')"`

- [ ] **Step 3: Commit**

```bash
git add src/pages/marketplace.astro "src/pages/categories/[slug].astro"
git commit -m "feat: add technology and stage filters"
```
