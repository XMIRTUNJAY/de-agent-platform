# Verification Evidence Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace self-declared verification with evidence-backed levels where every check stores its timestamp, tool, version, and reviewer — and honest claimed-vs-earned labels everywhere.

**Architecture:** New pure module `pipelines/lib/evidence.mjs` (10-check vocabulary, level mapping, earned computation). `normalize.mjs` passes the optional `evidence` block through, `validate.mjs` checks its shape, `run.mjs` auto-attests `metadata_validated` and attaches `r.evidence_summary`, `emit.mjs` adds earned distribution to `stats.json`, pages render the gap honestly.

**Tech Stack:** Node 20+, plain ESM `.mjs`, `node:test`, Astro 5 pages.

**Spec:** Phase 7 (Verification and evaluation) — the ten checks, timestamps/tool versions/revisions/test summaries for every claim, independent checks, no LLM-as-evidence, honest failed/blocked/unverified labels. Benchmark suite is explicitly out of scope (separate future plan).

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; only ADD `evidence` (curated input, optional), `evidence_summary` (per-resource output), `verification_earned`/`over_claims` (stats output). Never reshape or remove.
- `npm run build` stays offline/deterministic; no network in the pipeline.
- Fail-closed and green: over-claims are warnings (capped) + honest labels, never build errors. Exact slug dupes stay errors (existing behavior).
- Never invent licenses, stars, test results, or verification. Pipeline attests only what it actually ran.

---

### Task 1: Evidence module

**Files:**
- Create: `pipelines/lib/evidence.mjs`
- Test: `tests/evidence.test.mjs`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `CHECKS`, `LEVELS`, `REQUIRED`, `evaluateEvidence(resource)`, `evaluateAll(resources)` used by Task 2.

Check vocabulary (ids, from the Phase 7 list): `source_reachable`, `metadata_validated`, `license_reviewed`, `tutorial_generated`, `static_checks_passed`, `build_passed`, `tests_passed`, `smoke_passed`, `output_validated`, `security_reviewed`.

Level gates: `reviewed` needs `metadata_validated + license_reviewed + source_reachable`; `tested` adds `build_passed + tests_passed`; `verified` adds `smoke_passed + output_validated`. `tutorial_generated`, `static_checks_passed`, `security_reviewed` are supplemental — recorded and shown, never gating (a skill without a tutorial is not unreviewed; security is always displayed separately per the registry-meta rule).

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, evaluateEvidence } from '../pipelines/lib/evidence.mjs';

const ev = (check, status = 'passed') => ({ check, status, at: '2026-10-01', by: 'human', tool: 'hands', version: '1' });

test('ten checks in the vocabulary', () => {
  assert.equal(CHECKS.length, 10);
  assert.ok(CHECKS.includes('output_validated'));
});

test('full reviewed evidence earns reviewed', () => {
  const r = { id: 'x', verification: 'reviewed', evidence: [ev('metadata_validated'), ev('license_reviewed'), ev('source_reachable')] };
  const out = evaluateEvidence(r);
  assert.equal(out.earned, 'reviewed');
  assert.equal(out.gap, 0);
});

test('claimed reviewed with no evidence earns community and flags over-claim', () => {
  const r = { id: 'x', verification: 'reviewed', evidence: [] };
  const out = evaluateEvidence(r);
  assert.equal(out.earned, 'community');
  assert.equal(out.gap, 2);
});

test('failed check blocks its level', () => {
  const r = { id: 'x', verification: 'tested', evidence: [ev('metadata_validated'), ev('license_reviewed'), ev('source_reachable'), ev('build_passed'), { ...ev('tests_passed'), status: 'failed' }] };
  const out = evaluateEvidence(r);
  assert.equal(out.earned, 'reviewed');
  assert.equal(out.checks.tests_passed.status, 'failed');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/evidence.test.mjs`
Expected: FAIL with "Cannot find module ... evidence.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
export const CHECKS = [
  'source_reachable', 'metadata_validated', 'license_reviewed', 'tutorial_generated',
  'static_checks_passed', 'build_passed', 'tests_passed', 'smoke_passed',
  'output_validated', 'security_reviewed',
];

export const LEVELS = ['community', 'reviewed', 'tested', 'verified'];
const RANK = Object.fromEntries(LEVELS.map((l, i) => [l, i]));

const REQUIRED = {
  reviewed: ['metadata_validated', 'license_reviewed', 'source_reachable'],
  tested: ['metadata_validated', 'license_reviewed', 'source_reachable', 'build_passed', 'tests_passed'],
  verified: ['metadata_validated', 'license_reviewed', 'source_reachable', 'build_passed', 'tests_passed', 'smoke_passed', 'output_validated'],
};

export function evaluateEvidence(resource) {
  const byCheck = {};
  for (const e of resource.evidence ?? []) {
    const prev = byCheck[e.check];
    if (!prev || String(e.at ?? '') >= String(prev.at ?? '')) byCheck[e.check] = e;
  }
  const checks = {};
  for (const c of CHECKS) {
    const e = byCheck[c];
    checks[c] = e ? { status: e.status, at: e.at ?? null, by: e.by ?? null } : { status: 'unclaimed', at: null, by: null };
  }
  const passed = (c) => checks[c].status === 'passed';
  let earned = 'community';
  for (const level of ['reviewed', 'tested', 'verified']) {
    if (REQUIRED[level].every(passed)) earned = level;
  }
  const claimed = resource.verification ?? 'community';
  return { checks, earned, claimed, gap: (RANK[claimed] ?? 0) - (RANK[earned] ?? 0) };
}

export function evaluateAll(resources) {
  for (const r of resources) r.evidence_summary = evaluateEvidence(r);
  return resources;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/evidence.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/evidence.mjs tests/evidence.test.mjs
git commit -m "feat: add verification evidence vocabulary and earned-level evaluation"
```

### Task 2: Pipeline wiring (passthrough, shape validation, auto-attestation, summary)

**Files:**
- Modify: `pipelines/lib/normalize.mjs` (one line: pass `evidence` through in `normalizeOne`)
- Modify: `pipelines/lib/validate.mjs` (evidence shape block)
- Modify: `pipelines/run.mjs` (EVIDENCE step + VERIFY report)
- Modify: `pipelines/lib/emit.mjs` (earned distribution in stats)
- Test: `tests/evidence.test.mjs` (append pipeline-shape test below)

**Interfaces:**
- Consumes: `evaluateAll` from Task 1; `CHECKS` for shape validation.
- Produces: `r.evidence` (normalized), `r.evidence_summary` (evaluated), `stats.verification_earned`, `stats.over_claims` consumed by Task 3.

- [ ] **Step 1: Write the failing test**

```js
test('pipeline emits earned distribution in stats', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const p = new URL('../src/data/generated/stats.json', import.meta.url);
  assert.ok(existsSync(p));
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  assert.ok(doc.verification_earned, 'stats must carry verification_earned after wiring');
  assert.equal(typeof doc.over_claims, 'number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/evidence.test.mjs`
Expected: FAIL with "stats must carry verification_earned after wiring"

- [ ] **Step 3: Write minimal implementation**

(a) In `normalize.mjs` `normalizeOne`, beside the verification lines add:

```js
evidence: r.evidence ?? [],
```

(b) In `validate.mjs`, inside the per-resource loop after the verification check, add:

```js
import { CHECKS } from './evidence.mjs';
```

at the top, and in the loop:

```js
for (const e of r.evidence ?? []) {
  if (!e || typeof e !== 'object') { errors.push(`${where}: evidence entry must be an object`); continue; }
  if (!CHECKS.includes(e.check)) errors.push(`${where}: unknown evidence check "${e.check}"`);
  if (!['passed', 'failed'].includes(e.status)) errors.push(`${where}: evidence "${e.check}" needs status passed|failed`);
  if (!e.at || Number.isNaN(Date.parse(e.at))) errors.push(`${where}: evidence "${e.check}" needs a parseable at date`);
  if (!['human', 'pipeline'].includes(e.by)) errors.push(`${where}: evidence "${e.check}" needs by human|pipeline`);
}
```

(c) In `run.mjs`, add imports:

```js
import { evaluateAll } from './lib/evidence.mjs';
import { readFileSync as _rf } from 'node:fs';
```

Add after the QUALITY SCORE step, before VERIFY:

```js
// EVIDENCE
step('EVIDENCE', () => {
  const pipelineVersion = JSON.parse(_rf(new URL('../package.json', import.meta.url), 'utf8')).version;
  const at = new Date().toISOString();
  for (const r of resources) {
    r.evidence = [...(r.evidence ?? []), { check: 'metadata_validated', status: 'passed', at, by: 'pipeline', tool: 'de-agent-pipeline', version: pipelineVersion, summary: 'schema + referential integrity OK' }];
  }
  evaluateAll(resources);
  const over = resources.filter((r) => r.evidence_summary.gap > 0);
  info(`${over.length} resource(s) claim more than evidence supports (labeled, never hidden)`);
  return null;
});
```

Extend the VERIFY step body to report earned levels:

```js
const byEarned = {};
for (const r of resources) byEarned[r.evidence_summary.earned] = (byEarned[r.evidence_summary.earned] ?? 0) + 1;
info('earned: ' + Object.entries(byEarned).map(([k, n]) => `${k}:${n}`).join('  '));
```

(d) In `emit.mjs` `buildStats`, extend the returned object with the earned distribution. Exact edit — add the counting before the `return`, and the two keys in the literal:

```js
  const verification_earned = {};
  let over_claims = 0;
  for (const r of resources) {
    const s = r.evidence_summary;
    if (!s) continue;
    verification_earned[s.earned] = (verification_earned[s.earned] ?? 0) + 1;
    if (s.gap > 0) over_claims++;
  }
  return {
    counts: {
      total: resources.length,
      byType,
      byDifficulty,
      byVerification,
      categories: taxonomy.categories.length,
      technologies: taxonomy.technologies.length,
      stages: taxonomy.stages.length,
    },
    verification_earned,
    over_claims,
    byStage,
```

Then run `node pipelines/run.mjs --check` once to regenerate. Evidence today: 135 `metadata_validated` attestations, earned `community` everywhere, 121 over-claims (120 reviewed + 1 tested) reported as info, pipeline stays green.

- [ ] **Step 4: Run verifications**

Run: `node --test "tests/**/*.test.mjs"`
Expected: all PASS

Run: `node pipelines/run.mjs --check`
Expected: pipeline complete, EVIDENCE + earned lines visible, 0 errors

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/normalize.mjs pipelines/lib/validate.mjs pipelines/run.mjs pipelines/lib/emit.mjs tests/evidence.test.mjs src/data/generated/stats.json src/data/generated/registry.json
git commit -m "feat: attest pipeline checks and emit earned verification levels"
```

### Task 3: Honest labels on detail pages and admin health

**Files:**
- Modify: `src/components/ResourceDetail.astro` (verification chip ~line 33 + meta row ~line 299 — read exact context first)
- Modify: `src/pages/admin/health.astro` (earned-vs-claimed summary from `stats.verification_earned` / `stats.over_claims`)
- Test: `npm run build` green + `python -c` assert on `dist/` output containing the gap label for a known over-claimed record.

**Interfaces:**
- Consumes: `res.evidence_summary` (registry records), `stats.verification_earned`, `stats.over_claims`.
- Produces: UI only; no data changes.

- [ ] **Step 1: Read the exact chip/meta lines, then change the chip to show `earned` when `gap > 0`**

Exact edit shape (adapt to the lines read):

```astro
{res.evidence_summary && res.evidence_summary.gap > 0 ? (
  <span class="chip" title="Claimed {res.verification}; evidence on file supports {res.evidence_summary.earned}">evidence: {res.evidence_summary.earned} · claimed {res.verification}</span>
) : (
  <span class="chip">...existing verification chip...</span>
)}
```

Keep the existing chip untouched in the aligned case. Add an evidence row to the meta list showing passed-check count, e.g. `Evidence: 1/10 checks · earned community`.

- [ ] **Step 2: Add an earned-vs-claimed card to admin/health.astro** reading `stats.verification_earned` and `stats.over_claims` with the same defensive style as the source-health section (empty-state fallback when keys are absent).

- [ ] **Step 3: Verify build + rendered output**

Run: `npm run build 2>&1 | Select-Object -Last 4`
Expected: Complete, 340 pages

Run: `python -c "h=open('dist/admin/health/index.html',encoding='utf-8').read(); assert 'over-claim' in h or 'earned' in h; print('health labels ok')"`
Expected: `health labels ok`

- [ ] **Step 4: Commit**

```bash
git add src/components/ResourceDetail.astro src/pages/admin/health.astro
git commit -m "feat: show earned-vs-claimed verification labels"
```

### Task 4: Fix verification docs + backfill guide

**Files:**
- Modify: `src/pages/docs/verification.md` (rewrite — read file first; it currently says "three levels" but the registry has four)
- Test: `npm run build` green + gatekeeping-word grep clean.

**Interfaces:**
- Consumes: behavior from Tasks 1–3.
- Produces: curator docs; no code.

- [ ] **Step 1: Rewrite the doc**: four levels with required checks per level, the 10-check vocabulary table (mark the three supplemental), the evidence entry format with a copy-paste YAML example, the pipeline auto-attestation note, the over-claim policy (labeled, never hidden, never auto-downgraded), and how to backfill evidence for the 121 currently over-claimed records. Plain language; no gatekeeping words.

- [ ] **Step 2: Verify**

Run: `npm run build 2>&1 | Select-Object -Last 4`
Expected: Complete

Run: `Select-String -Path "src/pages/docs/verification.md" -Pattern "simply|obviously|trivial|of course|as we all know"`
Expected: no matches

- [ ] **Step 3: Commit**

```bash
git add src/pages/docs/verification.md docs/superpowers/plans/2026-10-10-verification-evidence.md
git commit -m "docs: evidence-backed verification levels and backfill guide"
```
