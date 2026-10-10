# Source Health + Resumable Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track per-source health, retry transient failures, and make discovery resumable without duplicating prior results.

**Architecture:** Add a small pure state module (`pipelines/lib/source-health.mjs`), wrap existing `fetchText/fetchJson` with retry+backoff in `fetch.mjs`, and have `discover.mjs` persist `data/drafts/.source-health.json` + `data/cache/dead-letter.json` and publish `src/data/generated/source-health.json`.

**Tech Stack:** Node 20+, plain ESM `.mjs`, node:test, existing `yaml` dep, Astro 5 static output.

**Spec:** `C:\Users\kumar\de-agent-platform` Phase 1 (Source intelligence) + Phase 10 (Production operations) — adapter health, retry policy, resumability, dead-letter, per-source dashboard data.

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; only ADD `source-health.json`, never reshape `registry.json`.
- `npm run build` stays offline/deterministic; `discover.mjs` is the only network path.
- Fail-closed: a source failure never invalidates unrelated sources.
- Never fabricate verification; health reflects actual fetch/parse outcomes only.

---

### Task 1: Source-health state module

**Files:**
- Create: `pipelines/lib/source-health.mjs`
- Test: `tests/source-health.test.mjs`

**Interfaces:**
- Consumes: nothing (pure, dependency-free except node:fs/node:path).
- Produces: `loadHealth(path)`, `saveHealth(path, state)`, `recordResult(state, sourceId, result)`, `backoffMs(attempt, baseMs)`, `appendDeadLetter(path, entry)` used by Task 2.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { recordResult, backoffMs } from '../pipelines/lib/source-health.mjs';

test('recordResult tracks success and consecutive failures', () => {
  let s = {};
  s = recordResult(s, 'aws-big-data', { ok: true, items: 5, drafted: 2 });
  assert.equal(s['aws-big-data'].consecutive_failures, 0);
  assert.equal(s['aws-big-data'].last_status, 'ok');
  s = recordResult(s, 'aws-big-data', { ok: false, error: 'boom' });
  assert.equal(s['aws-big-data'].consecutive_failures, 1);
  assert.equal(s['aws-big-data'].last_status, 'error');
});

test('backoff grows exponentially', async () => {
  assert.ok(backoffMs(1, 200) >= 200);
  assert.ok(backoffMs(2, 200) > backoffMs(1, 200));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/source-health.test.mjs`
Expected: FAIL with "Cannot find module ... source-health.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
export function backoffMs(attempt, baseMs = 400) {
  return baseMs * 2 ** Math.max(0, attempt - 1);
}
export function recordResult(state, sourceId, result) {
  const prev = state[sourceId] ?? { checks: 0, successes: 0, failures: 0, consecutive_failures: 0 };
  const now = new Date().toISOString();
  const failed = !result.ok;
  return {
    ...state,
    [sourceId]: {
      checks: prev.checks + 1,
      successes: prev.successes + (failed ? 0 : 1),
      failures: prev.failures + (failed ? 1 : 0),
      consecutive_failures: failed ? prev.consecutive_failures + 1 : 0,
      last_status: failed ? 'error' : 'ok',
      last_error: failed ? String(result.error ?? 'unknown') : null,
      last_run: now,
      last_success: failed ? (prev.last_success ?? null) : now,
      last_items: result.items ?? null,
      last_drafted: result.drafted ?? null,
    },
  };
}
export function loadHealth(p, fs) { return fs.exists(p) ? JSON.parse(fs.read(p)) : {}; }
export function saveHealth(p, state, fs) { fs.write(p, JSON.stringify({ generated_at: new Date().toISOString(), sources: state }, null, 1) + '\n'); }
export function appendDeadLetter(p, entry, fs) {
  const cur = fs.exists(p) ? JSON.parse(fs.read(p)) : [];
  cur.push({ at: new Date().toISOString(), ...entry });
  fs.write(p, JSON.stringify(cur.slice(-500), null, 1) + '\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/source-health.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/source-health.mjs tests/source-health.test.mjs
git commit -m "feat: add per-source health tracking with backoff"
```

### Task 2: Retry + health + dead-letter in discovery

**Files:**
- Modify: `pipelines/lib/fetch.mjs`
- Modify: `pipelines/discover.mjs`
- Test: extend `tests/source-health.test.mjs` with retry test

**Interfaces:**
- Consumes: `recordResult`, `backoffMs` from Task 1.
- Produces: `data/drafts/.source-health.json`, `data/cache/dead-letter.json`, `src/data/generated/source-health.json` (+ public copy) consumed by `/admin/health`.

- [ ] **Step 1: Write the failing test**

```js
test('fetchWithRetry retries then succeeds', async () => {
  const { fetchWithRetry } = await import('../pipelines/lib/fetch.mjs');
  let n = 0;
  const r = await fetchWithRetry(async () => (++n < 2 ? { ok: false, error: 'flaky' } : { ok: true }), { retries: 3, baseMs: 1 });
  assert.equal(r.ok, true);
  assert.equal(n, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/source-health.test.mjs`
Expected: FAIL with "fetchWithRetry is not a function"

- [ ] **Step 3: Write minimal implementation**

```js
// fetch.mjs addition:
export async function fetchWithRetry(fn, { retries = 2, baseMs = 400, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let last = { ok: false, error: 'no attempts' };
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    last = await fn();
    if (last.ok) return last;
    if (attempt <= retries) await sleep(baseMs * 2 ** (attempt - 1));
  }
  return last;
}
```

Wire into `discover.mjs runSource`: wrap `fetchText`/`fetchJson` calls with `fetchWithRetry` (retries 2, base 400ms), call `recordResult` per source, `appendDeadLetter` on final failure, persist health after the loop, and emit `src/data/generated/source-health.json` + `public/data/generated/source-health.json`. A failure logs and continues (existing fail-closed loop unchanged). `--dry` writes nothing.

- [ ] **Step 4: Run tests + pipeline check**

Run: `node --test "tests/**/*.test.mjs"`
Expected: 12 existing + new tests PASS

Run: `node pipelines/run.mjs --check`
Expected: pipeline complete, 135 resources, 0 errors (2 pre-existing warnings OK)

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/fetch.mjs pipelines/discover.mjs pipelines/lib/source-health.mjs tests/source-health.test.mjs src/data/generated/source-health.json
git commit -m "feat: retry discovery fetches and persist per-source health"
```

### Task 3: Surface health on /admin/health (display-only)

**Files:**
- Modify: `src/pages/admin/health.astro`
- Test: manual `npm run build` still 340+ pages, no new `astro check` errors beyond the 80 pre-existing ones in `check-errors.txt`.

**Interfaces:**
- Consumes: `src/data/generated/source-health.json` from Task 2.
- Produces: a "Source freshness" section listing per-source `last_status`, `consecutive_failures`, `last_items`.

- [ ] **Step 1: Add section reading the generated JSON with a try/catch fallback to "not yet run"**

- [ ] **Step 2: Run `node pipelines/run.mjs --check` + `npm test`**

- [ ] **Step 3: Commit**
