# URL Identity + Duplicate Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove independent-project counts with canonical URL identity, repo-vs-artifact distinction, and reported (never auto-merged) duplicate candidates.

**Architecture:** New pure module `pipelines/lib/identity.mjs` (normalize URL, extract GitHub owner/repo/subpath, content fingerprint, candidate grouping). `run.mjs` DEDUPLICATE step uses it to warn and emit `src/data/generated/duplicates.json` (+ public copy). `drafts.mjs` reuses its normalizer so seen-dedupe semantics stay identical.

**Tech Stack:** Node 20+, plain ESM `.mjs`, `node:test`, `node:crypto` (sha256, stdlib).

**Spec:** Phase 4 (Quality, classification and deduplication) — canonical URL normalization, upstream repository identity, fork detection, content fingerprints, semantic duplicate candidates, no auto-merge, fork relationships preserved.

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; only ADD `duplicates.json`, never reshape `registry.json`.
- `npm run build` stays offline/deterministic; no network in the pipeline.
- Fail-closed and green: candidates are warnings + JSON, never build errors (exact slug dupes stay errors, existing behavior).
- Never auto-merge, never modify curated data; never invent licenses, stars, or verification.

---

### Task 1: Identity module

**Files:**
- Create: `pipelines/lib/identity.mjs`
- Test: `tests/identity.test.mjs`

**Interfaces:**
- Consumes: nothing (pure; `node:crypto` only for fingerprints).
- Produces: `normalizeUrl(url)`, `repoIdentity(githubUrl)`, `artifactIdentity(r)`, `fingerprint(r)`, `findCandidates(resources)` used by Task 2; `normalizeUrl` reused by Task 3.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, repoIdentity, fingerprint, findCandidates } from '../pipelines/lib/identity.mjs';

test('normalizeUrl unifies trivial variants', () => {
  assert.equal(normalizeUrl('https://github.com/de-agent/skills/'), 'github.com/de-agent/skills');
  assert.equal(normalizeUrl('http://github.com/de-agent/skills?utm=x#frag'), 'github.com/de-agent/skills');
  assert.equal(normalizeUrl('https://github.com/de-agent/skills.git'), 'github.com/de-agent/skills');
});

test('repoIdentity splits owner, repo, subpath', () => {
  assert.deepEqual(repoIdentity('https://github.com/de-agent/skills/tree/main/sql-reviewer'), {
    host: 'github.com', owner: 'de-agent', repo: 'skills', subpath: 'tree/main/sql-reviewer',
  });
  assert.equal(repoIdentity('https://spark.apache.org/docs/'), null);
});

test('findCandidates flags same-URL and same-fingerprint pairs, never merges', () => {
  const a = { id: 'a', type: 'skill', title: 'X', description: 'does things well', source_url: 'https://x.io/a/', github_url: null };
  const b = { id: 'b', type: 'skill', title: 'X', description: 'does things well', source_url: 'https://x.io/a?utm=1', github_url: null };
  const out = findCandidates([a, b]);
  assert.equal(out.groups.length, 1);
  assert.deepEqual(out.groups[0].ids.sort(), ['a', 'b']);
  assert.ok(['same-url', 'same-fingerprint'].includes(out.groups[0].reason));
});

test('same repo with different subpaths is NOT a duplicate', () => {
  const mk = (id, sub) => ({ id, type: 'skill', title: `Skill ${id}`, description: `unique text ${id}`, source_url: `https://github.com/de-agent/skills/tree/main/${sub}`, github_url: 'https://github.com/de-agent/skills' });
  const out = findCandidates([mk('a', 'one'), mk('b', 'two')]);
  assert.equal(out.groups.length, 0);
});

test('same repo name under different owners is a possible-fork candidate', () => {
  const mk = (id, owner) => ({ id, type: 'mcp', title: `Server ${id}`, description: `unique ${id}`, source_url: `https://${owner}.io/`, github_url: `https://github.com/${owner}/mcp-server` });
  const out = findCandidates([mk('a', 'alice'), mk('b', 'bob')]);
  assert.equal(out.groups.length, 1);
  assert.equal(out.groups[0].reason, 'possible-fork');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/identity.test.mjs`
Expected: FAIL with "Cannot find module ... identity.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
import { createHash } from 'node:crypto';

export function normalizeUrl(url) {
  return String(url ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
}

export function repoIdentity(githubUrl) {
  const n = normalizeUrl(githubUrl);
  const m = n.match(/^github\.com\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
  if (!m) return null;
  return { host: 'github.com', owner: m[1], repo: m[2], subpath: m[3] ?? null };
}

export function artifactIdentity(r) {
  const url = normalizeUrl(r.source_url ?? r.url ?? '');
  const repo = repoIdentity(r.github_url ?? '');
  return { url: url || null, repo: repo ? `${repo.owner}/${repo.repo}` : null, subpath: repo?.subpath ?? null };
}

function collapse(s) { return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase(); }

export function fingerprint(r) {
  return createHash('sha256').update(`${r.type ?? ''}|${collapse(r.title)}|${collapse(r.description)}`).digest('hex').slice(0, 16);
}

export function findCandidates(resources) {
  const groups = [];
  const byKey = new Map();
  const add = (key, id, reason) => {
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, { key, reason, ids: [] });
    byKey.get(key).ids.push(id);
  };
  const seenFp = new Map();
  for (const r of resources) {
    const ident = artifactIdentity(r);
    if (ident.url) add(`url:${ident.url}`, r.id, 'same-url');
    const fp = fingerprint(r);
    if (seenFp.has(fp) && seenFp.get(fp) !== r.id) add(`fp:${fp}`, r.id, 'same-fingerprint');
    else if (!seenFp.has(fp)) seenFp.set(fp, r.id);
    if (seenFp.get(fp) !== r.id) byKey.get(`fp:${fp}`)?.ids.unshift(seenFp.get(fp));
  }
  for (const g of byKey.values()) {
    const ids = [...new Set(g.ids)];
    if (ids.length > 1) groups.push({ ...g, ids: ids.sort() });
  }
  // possible forks/mirrors (offline heuristic): same repo name under
  // different owners. Labeled candidate only — never merged.
  const byRepoName = new Map();
  for (const r of resources) {
    const repo = repoIdentity(r.github_url ?? '');
    if (!repo) continue;
    if (!byRepoName.has(repo.repo)) byRepoName.set(repo.repo, []);
    byRepoName.get(repo.repo).push({ owner: repo.owner, id: r.id });
  }
  for (const [name, list] of byRepoName) {
    if (new Set(list.map((e) => e.owner)).size > 1) {
      groups.push({ key: `fork:${name}`, reason: 'possible-fork', ids: [...new Set(list.map((e) => e.id))].sort() });
    }
  }
  return { groups: groups.sort((a, b) => a.key.localeCompare(b.key)), checked: resources.length };
}
```

Note: same-repo with different subpaths must NOT group — the code above only groups on full-URL or full-fingerprint equality, so monorepo artifacts (111 records across 8 `de-agent/*` repos) stay distinct. Evidence: archaeology found 0 exact URL dupes and no cross-owner repo-name collisions, so the first run should report 0 groups.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/identity.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/identity.mjs tests/identity.test.mjs
git commit -m "feat: add canonical URL identity and duplicate-candidate detection"
```

### Task 2: Wire into DEDUPLICATE + duplicates.json

**Files:**
- Modify: `pipelines/run.mjs`
- Test: `tests/identity.test.mjs` (append pipeline-shape test below)

**Interfaces:**
- Consumes: `findCandidates` from Task 1.
- Produces: `src/data/generated/duplicates.json` + `public/data/generated/duplicates.json` (`{ generated_at, checked, groups }`), console warning lines. Consumed later by admin pages; no registry change.

- [ ] **Step 1: Write the failing test**

```js
test('duplicates.json payload shape', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const p = new URL('../src/data/generated/duplicates.json', import.meta.url);
  assert.ok(existsSync(p), 'duplicates.json must exist after a pipeline run');
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  assert.ok(Array.isArray(doc.groups), 'groups must be an array');
  assert.equal(typeof doc.checked, 'number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/identity.test.mjs`
Expected: FAIL with "duplicates.json must exist after a pipeline run"

- [ ] **Step 3: Write minimal implementation**

In `pipelines/run.mjs`, add the imports:

```js
import { findCandidates } from './lib/identity.mjs';
import { ROOT } from './lib/load.mjs';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
```

Replace the DEDUPLICATE step body with:

```js
step('DEDUPLICATE', () => {
  const seen = new Map();
  let dupes = 0;
  for (const r of resources) {
    if (seen.has(r.slug)) dupes++;
    seen.set(r.slug, r);
  }
  info(`${dupes} duplicate slug(s) detected`);
  const { groups, checked } = findCandidates(resources);
  for (const g of groups.slice(0, 20)) warn(`  ! candidate [${g.reason}] ${g.ids.join(' ~ ')}`);
  info(`${groups.length} duplicate-candidate group(s) across ${checked} resources (reported, never merged)`);
  emitDuplicates({ groups, checked });
  return null;
});
```

And add the helper beside the other helpers (exact code, no placeholders):

```js
function emitDuplicates(doc) {
  const payload = { generated_at: new Date().toISOString(), ...doc };
  for (const dir of [join(ROOT, 'src', 'data', 'generated'), join(ROOT, 'public', 'data', 'generated')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'duplicates.json'), JSON.stringify(payload, null, 1) + '\n', 'utf8');
  }
}
```

Place the `node:fs`/`node:path` imports at the top of `run.mjs` with the other imports. Then run `node pipelines/run.mjs --check` once to generate the file (evidence today: 0 groups expected — 0 exact URL dupes found in archaeology).

- [ ] **Step 4: Run verifications**

Run: `node --test "tests/**/*.test.mjs"`
Expected: all PASS (12 existing + 6 health + new identity tests)

Run: `node pipelines/run.mjs --check`
Expected: pipeline complete, 135 resources, `0 duplicate-candidate group(s)`

- [ ] **Step 5: Commit**

```bash
git add pipelines/run.mjs tests/identity.test.mjs src/data/generated/duplicates.json public/data/generated/duplicates.json
git commit -m "feat: report duplicate candidates in pipeline, emit duplicates.json"
```

### Task 3: Unify drafts.mjs normalizer (no behavior change)

**Files:**
- Modify: `pipelines/lib/drafts.mjs`
- Test: existing `tests/discover.test.mjs` + `tests/isolation.test.mjs` must stay green unchanged.

**Interfaces:**
- Consumes: `normalizeUrl` from Task 1.
- Produces: identical seen-dedupe behavior; delete the private `normalizeUrl` in `drafts.mjs` and import it.

- [ ] **Step 1: Confirm behavior parity** — the private `drafts.mjs` normalizer lowercases, strips protocol, trailing slashes, query/fragment. The Task 1 `normalizeUrl` additionally strips `www.` and `.git`. Risk: a seen URL with `www.` or `.git` would key differently. Mitigate: keep `draftExists`/`writeDraft` keys computed by the same function on both read and write paths, so old-vs-new keys never mix within one store — and `.seen.json` is gitignored runtime state, regenerated on next run. Safe.

- [ ] **Step 2: Replace the private function with the import**

```js
import { normalizeUrl } from './identity.mjs';
```

Delete the local `function normalizeUrl(...)` block. No other edits.

- [ ] **Step 3: Run verifications**

Run: `node --test "tests/**/*.test.mjs"`
Expected: all PASS, zero test-file changes

- [ ] **Step 4: Commit**

```bash
git add pipelines/lib/drafts.mjs
git commit -m "refactor: reuse canonical normalizeUrl in drafts seen-dedupe"
```

### Task 4: Document the identity rules

**Files:**
- Modify: `src/pages/docs/ingestion.md` (append a section; read the file first for voice — plain language, style-guide rules apply, gatekeeping words are a validate warning)

**Interfaces:**
- Consumes: behavior built in Tasks 1–3.
- Produces: curator-facing docs; no code.

- [ ] **Step 1: Append `## Identity and duplicates` covering**: canonical normalization rules (one line each), repo-vs-artifact identity with the monorepo example, candidate reasons (`same-url`, `same-fingerprint`), the never-merge policy, where `duplicates.json` lands.

- [ ] **Step 2: Run `npm run build`**

Run: `npm run build 2>&1 | Select-Object -Last 4`
Expected: Complete, 340+ pages

- [ ] **Step 3: Commit**

```bash
git add src/pages/docs/ingestion.md
git commit -m "docs: document URL identity and duplicate-candidate policy"
```
