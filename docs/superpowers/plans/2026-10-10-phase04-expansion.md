# Phase 04: Sustainable Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every page fresh without proportional review effort — upstream-change detection, a freshness audit on every build, an honest draft backlog with ages, and reusable templates plus a maintenance runbook.

**Architecture:** An explicit-network `refresh-provenance.mjs` command records upstream repo state per record into the tolerated `data/curated/.cache/provenance.json` (17 GitHub identities, fail-closed per repo); a pure `freshness.mjs` evaluator turns provenance + dates into per-record freshness in a new FRESHNESS pipeline step; the queue surfaces draft ages from existing `extracted_at` stamps; a `_template.md` scaffold (Astro-ignored) and a maintenance doc make expansion repeatable.

**Tech Stack:** Node 22 plain ESM, `node:test`, GitHub REST (unauthenticated, 17 calls), Astro 5 (underscore-prefixed pages never route).

**Spec:** Program brief Phase 04 (Expansion) — reusable templates, backlog discipline, freshness + link-health monitoring, refresh on upstream change, retire/merge instead of preserving count. Paid execution environments and widening batches are out of scope.

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; only ADD `r.freshness`, `stats.freshness`. Never reshape or remove.
- `npm run build` stays offline/deterministic; refresh is an explicit network command like discover, never in build.
- Fail-closed: one unreachable repo never fails the refresh; missing cache never fails the build.
- Never invent licenses, stars, test results, or verification. Unreachable upstreams are recorded, not guessed.

---

### Task 1: Upstream provenance refresh

**Files:**
- Create: `pipelines/lib/github-meta.mjs`
- Create: `pipelines/refresh-provenance.mjs`
- Modify: `.gitignore` (add `data/curated/.cache/`)
- Test: `tests/provenance.test.mjs` (fixture payloads, zero network)

**Interfaces:**
- Consumes: `repoIdentity` (identity), `fetchJson` (fetch, token-aware).
- Produces: `data/curated/.cache/provenance.json` (`{ recordId: entry }`) read by `load.mjs` unchanged.

Entry shape per record: `{ checked_at, repo, pushed_at, archived, default_branch, stars: null }` — stars deliberately null (not a metric, never scored; the field exists to document the refusal). Unreachable repo: `{ checked_at, repo, unreachable: true, error }`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { repoTargets, entryFor } from '../pipelines/lib/github-meta.mjs';

const apiRepo = { full_name: 'awslabs/mcp', pushed_at: '2026-10-01T00:00:00Z', archived: false, default_branch: 'main' };

test('groups records by upstream repo', () => {
  const out = repoTargets([
    { id: 'a', github_url: 'https://github.com/awslabs/mcp' },
    { id: 'b', github_url: 'https://github.com/awslabs/mcp/tree/main/x' },
    { id: 'c', github_url: null },
    { id: 'd', github_url: 'https://spark.apache.org/' },
  ]);
  assert.deepEqual(Object.keys(out), ['awslabs/mcp']);
  assert.deepEqual(out['awslabs/mcp'].sort(), ['a', 'b']);
});

test('builds an entry without stars, ever', () => {
  const out = entryFor('awslabs/mcp', apiRepo, '2026-10-10T00:00:00.000Z');
  assert.equal(out.pushed_at, '2026-10-01T00:00:00Z');
  assert.equal(out.archived, false);
  assert.equal(out.stars, null);
  assert.ok(!('stargazers_count' in out));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/provenance.test.mjs`
Expected: FAIL with "Cannot find module ... github-meta.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
import { repoIdentity } from './identity.mjs';

export function repoTargets(resources) {
  const out = {};
  for (const r of resources) {
    const repo = repoIdentity(r.github_url ?? '');
    if (!repo) continue;
    const key = `${repo.owner}/${repo.repo}`;
    if (!out[key]) out[key] = [];
    out[key].push(r.id);
  }
  return out;
}

export function entryFor(repo, api, checked_at) {
  return {
    checked_at, repo,
    pushed_at: api.pushed_at ?? null,
    archived: !!api.archived,
    default_branch: api.default_branch ?? null,
    stars: null,
  };
}

export function unreachableEntry(repo, error, checked_at) {
  return { checked_at, repo, unreachable: true, error: String(error ?? 'unknown') };
}
```

CLI `pipelines/refresh-provenance.mjs` (exact behavior): load curated records via `readYamlList` per `TYPED_DIRS` (import both from `load.mjs`); `repoTargets`; optional `--repo owner/name` filter (same style as discover's `--source`); 400ms pacing between calls (same politeness as discover); `fetchJson('https://api.github.com/repos/<repo>')` (token picked up automatically when set); merge into existing cache file (preserve entries for repos not refreshed this run); write `data/curated/.cache/provenance.json`; print per-repo `ok <pushed_at>` / `unreachable <error>` lines + totals; exit 0 always unless the cache cannot be written (fail-closed: per-repo failures never fail the run).

- [ ] **Step 4: Run test to verify it passes + live refresh (17 repos, no token needed)**

Run: `node --test tests/provenance.test.mjs` (PASS)
Run: `node pipelines/refresh-provenance.mjs`
Expected: per-repo lines, exit 0, cache file written. Unreachable entries (e.g. first-party `de-agent/*` if absent on GitHub) are honest data, not failures.

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/github-meta.mjs pipelines/refresh-provenance.mjs tests/provenance.test.mjs .gitignore
git commit -m "feat: refresh upstream repo provenance per record"
```

Cache file stays untracked (gitignored operational state, same as `.seen.json`).

### Task 2: Freshness audit step + admin section

**Files:**
- Create: `pipelines/lib/freshness.mjs`
- Modify: `pipelines/run.mjs` (FRESHNESS step after ELIGIBILITY, before PUBLISH... place after RELATED — order in file: ELIGIBILITY then RELATED then PUBLISH; add FRESHNESS between RELATED and PUBLISH)
- Modify: `pipelines/lib/emit.mjs` (`stats.freshness`)
- Modify: `src/pages/admin/health.astro` (Freshness section)
- Test: `tests/freshness.test.mjs` + build asserts.

**Interfaces:**
- Consumes: `r.publisher_source` (provenance entry, already normalized), `r.last_verified`, `r.stale`.
- Produces: `r.freshness` (attached by the FRESHNESS pipeline step), `stats.freshness`.

`evaluateFreshness(r, now)`: `{ stale: !!r.stale, upstream_changed: boolean, upstream_checked_at, archived: boolean, unreachable: boolean }` where `upstream_changed = pushed_at > last_verified` (string compare on ISO dates; false when either missing), fields from `r.publisher_source ?? {}`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFreshness } from '../pipelines/lib/freshness.mjs';

test('upstream push after verification flags change', () => {
  const out = evaluateFreshness({ last_verified: '2026-09-01', stale: false, publisher_source: { checked_at: '2026-10-10', pushed_at: '2026-10-05', archived: false } });
  assert.equal(out.upstream_changed, true);
  assert.equal(out.archived, false);
});

test('missing provenance is unknown, not changed', () => {
  const out = evaluateFreshness({ last_verified: '2026-09-01', stale: false, publisher_source: null });
  assert.equal(out.upstream_changed, false);
  assert.equal(out.unreachable, false);
});

test('unreachable upstream is recorded', () => {
  const out = evaluateFreshness({ last_verified: null, stale: true, publisher_source: { checked_at: '2026-10-10', unreachable: true } });
  assert.equal(out.unreachable, true);
  assert.equal(out.stale, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/freshness.test.mjs`
Expected: FAIL with "Cannot find module ... freshness.mjs"

- [ ] **Step 3: Write minimal implementation** (the function above, plus `evaluateAllFreshness(resources)` attaching `r.freshness`), pipeline step:

```js
// FRESHNESS
step('FRESHNESS', () => {
  const now = new Date().toISOString();
  let changed = 0, archived = 0, stale = 0;
  for (const r of resources) {
    r.freshness = evaluateFreshness(r, now);
    if (r.freshness.upstream_changed) changed++;
    if (r.freshness.archived) archived++;
    if (r.freshness.stale) stale++;
  }
  info(`${changed} upstream-changed · ${archived} archived · ${stale} stale`);
  return null;
});
```

`stats.freshness = { upstream_changed: changed, archived, stale }` — compute in `buildStats` from `r.freshness` (same pattern as `stats.eligibility`; recompute there rather than threading step locals).

Admin section (same card style as triage): three count cards (upstream-changed / archived / stale) + top-10 changed list (title → url, `pushed <date> vs verified <date>`) + empty-state fallbacks. Read the triage section first for the exact style anchor.

- [ ] **Step 4: Run verifications**

Run: `node --test "tests/**/*.test.mjs"` (all PASS), `node pipelines/run.mjs --check` (FRESHNESS line), `npm run build`, dist assert (`Freshness` section present on admin/health).

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/freshness.mjs tests/freshness.test.mjs pipelines/run.mjs pipelines/lib/emit.mjs src/pages/admin/health.astro src/data/generated/stats.json src/data/generated/registry.json
git commit -m "feat: audit record freshness against upstream provenance"
```

### Task 3: Guide template + maintenance runbook

**Files:**
- Create: `src/pages/guides/_template.md` (Astro never routes `_`-prefixed files — verify in Step 4 by its absence in dist)
- Create: `src/pages/docs/maintenance.md`
- Modify: `src/site.config.ts` (Reference group: `{ label: 'Maintenance', href: '/docs/maintenance' }`)
- Modify: `tests/guides.test.mjs` (exclude `_`-prefixed files from the count; validate the template structurally)
- Test: build + dist asserts + gatekeeping grep.

**Interfaces:**
- Consumes: guide contract (Task 4 precedent), retirement mechanics (`retired`, `isRoutable`).
- Produces: scaffold + runbook; no routes.

Template: full guide scaffold with `kind: guide`, `related: []`, `validation: null`, commented section checklist (prerequisites, steps with Validated/Not-executed labels, unknowns, trust section), and a comment header stating it never builds to a URL.

Maintenance doc sections: weekly cadence (discover → refresh-provenance → pipeline → audits → review queue oldest-first); promotion checklist pointer (`promote.mjs`, evidence gate); retirement runbook (set `retired: true`, add `superseded_by` relationship where true, rebuild, confirm `audit-pages` + `audit-links` green — retired records unbuild and unlink); merge rule (duplicates.json candidates → curator picks survivor, moves unique content, retires the rest; never delete history, deprecate); backlog discipline (age-sorted review, 90-day re-triage of untouched drafts).

- [ ] **Step 1: Extend the guides test**

```js
test('template scaffolds the contract without publishing', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const p = new URL('../src/pages/guides/_template.md', import.meta.url);
  assert.ok(existsSync(p), 'template must exist');
  const raw = readFileSync(p, 'utf8');
  const fm = parse(raw.split('---')[1]);
  assert.ok(fm.title && Array.isArray(fm.related) && 'validation' in fm);
});
```

And change the count line to `readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'))`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/guides.test.mjs`
Expected: FAIL with "template must exist"

- [ ] **Step 3: Write template + doc + sidebar entry** (per above).

- [ ] **Step 4: Run verifications**

Run: `node --test tests/guides.test.mjs` (PASS), `npm run build`, asserts: no `dist/guides/_template` output; maintenance doc renders; gatekeeping grep clean on both new files.

- [ ] **Step 5: Commit**

```bash
git add src/pages/guides/_template.md src/pages/docs/maintenance.md src/site.config.ts tests/guides.test.mjs
git commit -m "docs: add guide template and maintenance runbook"
```

### Task 4: Draft age on the review queue

**Files:**
- Modify: `src/lib/drafts.ts` (surface `extracted_at` + `age_days`)
- Modify: `src/pages/admin/queue.astro` (age chips + old-draft count)
- Test: build + dist asserts (no new unit file; pure date math verified via rendered output).

**Interfaces:**
- Consumes: `discovered_from.extracted_at` (fallback: `YYYY-MM-DD` filename prefix).
- Produces: queue honesty about backlog age.

- [ ] **Step 1: Extend the Draft interface + loader**

```ts
export interface Draft {
  // ... existing fields ...
  extracted_at: string | null;
  age_days: number | null;
}
```

In `loadDrafts`, set `extracted_at: first.discovered_from?.extracted_at ?? null`, and `age_days` from extracted_at else the filename's leading date (`f.match(/^(\d{4}-\d{2}-\d{2})/)`), else null; `Math.floor((Date.now() - Date.parse(d)) / 86400000)`, null when unparseable. Sort unchanged (published desc).

- [ ] **Step 2: Render ages** — read the item markup first (lines 38+), then: per-item age chip (`{d.age_days == null ? 'age unknown' : d.age_days + 'd old'}`) beside the confidence chip, plus a header chip when any drafts exceed 90 days (`{old} drafts waiting 90+ days — oldest first in review order`). Keep the existing grouping and copy untouched otherwise.

- [ ] **Step 3: Verify + commit**

Run: `npm run build`, dist assert (queue page contains `d old` chips and the 90-day chip iff applicable — compute expected from `data/drafts` dates first and assert accordingly), gatekeeping grep clean.

```bash
git add src/lib/drafts.ts src/pages/admin/queue.astro
git commit -m "feat: surface draft ages on the review queue"
```

Plus a `chore: refresh generated artifacts` commit if builds dirtied generated JSON, keeping the tree clean.
