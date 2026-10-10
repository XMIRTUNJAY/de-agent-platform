# Content Depth + Evidence-Gated Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make content depth measurable and audited on every build, and make draft promotion require depth plus evidence before a record can ship.

**Architecture:** New pure rubric module (`pipelines/lib/depth.mjs`: 0–100 score from four checkable signal groups, reuse `REQUIRED_BY_TYPE` from validate and `REQUIRED` from evidence) wired as a warning-only DEPTH pipeline step emitting `depth.json`; plus a `pipelines/promote.mjs` gate that validates a draft file against depth + evidence + identity rules and moves it into `data/curated/` only with `--apply`.

**Tech Stack:** Node 22, plain ESM `.mjs`, `node:test`, existing `yaml` dep.

**Spec:** Content readiness for 1000+ pages — depth before breadth: audit checks that flag thin content, tests that lock the rubric, and a promotion workflow whose evidence gate stops the 121 over-claims from growing. Benchmark suite and widening batches are out of scope.

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; only ADD `depth` (per-resource), `depth.json`, `stats.depth`. Never reshape or remove.
- `npm run build` stays offline/deterministic; depth is computed, never fetched.
- Fail-closed and green: thin content warns (capped) + JSON, never build errors. Promotion moves nothing without `--apply`.
- Never invent licenses, stars, test results, or verification.

---

### Task 1: Depth rubric module + tests

**Files:**
- Create: `pipelines/lib/depth.mjs`
- Test: `tests/depth.test.mjs`
- Modify: `pipelines/lib/validate.mjs` (one word: export `REQUIRED_BY_TYPE`)
- Modify: `pipelines/lib/evidence.mjs` (one word: export `REQUIRED`)

**Interfaces:**
- Consumes: `REQUIRED_BY_TYPE` (validate), `REQUIRED` (evidence).
- Produces: `scoreDepth(resource)`, `depthAll(resources)` used by Task 2; `minDepthForClaim` used by Task 3.

Rubric (0–100, all signals machine-checkable on normalized resources):
- Description (40): len ≥ 500 → 40; 200–499 → 25; 30–199 → 10; < 30 → 0.
- Required fields (30): fraction of `REQUIRED_BY_TYPE[type]` present and non-empty × 30. Types with no entry (tutorial, checklist, tool) score 30 when common fields hold.
- Runnable (20): 10 if `install_command` or `installation` (any shape) present; 10 if any of `example`, `tests`, `evaluation`, `implementations`, `contents` is non-empty.
- Richness (10): count non-empty among `tags` (≥1), `learning_objectives`, `prerequisites`, any `relationships` list: ≥2 → 10; 1 → 5; 0 → 0.

Levels: `deep` ≥ 75, `adequate` ≥ 50, `thin` < 50.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreDepth } from '../pipelines/lib/depth.mjs';

const rich = (over = {}) => ({
  id: 'x', type: 'skill', title: 'T', description: 'd '.repeat(300),
  category: 'cat-sql', license: 'MIT', verification: 'reviewed', last_verified: '2026-10-01',
  version: '1.0.0', tags: ['a', 'b'], learning_objectives: ['o'],
  install_command: 'npm i x', tests: ['t1'], ...over,
});

test('full record scores deep', () => {
  const out = scoreDepth(rich());
  assert.equal(out.level, 'deep');
  assert.ok(out.score >= 75);
});

test('one-line description scores thin', () => {
  const out = scoreDepth(rich({ description: 'does stuff', tags: [], learning_objectives: [], install_command: null, tests: [] }));
  assert.equal(out.level, 'thin');
  assert.ok(out.score < 50);
});

test('reference without install is judged fairly', () => {
  const out = scoreDepth({ id: 'r', type: 'reference', title: 'Docs', description: 'd '.repeat(300), category: 'cat-sql', url: 'https://x.io/', publisher: 'X', license: 'Proprietary', tags: ['docs'] });
  assert.ok(['adequate', 'deep'].includes(out.level));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/depth.test.mjs`
Expected: FAIL with "Cannot find module ... depth.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
import { REQUIRED_BY_TYPE } from './validate.mjs';

const filled = (v) =>
  v !== undefined && v !== null && v !== '' &&
  (!Array.isArray(v) || v.length > 0) &&
  (Array.isArray(v) || typeof v !== 'object' || Object.keys(v).length > 0);

export function scoreDepth(r) {
  const signals = {};
  const len = String(r.description ?? '').length;
  signals.description = len >= 500 ? 40 : len >= 200 ? 25 : len >= 30 ? 10 : 0;
  const required = REQUIRED_BY_TYPE[r.type] ?? [];
  signals.required = required.length === 0 ? 30 : Math.round((required.filter((k) => filled(r[k])).length / required.length) * 30);
  const hasInstall = filled(r.install_command) || filled(r.installation);
  const hasRunnable = ['example', 'tests', 'evaluation', 'implementations', 'contents'].some((k) => filled(r[k]));
  signals.runnable = (hasInstall ? 10 : 0) + (hasRunnable ? 10 : 0);
  const richCount = [
    Array.isArray(r.tags) && r.tags.length > 0,
    filled(r.learning_objectives),
    filled(r.prerequisites),
    Object.values(r.relationships ?? {}).some((v) => Array.isArray(v) ? v.length > 0 : filled(v)),
  ].filter(Boolean).length;
  signals.richness = richCount >= 2 ? 10 : richCount === 1 ? 5 : 0;
  const score = signals.description + signals.required + signals.runnable + signals.richness;
  return { score, level: score >= 75 ? 'deep' : score >= 50 ? 'adequate' : 'thin', signals };
}

export function depthAll(resources) {
  for (const r of resources) r.depth = scoreDepth(r);
  return resources;
}
```

First add `export` to `const REQUIRED_BY_TYPE` in `validate.mjs` and to `const REQUIRED` in `evidence.mjs` (one word each; no behavior change; existing tests must stay green).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/depth.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/depth.mjs tests/depth.test.mjs pipelines/lib/validate.mjs pipelines/lib/evidence.mjs
git commit -m "feat: add content-depth rubric with auditable signals"
```

### Task 2: Pipeline DEPTH audit (warnings + JSON, never errors)

**Files:**
- Modify: `pipelines/run.mjs` (DEPTH step after QUALITY SCORE)
- Modify: `pipelines/lib/emit.mjs` (`stats.depth`)
- Test: append to `tests/depth.test.mjs` (stats-shape test below)

**Interfaces:**
- Consumes: `depthAll` from Task 1.
- Produces: `r.depth`, `src/data/generated/depth.json` (+ public copy), `stats.depth` consumed by admin pages later.

- [ ] **Step 1: Write the failing test**

```js
test('pipeline emits depth distribution in stats', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const p = new URL('../src/data/generated/stats.json', import.meta.url);
  assert.ok(existsSync(p));
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  assert.ok(doc.depth && typeof doc.depth.thin === 'number', 'stats must carry depth after wiring');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/depth.test.mjs`
Expected: FAIL with "stats must carry depth after wiring"

- [ ] **Step 3: Write minimal implementation**

In `run.mjs`, add import + step (follow the EVIDENCE step pattern exactly):

```js
import { depthAll } from './lib/depth.mjs';

// DEPTH
step('DEPTH', () => {
  depthAll(resources);
  const byLevel = {};
  for (const r of resources) byLevel[r.depth.level] = (byLevel[r.depth.level] ?? 0) + 1;
  for (const r of resources.filter((r) => r.depth.level === 'thin').slice(0, 20)) warn('  ! thin [' + r.depth.score + '] ' + r.id);
  info('depth: ' + Object.entries(byLevel).map(([k, n]) => `${k}:${n}`).join('  '));
  emitDepth(byLevel);
  return null;
});
```

Helper beside `emitDuplicates` (same shape):

```js
function emitDepth(byLevel) {
  const payload = { generated_at: new Date().toISOString(), levels: byLevel, thin_ids: resources.filter((r) => r.depth.level === 'thin').map((r) => r.id).sort() };
  for (const dir of [join(ROOT, 'src', 'data', 'generated'), join(ROOT, 'public', 'data', 'generated')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'depth.json'), JSON.stringify(payload, null, 1) + '\n', 'utf8');
  }
}
```

In `emit.mjs` `buildStats`, add `depth` counting next to `verification_earned`:

```js
const depth = { deep: 0, adequate: 0, thin: 0 };
for (const r of resources) {
  if (r.depth) depth[r.depth.level] = (depth[r.depth.level] ?? 0) + 1;
}
```

and add the `depth` key to the returned object literal beside `verification_earned, over_claims`. Then run `node pipelines/run.mjs --check` once. Evidence today: ~133 thin expected — warnings capped at 20, pipeline stays green.

- [ ] **Step 4: Run verifications**

Run: `node --test "tests/**/*.test.mjs"` (all PASS), `node pipelines/run.mjs --check` (green, DEPTH line visible)

- [ ] **Step 5: Commit**

```bash
git add pipelines/run.mjs pipelines/lib/emit.mjs tests/depth.test.mjs src/data/generated/stats.json src/data/generated/registry.json src/data/generated/depth.json public/data/generated/depth.json
git commit -m "feat: audit content depth on every build, emit depth.json"
```

### Task 3: Evidence-gated promotion CLI

**Files:**
- Create: `pipelines/promote.mjs`
- Test: `tests/promote.test.mjs` (temp-dir fixtures, no repo writes)

**Interfaces:**
- Consumes: `REQUIRED` (evidence, for claim-gating), `TYPED_DIRS` (load, for target dir), taxonomy + registry via injected loaders (pure `checkPromotion`, thin CLI wrapper).
- Produces: promotion verdicts; with `--apply`, moves the file. Nothing else writes.

`checkPromotion(draft, ctx)` where `ctx = { ids:Set, slugs:Set, catIds:Set, licenseIds:Set }` returns `{ ok, errors:[], warnings:[] }`. Rules (errors block, warnings advise):
- error when `id`/`slug`/`type`/`title`/`description`/`category` missing; `id`/`slug` already in registry (duplicate guard — the identity story); `type` not in `TYPED_DIRS`; `category` unknown; license missing or outside catalogue (and not `Proprietary*`); description < 200 chars (error code `too-thin`, detail names the 200 floor and the fix: expand before promoting).
- error when claimed `reviewed` without passed `license_reviewed` + `source_reachable` evidence; claimed `tested` additionally without `build_passed` + `tests_passed`; claimed `verified` additionally without `smoke_passed` + `output_validated` (read the check lists from imported `REQUIRED`, never hardcode).
- warning when description 200–499 (adequate but improvable), when no `tags`, when claimed level exceeds evidence by exactly the pipeline-attestable gap (hint: `metadata_validated` is attested at build, so a draft needs the human checks only).

CLI: `node pipelines/promote.mjs --draft <path> [--apply]`. Default dry: print verdict, move nothing, exit 0 on ok / 1 on errors. `--apply`: resolve target dir from `TYPED_DIRS[draft.type]` under `data/curated/`, refuse when the filename already exists there (never overwrite), move the file, delete the draft, print next steps (`node pipelines/run.mjs --check`, then `npm run build`).

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPromotion } from '../pipelines/promote.mjs';

const ctx = () => ({ ids: new Set(['taken']), slugs: new Set(['taken']), catIds: new Set(['cat-sql']), licenseIds: new Set(['MIT']) });
const draft = (over = {}) => ({
  id: 'new-thing', slug: 'new-thing', type: 'skill', title: 'T', description: 'd '.repeat(150),
  category: 'cat-sql', license: 'MIT', verification: 'community', version: '1.0.0', last_verified: '2026-10-01', ...over,
});

test('clean community draft passes', () => {
  const out = checkPromotion(draft(), ctx());
  assert.equal(out.ok, true);
  assert.equal(out.errors.length, 0);
});

test('duplicate id is blocked', () => {
  const out = checkPromotion(draft({ id: 'taken' }), ctx());
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => e.code === 'duplicate-id'));
});

test('thin description is blocked with the floor named', () => {
  const out = checkPromotion(draft({ description: 'short' }), ctx());
  assert.ok(out.errors.some((e) => e.code === 'too-thin' && e.detail.includes('200')));
});

test('reviewed claim without evidence is blocked', () => {
  const out = checkPromotion(draft({ verification: 'reviewed' }), ctx());
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => e.code === 'missing-evidence'));
});
```

`checkPromotion` must be importable without CLI side effects — structure `promote.mjs` with exports first and the `main()` call guarded by `if (process.argv[1] === fileURLToPath(import.meta.url))`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/promote.test.mjs`
Expected: FAIL with "Cannot find module ... promote.mjs"

- [ ] **Step 3: Write minimal implementation** (per the rules above; error objects are `{ code, detail }`)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/promote.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipelines/promote.mjs tests/promote.test.mjs
git commit -m "feat: add evidence-gated draft promotion check"
```

### Task 4: Promotion docs + depth section on admin health + final verify

**Files:**
- Modify: `src/pages/docs/contributing.md` (append promotion section — file ends with the four-question bar)
- Modify: `src/pages/admin/health.astro` (depth card from `stats.depth`, same defensive style as evidence section)
- Test: build + dist asserts.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: docs + UI; no data changes.

- [ ] **Step 1: Append to contributing.md** a `## Promotion checklist` section: the exact gate (unique id/slug, known category, declared license, ≥200-char description, evidence matching the claimed level), the `promote.mjs --draft … [--apply]` command, and the rule that drafts ship as `community` unless evidence is attached. Plain language; no gatekeeping words.

- [ ] **Step 2: Add a depth card to admin/health.astro** reading `(stats as any).depth` with an empty-state fallback, in the same card-grid style as the earned-vs-claimed section.

- [ ] **Step 3: Final verify + commit**

Run: `node --test "tests/**/*.test.mjs"` (all PASS), `node pipelines/run.mjs --check` (green), `npm run build 2>&1 | Select-Object -Last 3` (340 pages), gatekeeping grep on `contributing.md` clean, `python -c` assert `dist/admin/health/index.html` contains `depth` or `thin`.

```bash
git add src/pages/docs/contributing.md src/pages/admin/health.astro docs/superpowers/plans/2026-10-10-content-depth-promotion.md
git commit -m "docs: promotion checklist and depth visibility"
```

Plus a `chore: refresh generated artifacts` commit if the build dirtied generated JSON, keeping the tree clean.
