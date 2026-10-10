# Safe Execution Engine (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run curator-declared project commands under an explicit policy gate with scrubbed environments, redacted logs, checksums, and machine-readable results that feed the Phase 7 evidence model.

**Architecture:** Pure policy module (`exec-policy.mjs`: eligibility, states, failure categories) plus a guarded runner (`exec-runner.mjs`: `dry` default backend + `local` backend behind an explicit flag) driven by a CLI (`pipelines/execute.mjs`) that reads curator-authored manifests and emits result JSON plus paste-ready evidence YAML. Container backends are a declared interface, explicitly not built here (no daemon on this host).

**Tech Stack:** Node 22 (stdlib `child_process`, `crypto`), plain ESM `.mjs`, `node:test`, YAML manifests via existing `yaml` dep.

**Spec:** Phase 6 (Safe execution engine) — capability boundaries, per-project commands, isolation, no secrets, limits, checksums, provenance, cleanup, persistent logs, result summaries, explicit states, failure categories, never execute on LLM say-so, passing build ≠ production readiness. Scope: core engine only; Docker backend and benchmark suite are separate future plans.

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; NOTHING in this plan edits curated records or generated files (results go to gitignored `data/cache/executions/`).
- `npm run build` stays offline/deterministic; the engine never runs during build (explicit CLI only, default backend `dry` never spawns).
- Fail-closed: policy violations block before spawn; a blocked run never executes anything.
- Never invent licenses, stars, test results, or verification. Results describe what actually ran.

---

### Task 1: Policy module (eligibility, states, failure categories)

**Files:**
- Create: `pipelines/lib/exec-policy.mjs`
- Test: `tests/exec-policy.test.mjs`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `evaluatePolicy(manifest)`, `nextState(state, event)`, `classifyFailure(outcome)` used by Tasks 2–3.

Manifest shape (exact):

```yaml
id: smoke-registry-pipeline
target: null
trust: curator-approved
workdir: .
commands:
  - name: pipeline-check
    argv: ['node', 'pipelines/run.mjs', '--check']
    timeout_ms: 120000
capabilities:
  network: off
  filesystem: workdir-only
limits:
  timeout_ms: 120000
  max_output_bytes: 200000
```

Policy rules: `trust` must be `curator-approved` (anything else → blocked `untrusted-manifest`); every `argv[0]` must be a bare command name or a repo-relative path (absolute paths and `..` segments → blocked `path-escape`); `capabilities.network: off` is the only allowed value in this plan (anything else → blocked `network-not-supported`); `workdir` must resolve inside the repo root (checked by the runner with the real root, policy checks the string form: absolute or `..` → blocked).

States: `discovered → collected → normalized → eligible_for_execution → running → passed | failed | blocked`. `nextState(state, event)` allows only listed transitions; anything else returns `{ ok: false }` and keeps the state.

Failure categories: `timeout`, `nonzero-exit`, `missing-executable`, `output-overflow`, `policy-blocked`, `spawn-error`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy, nextState, classifyFailure } from '../pipelines/lib/exec-policy.mjs';

const base = () => ({
  id: 'x', trust: 'curator-approved', workdir: '.',
  commands: [{ name: 'check', argv: ['node', '--version'] }],
  capabilities: { network: 'off', filesystem: 'workdir-only' },
  limits: { timeout_ms: 5000, max_output_bytes: 10000 },
});

test('approved offline manifest is eligible', () => {
  const out = evaluatePolicy(base());
  assert.equal(out.eligible, true);
  assert.equal(out.reasons.length, 0);
});

test('untrusted manifest is blocked before anything runs', () => {
  const m = base(); m.trust = 'llm-suggested';
  const out = evaluatePolicy(m);
  assert.equal(out.eligible, false);
  assert.ok(out.reasons.some((r) => r.code === 'untrusted-manifest'));
});

test('network request is blocked (no backend supports it yet)', () => {
  const m = base(); m.capabilities.network = 'allowlist:registry.npmjs.org';
  const out = evaluatePolicy(m);
  assert.equal(out.eligible, false);
  assert.ok(out.reasons.some((r) => r.code === 'network-not-supported'));
});

test('absolute binary path is blocked', () => {
  const m = base(); m.commands[0].argv = ['C:\\Windows\\System32\\cmd.exe', '/c', 'dir'];
  const out = evaluatePolicy(m);
  assert.equal(out.eligible, false);
  assert.ok(out.reasons.some((r) => r.code === 'path-escape'));
});

test('state machine only allows listed transitions', () => {
  assert.equal(nextState('eligible_for_execution', 'start').ok, true);
  assert.equal(nextState('eligible_for_execution', 'start').state, 'running');
  assert.equal(nextState('discovered', 'pass').ok, false);
  assert.equal(nextState('running', 'timeout').state, 'failed');
});

test('failure classification', () => {
  assert.equal(classifyFailure({ timedOut: true }).category, 'timeout');
  assert.equal(classifyFailure({ overflow: true, maxBytes: 10 }).category, 'output-overflow');
  assert.equal(classifyFailure({ error: { code: 'ENOENT' } }).category, 'missing-executable');
  assert.equal(classifyFailure({ exitCode: 3 }).category, 'nonzero-exit');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/exec-policy.test.mjs`
Expected: FAIL with "Cannot find module ... exec-policy.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
const VALID = {
  trust: ['curator-approved'],
  network: ['off'],
  filesystem: ['workdir-only'],
};

export function evaluatePolicy(manifest) {
  const reasons = [];
  const block = (code, detail) => reasons.push({ code, detail });
  if (!VALID.trust.includes(manifest.trust)) block('untrusted-manifest', `trust is ${JSON.stringify(manifest.trust)}; must be curator-approved by a human`);
  if (!VALID.network.includes(manifest.capabilities?.network)) block('network-not-supported', 'only network: off is supported; no backend grants network access yet');
  if (!VALID.filesystem.includes(manifest.capabilities?.filesystem)) block('unsupported-filesystem', 'only filesystem: workdir-only is supported');
  if (typeof manifest.workdir === 'string' && (isAbsolute(manifest.workdir) || manifest.workdir.split(/[\\/]/).includes('..'))) {
    block('path-escape', `workdir ${JSON.stringify(manifest.workdir)} must be repo-relative without ..`);
  }
  for (const c of manifest.commands ?? []) {
    const bin = c.argv?.[0] ?? '';
    if (isAbsolute(bin) || String(bin).split(/[\\/]/).includes('..')) block('path-escape', `command ${c.name ?? bin}: binary must be a bare name or repo-relative path`);
    if (!c.name || !Array.isArray(c.argv) || c.argv.length === 0) block('malformed-command', 'every command needs a name and a non-empty argv');
  }
  if ((manifest.commands ?? []).length === 0) block('no-commands', 'manifest declares no commands');
  return { eligible: reasons.length === 0, reasons };
}

function isAbsolute(p) {
  return /^[a-zA-Z]:[\\/]/.test(String(p)) || String(p).startsWith('/') || String(p).startsWith('\\\\');
}

const TRANSITIONS = {
  discovered: ['collect'],
  collected: ['normalize'],
  normalized: ['mark-eligible'],
  eligible_for_execution: ['start'],
  running: ['pass', 'fail', 'timeout', 'block'],
  passed: [],
  failed: [],
  blocked: [],
};
const EVENT_STATE = { collect: 'collected', normalize: 'normalized', 'mark-eligible': 'eligible_for_execution', start: 'running', pass: 'passed', fail: 'failed', timeout: 'failed', block: 'blocked' };

export function nextState(state, event) {
  if ((TRANSITIONS[state] ?? []).includes(event)) return { ok: true, state: EVENT_STATE[event] };
  return { ok: false, state };
}

export function classifyFailure(outcome) {
  if (outcome.timedOut) return { category: 'timeout', detail: `exceeded ${outcome.timeoutMs}ms` };
  if (outcome.overflow) return { category: 'output-overflow', detail: `exceeded ${outcome.maxBytes} bytes of output` };
  if (outcome.error?.code === 'ENOENT') return { category: 'missing-executable', detail: `binary not found: ${outcome.error.path ?? outcome.argv0 ?? 'unknown'}` };
  if (outcome.error) return { category: 'spawn-error', detail: String(outcome.error.message ?? outcome.error) };
  return { category: 'nonzero-exit', detail: `exit code ${outcome.exitCode}` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/exec-policy.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/exec-policy.mjs tests/exec-policy.test.mjs
git commit -m "feat: add execution policy gate with states and failure categories"
```

### Task 2: Guarded runner (dry + local backends, redaction, provenance)

**Files:**
- Create: `pipelines/lib/exec-runner.mjs`
- Test: `tests/exec-runner.test.mjs`

**Interfaces:**
- Consumes: `evaluatePolicy`, `classifyFailure` from Task 1.
- Produces: `runManifest(manifest, { backend, root, sleep })`, `redact(text)`, `scrubEnv(env)` used by Task 3.

Runner contract: `runManifest` returns `{ state, commands: [{ name, exitCode, timedOut, durationMs, outputBytes, sha256, failure }], log, resultPath }`. Default backend `dry` runs NOTHING (returns eligible plan + fabricated-zero execution: state stays `eligible_for_execution`, each command marked `skipped: true`). Backend `local` spawns via `child_process.spawn` with: cwd forced under root (verified with `path.relative`), env scrubbed to an allowlist (`PATH`, `SystemRoot`, `SYSTEMROOT`, `TEMP`, `TMP`, `HOME`, `USERPROFILE`, `LANG`, `LC_ALL`, `NODE_ENV=production` forced, everything matching `TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|AUTH` dropped), per-command timeout (default from manifest limits), stdout+stderr capped at `max_output_bytes` (kill + `output-overflow` on breach), secrets redacted in the transcript (`AKIA…`, `ghp_/gho_/github_pat_`, `xox[bap]-…`, `-----BEGIN … PRIVATE KEY-----`, `password\s*[:=]\s*\S+`, `npm_…` tokens), sha256 over the redacted transcript, provenance header `{ tool: 'de-agent-exec', version, manifest, backend, started_at, finished_at }`.

Version source: read `package.json` at the repo root passed in (no hardcoded version).

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, scrubEnv, runManifest } from '../pipelines/lib/exec-runner.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = (over = {}) => ({
  id: 't', trust: 'curator-approved', workdir: '.', capabilities: { network: 'off', filesystem: 'workdir-only' },
  limits: { timeout_ms: 5000, max_output_bytes: 50000 },
  commands: [{ name: 'v', argv: ['node', '--version'] }],
  ...over,
});

test('redact removes secrets from text and argv', () => {
  const s = redact('key=AKIAIOSFODNN7EXAMPLE token ghp_abc123xyz456789012345678901234567890 user password: s3cr3t!');
  assert.ok(!s.includes('AKIAIOSFODNN7EXAMPLE') && !s.includes('ghp_abc') && !s.includes('s3cr3t'));
});

test('scrubEnv drops secret vars and forces production', () => {
  const out = scrubEnv({ PATH: '/x', GITHUB_TOKEN: 'shh', MY_SECRET: 'shh', NODE_ENV: 'development' });
  assert.equal(out.PATH, '/x');
  assert.ok(!('GITHUB_TOKEN' in out) && !('MY_SECRET' in out));
  assert.equal(out.NODE_ENV, 'production');
});

test('dry backend never spawns (bad binary still eligible)', async () => {
  const out = await runManifest(manifest({ commands: [{ name: 'nope', argv: ['definitely-not-a-binary-xyz', '--x'] }] }), { backend: 'dry', root: ROOT });
  assert.equal(out.state, 'eligible_for_execution');
  assert.equal(out.commands[0].skipped, true);
});

test('local backend runs node --version to passed', async () => {
  const out = await runManifest(manifest(), { backend: 'local', root: ROOT });
  assert.equal(out.state, 'passed');
  assert.equal(out.commands[0].exitCode, 0);
  assert.match(out.commands[0].sha256, /^[0-9a-f]{64}$/);
});

test('local backend times out and classifies timeout', async () => {
  const m = manifest({ commands: [{ name: 'slow', argv: ['node', '-e', 'setTimeout(()=>{},5000)'] }], limits: { timeout_ms: 300, max_output_bytes: 50000 } });
  const out = await runManifest(m, { backend: 'local', root: ROOT });
  assert.equal(out.state, 'failed');
  assert.equal(out.commands[0].failure.category, 'timeout');
});

test('local backend caps runaway output and classifies overflow', async () => {
  const m = manifest({ commands: [{ name: 'spam', argv: ['node', '-e', 'setInterval(()=>console.log("x".repeat(1000)),5)'] }], limits: { timeout_ms: 10000, max_output_bytes: 5000 } });
  const out = await runManifest(m, { backend: 'local', root: ROOT });
  assert.equal(out.state, 'failed');
  assert.equal(out.commands[0].failure.category, 'output-overflow');
});

test('blocked manifest never spawns', async () => {
  const m = manifest({ trust: 'llm-suggested' });
  const out = await runManifest(m, { backend: 'local', root: ROOT });
  assert.equal(out.state, 'blocked');
  assert.equal(out.spawned, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/exec-runner.test.mjs`
Expected: FAIL with "Cannot find module ... exec-runner.mjs"

- [ ] **Step 3: Write minimal implementation**

```js
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { evaluatePolicy, classifyFailure } from './exec-policy.mjs';

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/g,
  /github_pat_[A-Za-z0-9_]{80,}/g,
  /\bxox[bap]- [A-Za-z0-9-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /\bnpm_[A-Za-z0-9]{36,}/g,
  /password\s*[:=]\s*\S+/gi,
];

export function redact(text) {
  let out = String(text ?? '');
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[REDACTED]');
  return out;
}

const ENV_ALLOW = new Set(['PATH', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LANG', 'LC_ALL', 'COMSPEC', 'PATHEXT']);
const ENV_SECRET = /TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|AUTH/i;

export function scrubEnv(env) {
  const out = {};
  for (const [k, v] of Object.entries(env ?? {})) {
    if (!ENV_ALLOW.has(k)) continue;
    if (ENV_SECRET.test(k)) continue;
    out[k] = v;
  }
  out.NODE_ENV = 'production';
  return out;
}

function toolVersion(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function runManifest(manifest, { backend = 'dry', root = process.cwd(), env = process.env } = {}) {
  const policy = evaluatePolicy(manifest);
  const started_at = new Date().toISOString();
  const provenance = { tool: 'de-agent-exec', version: toolVersion(root), manifest: manifest.id, backend, started_at };
  if (!policy.eligible) {
    return { state: 'blocked', spawned: false, policy, commands: [], log: '', resultPath: null, provenance };
  }
  if (backend === 'dry') {
    return {
      state: 'eligible_for_execution', spawned: false, policy,
      commands: (manifest.commands ?? []).map((c) => ({ name: c.name, skipped: true })),
      log: `# dry run — nothing executed. Re-run with --backend local to execute.\n`,
      resultPath: null, provenance,
    };
  }
  if (backend !== 'local') throw new Error(`unknown backend: ${backend} (supported: dry, local; docker is planned, no daemon on this host)`);
  const cwd = resolve(root, manifest.workdir ?? '.');
  if (relative(root, cwd).startsWith('..') || !cwd.startsWith(resolve(root))) {
    return { state: 'blocked', spawned: false, policy: { eligible: false, reasons: [{ code: 'path-escape', detail: 'workdir escapes repo root' }] }, commands: [], log: '', resultPath: null, provenance };
  }
  const results = [];
  let transcript = '';
  let state = 'passed';
  for (const cmd of manifest.commands ?? []) {
    const r = await runOne(cmd, { cwd, root, env, limits: manifest.limits ?? {} });
    results.push(r);
    transcript += `$ ${redact(cmd.argv.join(' '))}\n${r.output}\n`;
    if (r.exitCode !== 0 || r.timedOut) state = 'failed';
  }
  const finished_at = new Date().toISOString();
  return { state, spawned: true, policy, commands: results, log: transcript, resultPath: null, provenance: { ...provenance, finished_at } };
}
```

Then `runOne` (exact code, no placeholders):

```js
async function runOne(cmd, { cwd, root, env, limits }) {
  const timeoutMs = cmd.timeout_ms ?? limits.timeout_ms ?? 60000;
  const maxBytes = limits.max_output_bytes ?? 200000;
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(cmd.argv[0], cmd.argv.slice(1), { cwd, env: scrubEnv(env), shell: false, windowsHide: true });
    let output = '';
    let overflow = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
      resolve(finish());
    }, timeoutMs);
    child.stdout.on('data', (d) => { output += d; if (Buffer.byteLength(output) > maxBytes && !overflow) { overflow = true; child.kill('SIGKILL'); } });
    child.stderr.on('data', (d) => { output += d; if (Buffer.byteLength(output) > maxBytes && !overflow) { overflow = true; child.kill('SIGKILL'); } });
    child.on('error', (error) => { clearTimeout(timer); resolve(finish({ error })); });
    child.on('close', (exitCode) => { clearTimeout(timer); resolve(finish({ exitCode })); });
    function finish(extra = {}) {
      const redacted = redact(output.slice(0, maxBytes));
      const rec = { name: cmd.name, exitCode: extra.exitCode ?? (timedOut || overflow ? null : 1), timedOut, durationMs: Date.now() - started, outputBytes: Buffer.byteLength(output), sha256: createHash('sha256').update(redacted).digest('hex'), output: redacted, ...extra };
      if (rec.error) delete rec.error.stack;
      if (timedOut || overflow || (rec.exitCode !== 0 && rec.exitCode !== null)) {
        rec.failure = classifyFailure({ timedOut, overflow, maxBytes, timeoutMs, exitCode: rec.exitCode, error: extra.error, argv0: cmd.argv[0] });
      }
      return rec;
    }
  });
}
```

Notes the executor must preserve: `shell: false` always (no shell injection surface); `windowsHide: true`; transcript capped; `classifyFailure` receives `timeoutMs`/`maxBytes` matching the Task 1 signature.

Enforced in this plan vs deferred (state this in the docs, Task 4): enforced = policy gate before spawn, cwd jail, env scrub, per-command timeout, output cap, secret redaction, checksums, provenance, persistent logs. NOT enforced = CPU/memory/disk quotas, network namespace isolation, disposable containers — those need the Docker backend (future plan; no daemon on this host, verified `docker info` failing). The `local` backend is guarded, not isolated: run only curator-approved manifests for projects you have already reviewed.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/exec-runner.test.mjs`
Expected: PASS (5–10s: one 300ms timeout test dominates)

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/exec-runner.mjs tests/exec-runner.test.mjs
git commit -m "feat: add guarded command runner with dry and local backends"
```

### Task 3: CLI with manifest files and evidence output

**Files:**
- Create: `pipelines/execute.mjs`
- Create: `data/executions/smoke-registry-pipeline.yaml` (example manifest, committed)
- Test: extend `tests/exec-runner.test.mjs` with a CLI dry-run test below (no new test file; CLI is a thin wrapper)

**Interfaces:**
- Consumes: `runManifest` from Task 2, `readYaml` from `load.mjs`.
- Produces: `data/cache/executions/<id>-<yyyymmdd-hhmmss>.json` + `.log`, stdout evidence YAML, exit codes (0 passed/eligible, 1 failed, 2 blocked).

CLI flags: `--manifest <path>` (required, repo-relative or absolute-under-root), `--backend dry|local` (default `dry`), `--local-i-understand` (required to unlock `local`; without it, `local` degrades to `dry` with a warning — two-key safety: explicit backend plus explicit acknowledgement).

Behavior: load manifest YAML, `runManifest`, persist result JSON `{ provenance, policy, state, commands: <without raw output>, sha256 }` + full transcript to `.log`, print `--- evidence (paste into the curated record) ---` YAML suggesting `build_passed`/`tests_passed`/`smoke_passed` entries with the run timestamp, tool `de-agent-exec`, version, and `ref` pointing at the result file — but ONLY when state is `passed`, and labeled by which command the curator maps to which check (the CLI cannot know; it prints all three as commented suggestions the curator uncomments — never auto-assign).

Example manifest `data/executions/smoke-registry-pipeline.yaml` (exact):

```yaml
id: smoke-registry-pipeline
target: null
trust: curator-approved
workdir: .
commands:
  - name: pipeline-check
    argv: ['node', 'pipelines/run.mjs', '--check']
    timeout_ms: 120000
capabilities:
  network: off
  filesystem: workdir-only
limits:
  timeout_ms: 120000
  max_output_bytes: 200000
```

- [ ] **Step 1: Write the failing test**

```js
test('CLI dry-run exits 0 and writes nothing', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const before = Date.now();
  const { stdout } = await run('node', ['pipelines/execute.mjs', '--manifest', 'data/executions/smoke-registry-pipeline.yaml'], { cwd: ROOT });
  assert.ok(stdout.includes('eligible_for_execution'));
  assert.ok(stdout.includes('backend: dry'));
  assert.ok(Date.now() - before < 30000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/exec-runner.test.mjs`
Expected: FAIL with "Cannot find module" or CLI missing error

- [ ] **Step 3: Write minimal implementation** (read `load.mjs` `readYaml` + `ROOT` usage from `discover.mjs` first; follow that file's import style exactly)

```js
#!/usr/bin/env node
/**
 * EXECUTE — run a curator-approved manifest under the policy gate.
 * Default backend is dry (prints the plan, runs nothing). Local execution
 * needs BOTH --backend local AND --local-i-understand. Never runs during build.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { stringify } from 'yaml';
import { readYaml, ROOT } from './lib/load.mjs';
import { runManifest } from './lib/exec-runner.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? true);
};
const manifestArg = flag('manifest');
const backendArg = flag('backend') ?? 'dry';
const ack = args.includes('--local-i-understand');

if (!manifestArg) { console.error('usage: node pipelines/execute.mjs --manifest <file> [--backend dry|local] [--local-i-understand]'); process.exit(2); }
const manifestPath = resolve(ROOT, String(manifestArg));
if (relative(ROOT, manifestPath).startsWith('..')) { console.error('manifest must live under the repo root'); process.exit(2); }
const manifest = readYaml(manifestPath);
if (!manifest || typeof manifest !== 'object') { console.error('manifest is empty or invalid YAML'); process.exit(2); }

let backend = backendArg;
if (backend === 'local' && !ack) {
  console.log('warning: --backend local without --local-i-understand; degrading to dry (nothing executed)');
  backend = 'dry';
}
const out = await runManifest(manifest, { backend, root: ROOT });
console.log(`state: ${out.state}\nbackend: ${backend}`);
for (const c of out.commands) {
  console.log(`- ${c.name}: ${c.skipped ? 'skipped (dry)' : `exit ${c.exitCode} in ${c.durationMs}ms sha256 ${c.sha256}`}${c.failure ? ` [${c.failure.category}]` : ''}`);
}
if (out.state === 'blocked') {
  for (const r of out.policy.reasons) console.log(`  blocked: [${r.code}] ${r.detail}`);
}
if (out.spawned) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = join(ROOT, 'data', 'cache', 'executions');
  mkdirSync(dir, { recursive: true });
  const base = join(dir, `${manifest.id}-${stamp}`);
  const slim = out.commands.map(({ output, ...rest }) => rest);
  writeFileSync(`${base}.json`, JSON.stringify({ provenance: out.provenance, policy: out.policy, state: out.state, commands: slim }, null, 1) + '\n', 'utf8');
  writeFileSync(`${base}.log`, out.log, 'utf8');
  console.log(`result: ${base}.json`);
}
if (out.state === 'passed' && out.spawned) {
  console.log('--- evidence (paste into the curated record; uncomment the checks this run actually proves) ---');
  const entries = [
    { check: 'build_passed', status: 'passed', at: out.provenance.finished_at, by: 'human', tool: 'de-agent-exec', version: out.provenance.version, ref: 'RESULT_PATH', summary: 'COMMANDS ran under the policy gate; transcript checksummed.' },
  ];
  console.log(stringify(entries).split('\n').map((l) => `# ${l}`).join('\n'));
}
process.exit(out.state === 'passed' || out.state === 'eligible_for_execution' ? 0 : out.state === 'blocked' ? 2 : 1);
```

Replace `RESULT_PATH` with the actual `${base}.json` repo-relative path and `COMMANDS` with the executed command names before printing (exact string replacement in the implementation, not placeholders).

- [ ] **Step 4: Run verifications**

Run: `node pipelines/execute.mjs --manifest data/executions/smoke-registry-pipeline.yaml`
Expected: `state: eligible_for_execution`, `backend: dry`, exit 0, no files in `data/cache/executions/`

Run: `node --test "tests/**/*.test.mjs"`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add pipelines/execute.mjs data/executions/smoke-registry-pipeline.yaml tests/exec-runner.test.mjs
git commit -m "feat: add execute CLI with dry default and evidence output"
```

### Task 4: Live local smoke run + docs + final verify

**Files:**
- Modify: `src/pages/docs/verification.md` (append execution section — read the file first)
- Modify: `.gitignore` is already correct (`data/cache/` ignored — verify with `git check-ignore`)
- Test: full suite + build + a real `--backend local` smoke run of the example manifest.

**Interfaces:**
- Consumes: everything above.
- Produces: docs; no code.

- [ ] **Step 1: Run the real smoke test**

Run: `node pipelines/execute.mjs --manifest data/executions/smoke-registry-pipeline.yaml --backend local --local-i-understand`
Expected: `state: passed`, result JSON + redacted log in `data/cache/executions/`, exit 0. Confirm the log contains no secrets (`Select-String` for `TOKEN|KEY|SECRET` should match only the scrub note, if any) and `git status --short` shows no `data/cache` entries (ignored).

- [ ] **Step 2: Append the execution section to verification.md** covering: policy gate rules, the two-key local unlock, what gets recorded (checksums, provenance, redacted logs), the never-auto-assign rule for evidence (curator uncomments), passing ≠ production-ready, and that Docker isolation is future work. Plain language; no gatekeeping words.

- [ ] **Step 3: Final verify + commit**

Run: `node --test "tests/**/*.test.mjs"` (all PASS), `node pipelines/run.mjs --check` (green), `npm run build 2>&1 | Select-Object -Last 3` (340 pages)

```bash
git add src/pages/docs/verification.md docs/superpowers/plans/2026-10-10-safe-execution-engine.md
git commit -m "docs: execution engine policy and evidence workflow"
```

Plus a `chore: refresh generated artifacts` commit if the build dirtied generated JSON, keeping the tree clean.
