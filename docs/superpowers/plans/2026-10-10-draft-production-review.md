# Agent Draft Production + Review Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any LLM agent write publishable drafts from trusted sources through a posted workflow pack, with a prebuilt check suite scoring every draft on length, structure, hygiene-accuracy, safety, voice, media, and discoverability before a human ever opens it.

**Architecture:** Drafts gain `body` + `draft_kind` fields; an `agents/draft-writer/` pack (skill contract + five kind briefs) tells any agent exactly what to produce; a pure `review-checks.mjs` suite scores drafts with 16 named checks and a CLI; the review queue surfaces per-draft scores. The checker and the pack are locked together by a sync test. No LLM runs in the pipeline — the operator's own agent does the writing.

**Tech Stack:** Node 22 plain ESM, `node:test`, existing `yaml` dep, Astro 5 (underscore rule already proven for `_template.md`).

**Spec:** Operator brief — scrape→categorize→draft exists (discover); LLM writes tutorial/blog/skill content; human reviews in any agent harness; prebuilt checks (word count, structure, accuracy-hygiene, readability, beginner voice, diagrams/images/tables, vector-ready text) make review fast. Auto-publishing, model-judged truth, and production-readiness claims are out of scope.

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; drafts are pre-registry. Only ADD `body`, `draft_kind` to `writeDraft` output.
- `npm run build` stays offline/deterministic; review checks are pure string analysis.
- Fail-closed and green: checks never touch the registry build; the CLI exits 1 on fails for agent retry loops.
- Never invent licenses, stars, test results, or verification. Checks measure hygiene and shape — truth stays human.

**Kind vocabulary** (draft_kind): `brief` (discovery excerpt, body optional), `tutorial`, `guide`, `skill`, `reference`, `comparison`. Body floors/ceilings per kind in the BODY table below.

---

### Task 1: Draft body + kind fields

**Files:**
- Modify: `pipelines/lib/drafts.mjs` (`writeDraft`: add `body: ''`, `draft_kind: 'brief'`)
- Modify: `src/lib/drafts.ts` (surface `has_body`, `body_words` — 6 lines, same style as age fields)
- Test: extend `tests/discover.test.mjs`? No — that file tests feeds/classification. New assertions go in Task 3's CLI test via fixtures instead. This task is verified by inspection + existing suite green.

**Interfaces:**
- Consumes: nothing new.
- Produces: `body`, `draft_kind` on every new draft; queue visibility.

- [ ] **Step 1: Edit `writeDraft`** — in the record literal add after `curation_state: 'draft'`:

```js
draft_kind: 'brief', // agent upgrades to tutorial|guide|skill|reference|comparison when writing the body
body: '', // agent-written content; empty until an agent fills it per agents/draft-writer/
```

- [ ] **Step 2: Surface in `drafts.ts`** — interface adds `has_body: boolean; body_words: number | null;`; loader sets `has_body: (first.body ?? '').trim().length > 0`, `body_words: has ? first.body.trim().split(/\s+/).length : null` (compute from a local `bodyText` const to avoid double-trim).

- [ ] **Step 3: Run existing suite green**

Run: `node --test "tests/**/*.test.mjs"` (all PASS — no behavior change for existing drafts)

- [ ] **Step 4: Commit**

```bash
git add pipelines/lib/drafts.mjs src/lib/drafts.ts
git commit -m "feat: add draft body and kind fields for agent-written content"
```

### Task 2: Review-check suite + CLI

**Files:**
- Create: `pipelines/lib/review-checks.mjs`
- Create: `pipelines/review-draft.mjs`
- Test: `tests/review-checks.test.mjs`

**Interfaces:**
- Consumes: draft record object (+ registry id set injected for `accuracy-ids`).
- Produces: `CHECKS` (16 ids), `reviewDraft(draft, { ids })` → `{ score, checks: [{ id, dimension, status, detail, value }] }`; CLI exit 0/1.

Check table (statuses pass|warn|fail; `brief` kind skips body checks — description-only):

| id | dimension | rule |
|---|---|---|
| length-desc | length | description 30–280 chars → pass; <30 fail |
| length-body | length | BODY_FLOORS[kind] = tutorial/guide/comparison [150,400], skill [80,200], reference [0,50], brief [0,0]: words ≥ hi pass, ≥ lo warn, else fail (brief/reference-lo always pass) |
| structure-headings | structure | kind sections present (tutorial/guide: `prereq`, `step`, one of `unknown/inspect/verdict/trust`; skill: `example`; comparison: `criteria`+`verdict`; reference/brief: skip→pass): each missing → fail |
| structure-table | structure | comparison requires a `\|` table → fail if absent; others skip→pass |
| code-fences | structure | tutorial/guide/skill need ≥1 fenced block with language (` ```\w+`) → fail if none; untagged fence → warn; others skip→pass |
| media-diagram | media | tutorial/guide/comparison: mermaid block, `\|` table, or `![alt](…)` present → warn if none (advisory, never fail) |
| media-images | media | every `![…](…)` needs non-empty alt → fail on empty/missing alt |
| safety-destructive | safety | `rm … -rf … /`, `mkfs`, fork-bomb → fail |
| safety-pipes | safety | `curl…\|sh` / `wget…\|sh` → warn (review before running) |
| accuracy-placeholders | accuracy-hygiene | TODO/TBD/FIXME/Lorem/XXX/`<<…>>`/`[insert` → fail |
| accuracy-urls | accuracy-hygiene | every `http(s)` URL parses via `new URL` → fail on malformed (reachability never checked — no network) |
| accuracy-ids | accuracy-hygiene | frontmatter `related` ids all in injected id set → fail on unknown |
| voice-gatekeeping | voice | full 7-word list (simply, just, obviously, trivial, easy, of course, as we all know) → fail on any hit |
| voice-sentences | voice | avg sentence words ≤18 pass, ≤24 warn, else fail |
| voice-passive | voice | be-verb + `ed` heuristic share >25% → warn (advisory, never fail) |
| discoverability-words | discoverability | markdown-stripped words ≥300 pass, ≥100 warn, else fail (brief exempt→pass) |

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, reviewDraft } from '../pipelines/lib/review-checks.mjs';

const good = (over = {}) => ({
  id: 'x', draft_kind: 'tutorial', title: 'T', description: 'A full sentence describing the thing well.',
  related: [], body: `## What\n\nShort lines here.\n\n## Prerequisites\n\nNode.\n\n## Step 1\n\n\`\`\`bash\necho hi\n\`\`\`\n\n## Unknowns\n\nNone yet.\n` + 'Word '.repeat(400), ...over,
});
const ids = new Set(['a']);

test('sixteen named checks exist', () => {
  assert.equal(CHECKS.length, 16);
});

test('clean tutorial passes', () => {
  const out = reviewDraft(good(), { ids });
  assert.ok(out.checks.every((c) => c.status !== 'fail'), JSON.stringify(out.checks.filter((c) => c.status === 'fail')));
});

test('gatekeeping, placeholders, and destructive commands fail', () => {
  const out = reviewDraft(good({ body: 'Simply run rm -rf / now TODO.' }), { ids });
  const failed = new Set(out.checks.filter((c) => c.status === 'fail').map((c) => c.id));
  assert.ok(failed.has('voice-gatekeeping') && failed.has('accuracy-placeholders') && failed.has('safety-destructive'));
});

test('unknown related id fails', () => {
  const out = reviewDraft(good({ related: ['nope'] }), { ids });
  assert.ok(out.checks.some((c) => c.id === 'accuracy-ids' && c.status === 'fail'));
});
```

Note: the `good` body must genuinely pass voice-sentences (avg ≤18): keep sentences short in the fixture. `Word `×400 are not sentences (no periods) — sentence splitter must handle text without periods: split on `[.!?]+`, leftover tail counts as one sentence. 400 words in one tail sentence → avg explodes → fail! Fix the fixture: `'Word. '.repeat(400)` (400 one-word sentences, avg ≈2). Use that.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/review-checks.test.mjs`
Expected: FAIL with "Cannot find module ... review-checks.mjs"

- [ ] **Step 3: Write minimal implementation** (full module — each check a small function returning `{ status, detail, value }`; `reviewDraft` assembles in CHECKS order; `score = { pass, warn, fail }` counts):

```js
export const CHECKS = ['length-desc', 'length-body', 'structure-headings', 'structure-table', 'code-fences', 'media-diagram', 'media-images', 'safety-destructive', 'safety-pipes', 'accuracy-placeholders', 'accuracy-urls', 'accuracy-ids', 'voice-gatekeeping', 'voice-sentences', 'voice-passive', 'discoverability-words'];

const BODY_FLOORS = { tutorial: [150, 400], guide: [150, 400], comparison: [150, 400], skill: [80, 200], reference: [0, 50], brief: [0, 0] };
const GATEKEEPING = /\b(simply|just|obviously|trivial(?:ly)?|easy|of course|as we all know)\b/i;
const PLACEHOLDER = /\b(TODO|TBD|FIXME|Lorem ipsum|XXX)\b|<<[^>]+>>|\[insert/i;
const DESTRUCTIVE = /(^|\s)rm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\s+("\/"|'\/'|\/\s|\/$|--no-preserve-root)|\bmkfs\b|:\(\)\s*{\s*:\|:\s*&\s*};/;
const PIPE_TO_SHELL = /\b(curl|wget)\b[^|\n]*\|\s*(sudo\s+)?(sh|bash)\b/;
const FENCED = /```(\w*)\n[\s\S]*?```/g;
const URL_RE = /https?:\/\/[^\s"'<>)]+/g;
const IMG_RE = /!\[([^\]]*)\]\([^)]+\)/g;

const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
const sentences = (s) => String(s ?? '').replace(/\s+/g, ' ').split(/[.!?]+/).map((x) => x.trim()).filter(Boolean);
const stripMd = (s) => String(s ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`|\-[\]()]/g, ' ');

function passiveShare(text) {
  const ss = sentences(text);
  if (!ss.length) return 0;
  const passive = ss.filter((x) => /\b(am|is|are|was|were|be|been|being)\b\s+\w+ed\b/i.test(x)).length;
  return passive / ss.length;
}

function avgSentence(text) {
  const ss = sentences(text);
  if (!ss.length) return 0;
  return ss.reduce((a, x) => a + words(x), 0) / ss.length;
}

export function reviewDraft(draft, { ids = new Set() } = {}) {
  const kind = draft.draft_kind ?? 'brief';
  const body = String(draft.body ?? '');
  const desc = String(draft.description ?? '');
  const checks = [];
  const add = (id, dimension, status, detail, value = null) => checks.push({ id, dimension, status, detail, value });

  const dl = desc.length;
  add('length-desc', 'length', dl >= 30 && dl <= 280 ? 'pass' : 'fail', `${dl} chars (need 30–280)`, dl);

  const [lo, hi] = BODY_FLOORS[kind] ?? [0, 0];
  const bw = words(body);
  add('length-body', 'length', kind === 'brief' || (kind === 'reference' && lo === 0 && bw === 0) ? 'pass' : bw >= hi ? 'pass' : bw >= lo ? 'warn' : 'fail', `${bw} words (warn <${lo}, pass ≥${hi})`, bw);

  const low = body.toLowerCase();
  const need = { tutorial: ['prereq', 'step'], guide: ['prereq', 'step'], skill: ['example'], comparison: ['criteria', 'verdict'], reference: [], brief: [] }[kind] ?? [];
  const need2 = { tutorial: ['unknown', 'inspect', 'verdict', 'trust'], guide: ['unknown', 'inspect', 'verdict', 'trust'] }[kind] ?? [];
  const missing = [...need.filter((h) => !low.includes(h)), ...(need2.length && !need2.some((h) => low.includes(h)) ? ['trust-section'] : [])];
  add('structure-headings', 'structure', need.length === 0 ? 'pass' : missing.length === 0 ? 'pass' : 'fail', missing.length ? `missing: ${missing.join(', ')}` : 'required sections present');

  const hasTable = body.split('\n').filter((l) => l.trim().startsWith('|')).length >= 2;
  add('structure-table', 'structure', kind !== 'comparison' ? 'pass' : hasTable ? 'pass' : 'fail', hasTable ? 'table present' : kind === 'comparison' ? 'comparison needs a criteria table' : 'n/a');

  const fences = [...body.matchAll(FENCED)];
  const needCode = ['tutorial', 'guide', 'skill'].includes(kind);
  add('code-fences', 'structure', !needCode ? 'pass' : fences.length === 0 ? 'fail' : fences.some((f) => !f[1]) ? 'warn' : 'pass', `${fences.length} fenced block(s)`);

  const hasMermaid = /```mermaid/.test(body);
  const hasImg = IMG_RE.test(body);
  IMG_RE.lastIndex = 0;
  const mediaOk = hasMermaid || hasTable || hasImg;
  add('media-diagram', 'media', ['tutorial', 'guide', 'comparison'].includes(kind) ? (mediaOk ? 'pass' : 'warn') : 'pass', mediaOk ? 'diagram/table/image present' : 'advisory: add a diagram, table, or image');

  const badImg = [...body.matchAll(IMG_RE)].filter((m) => !m[1].trim());
  add('media-images', 'media', badImg.length ? 'fail' : 'pass', badImg.length ? `${badImg.length} image(s) missing alt text` : 'all images have alt text');

  add('safety-destructive', 'safety', DESTRUCTIVE.test(body) ? 'fail' : 'pass', DESTRUCTIVE.test(body) ? 'destructive command pattern found' : 'no destructive patterns');
  add('safety-pipes', 'safety', PIPE_TO_SHELL.test(body) ? 'warn' : 'pass', PIPE_TO_SHELL.test(body) ? 'curl|sh pipe — review before running' : 'no shell-pipe downloads');

  add('accuracy-placeholders', 'accuracy-hygiene', PLACEHOLDER.test(body + desc) ? 'fail' : 'pass', 'placeholder scan');
  const urls = [...new Set([...(body.match(URL_RE) ?? []), ...(desc.match(URL_RE) ?? [])])];
  const badUrls = urls.filter((u) => { try { new URL(u); return false; } catch { return true; } });
  add('accuracy-urls', 'accuracy-hygiene', badUrls.length ? 'fail' : 'pass', `${urls.length} URL(s), ${badUrls.length} malformed (reachability never checked)`);
  const unknownIds = (draft.related ?? []).filter((id) => !ids.has(id));
  add('accuracy-ids', 'accuracy-hygiene', unknownIds.length ? 'fail' : 'pass', unknownIds.length ? `unknown ids: ${unknownIds.join(', ')}` : 'all related ids resolve');

  const gate = body.match(GATEKEEPING) ?? desc.match(GATEKEEPING);
  add('voice-gatekeeping', 'voice', gate ? 'fail' : 'pass', gate ? `banned word: "${gate[0]}"` : 'no gatekeeping words');
  const avg = avgSentence(body || desc);
  add('voice-sentences', 'voice', avg <= 18 ? 'pass' : avg <= 24 ? 'warn' : 'fail', `avg ${avg.toFixed(1)} words/sentence (guide ~15)`, Number(avg.toFixed(1)));
  const ps = passiveShare(body || desc);
  add('voice-passive', 'voice', ps > 0.25 ? 'warn' : 'pass', `${Math.round(ps * 100)}% passive (advisory)`, Number(ps.toFixed(2)));

  const dw = words(stripMd(body));
  add('discoverability-words', 'discoverability', kind === 'brief' ? 'pass' : dw >= 300 ? 'pass' : dw >= 100 ? 'warn' : 'fail', `${dw} indexable words`, dw);

  const score = { pass: checks.filter((c) => c.status === 'pass').length, warn: checks.filter((c) => c.status === 'warn').length, fail: checks.filter((c) => c.status === 'fail').length };
  return { score, checks };
}
```

CLI `pipelines/review-draft.mjs` (exact behavior): `--draft <path> [--json]`; parse YAML, take first record of a list (same convention as drafts); load `registry.json` ids (fail with `registry.json missing — run the pipeline first` exit 2 when absent); print grouped report `pass N · warn N · fail N` + one line per check `[status] id — detail`; `--json` prints the raw object; exit 1 when any fail, else 0.

- [ ] **Step 4: Run verifications**

Run: `node --test tests/review-checks.test.mjs` (PASS), `node pipelines/review-draft.mjs --draft data/drafts/aws-big-data/<any-file>` (real draft: expect fails on empty body — proves the gate bites), exit code check.

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/review-checks.mjs pipelines/review-draft.mjs tests/review-checks.test.mjs
git commit -m "feat: add draft review-check suite with CLI"
```

### Task 3: Agent workflow pack (skill + kind briefs + sync lock)

**Files:**
- Create: `agents/draft-writer/SKILL.md`
- Create: `agents/draft-writer/briefs/{tutorial,guide,skill,reference,comparison}.md`
- Test: `tests/agent-pack.test.mjs` (pack↔checker sync lock below)

**Interfaces:**
- Consumes: `CHECKS` (review lib — import it; no cycle, review imports nothing from agents).
- Produces: the exact invocation an operator pastes into any harness.

SKILL.md (verbatim contract — write exactly this, filling nothing):

```md
# Draft writer — DE//AGENT registry

You write publishable draft content for the DE//AGENT data-engineering registry.
A corrupted or invented draft wastes reviewer time; a good one clears
`review-draft.mjs` with zero fails on the first pass.

## Inputs

- `DRAFT`: path to one file under `data/drafts/<source>/` (a YAML list; edit the first record only).
- `KIND`: one of tutorial | guide | skill | reference | comparison, plus its brief in `agents/draft-writer/briefs/<KIND>.md`. Follow that brief exactly.

## Steps

1. Read the draft record, its `source_url`, and the brief. Read `docs/style-guide.md` rules 1–13.
2. Use ONLY the draft's source URL and records already in `src/data/generated/registry.json` as facts. Fetch nothing else without asking.
3. Write `body` (markdown) and `related` (registry ids only) into the draft file. Set `draft_kind` to KIND. Never touch `id`, `slug`, `verification`, `evidence`, or `curation_state`.
4. Label every executable step `Validated` (only with an engine run you actually performed via `pipelines/execute.mjs`) or `Not executed`.
5. Put everything unverified in an Unknowns section. Never invent commands, versions, test results, licenses, or compatibility.
6. Run `node pipelines/review-draft.mjs --draft <DRAFT>` and fix every fail. Repeat until zero fails. Report warns you intentionally left.

## Prohibitions

- No auto-promotion: never move the file, never run `promote.mjs --apply`, never claim a level.
- No hallucinated evidence: `by: human` entries are written by the reviewer, not you.
- Plain language per the style guide; banned words fail the gate.
```

Opencode invocation (put verbatim in SKILL.md under `## Invoke`):

```text
Write draft <DRAFT-FILE> as KIND=<kind> following agents/draft-writer/SKILL.md and agents/draft-writer/briefs/<kind>.md, then clear review-draft.mjs with zero fails.
```

Briefs (one file per kind; each lists required sections mirroring the check table 1:1 plus kind rules):
- `tutorial.md`: sections What / Prerequisites / Steps (numbered, fenced commands with language tags) / Validate-or-Not-executed / Unknowns; ≥1 diagram-or-table advisory; trigger-first description rule.
- `guide.md`: same skeleton as tutorial + trust/what-to-inspect closing.
- `skill.md`: trigger line (when to use, first), usage example block (required), tight body ok (80–200 words), installation only if verified.
- `reference.md`: link-out shape (url + publisher + why, body optional ≤50 words or fuller summary with source citations).
- `comparison.md`: Criteria table (required), Verdict under constraints (required, no universal winner), Unknowns list, per-claim source links.

- [ ] **Step 1: Write the failing sync test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CHECKS } from '../pipelines/lib/review-checks.mjs';

test('every check id is addressed by the pack', () => {
  const skill = readFileSync(new URL('../agents/draft-writer/SKILL.md', import.meta.url), 'utf8');
  const briefs = ['tutorial', 'guide', 'skill', 'reference', 'comparison'].map((k) =>
    readFileSync(new URL(`../agents/draft-writer/briefs/${k}.md`, import.meta.url), 'utf8').toLowerCase());
  const hay = (skill + '\n' + briefs.join('\n')).toLowerCase();
  const need = { 'length-desc': 'description', 'length-body': 'words', 'structure-headings': 'section', 'structure-table': 'table', 'code-fences': 'fenced', 'media-diagram': 'diagram', 'media-images': 'alt', 'safety-destructive': 'destructive', 'safety-pipes': 'curl', 'accuracy-placeholders': 'placeholder', 'accuracy-urls': 'url', 'accuracy-ids': 'related', 'voice-gatekeeping': 'gatekeeping', 'voice-sentences': 'sentence', 'voice-passive': 'passive', 'discoverability-words': 'indexable' };
  assert.deepEqual(Object.keys(need).sort(), [...CHECKS].sort());
  for (const [id, word] of Object.entries(need)) assert.ok(hay.includes(word), `pack never mentions ${id} (needs "${word}")`);
});

test('all five briefs exist with section checklists', () => {
  for (const k of ['tutorial', 'guide', 'skill', 'reference', 'comparison']) {
    const p = new URL(`../agents/draft-writer/briefs/${k}.md`, import.meta.url);
    assert.ok(existsSync(p), `brief missing: ${k}`);
  }
});
```

The pack prose must therefore literally contain the words: description, words, section, table, fenced, diagram, alt, destructive, curl, placeholder, url, related, gatekeeping, sentence, passive, indexable. Write the briefs with those terms present (e.g. a line `Covers checks: …` is cheating — instead each brief names its applicable checks in a `Covers` line AND the SKILL.md carries the full glossary; simplest honest compliance: SKILL.md contains a check-glossary table mapping each id to one line, which naturally contains most terms; briefs contain their kind terms).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/agent-pack.test.mjs`
Expected: FAIL (agents/ dir missing → ENOENT on SKILL.md read)

- [ ] **Step 3: Write the pack** (SKILL.md verbatim above + five briefs per the shapes above; SKILL.md gains a `## Check glossary` table with one row per CHECK id so the sync test reads real documentation, not padding).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/agent-pack.test.mjs` (PASS)

- [ ] **Step 5: Commit**

```bash
git add agents/draft-writer tests/agent-pack.test.mjs
git commit -m "feat: add agent draft-writer pack locked to review checks"
```

### Task 4: Queue review panel (scores per draft)

**Files:**
- Modify: `src/lib/drafts.ts` (import `reviewDraft`, attach `{ pass, warn, fail } | null`)
- Modify: `src/pages/admin/queue.astro` (score chips per card)
- Test: build + dist asserts (no new unit file).

**Interfaces:**
- Consumes: `reviewDraft` (review lib), registry ids at build time.
- Produces: per-draft score chips; queue sorted fail-first within groups.

- [ ] **Step 1: Compute scores at build time** — in `drafts.ts`:

```ts
import { reviewDraft, CHECKS } from '../../pipelines/lib/review-checks.mjs';

const REGISTRY_JSON = join(process.cwd(), 'src', 'data', 'generated', 'registry.json');
const registryIds: Set<string> = new Set(
  existsSync(REGISTRY_JSON) ? (JSON.parse(readFileSync(REGISTRY_JSON, 'utf8')).resources ?? []).map((r: any) => r.id) : []
);
export const CHECK_TOTAL = CHECKS.length;
```

Interface gains `review: { pass: number; warn: number; fail: number } | null;`; loader builds the review input as `{ ...first, draft_kind: first.draft_kind ?? 'brief', body: first.body ?? '', related: first.related ?? [], description: first.description ?? '' }` and stores only the counts.

- [ ] **Step 2: Render chips + sort** — in the card-meta div after the age chip add:

```astro
{d.review && <span class="chip">{d.review.pass}/{CHECK_TOTAL} checks</span>}
{d.review && d.review.fail > 0 && <span class="chip">{d.review.fail} failing</span>}
```

and change the group items line to fail-first order:

```astro
const items = [...groups[g.id as 'low' | 'medium' | 'high']].sort((a, b) => ((b.review?.fail ?? 0) - (a.review?.fail ?? 0)) || ((b.review?.warn ?? 0) - (a.review?.warn ?? 0)));
```

- [ ] **Step 3: Verify + commit**

Run: `npm run build`, dist assert (queue page contains `checks` chips; a known empty-body draft shows fails), `node --test "tests/**/*.test.mjs"` all PASS.

```bash
git add src/lib/drafts.ts src/pages/admin/queue.astro
git commit -m "feat: surface review-check scores on the queue"
```

Plus a `chore: refresh generated artifacts` commit if builds dirtied generated JSON, keeping the tree clean.
