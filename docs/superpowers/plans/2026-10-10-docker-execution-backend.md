# Docker Execution Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run curator manifests inside disposable Linux containers with no network, capped memory/CPU/PIDs, read-only filesystems, and the same redaction, checksums, and evidence output as the local backend.

**Architecture:** New `pipelines/lib/exec-docker.mjs` (pure `buildDockerArgs` + `dockerAvailable` probe + `runDockerCommand` over the local Docker CLI) plugged into `exec-runner.mjs` as a third backend; policy gains `runtime`/`image` rules with pinned-tag enforcement and a present-locally requirement (never pull implicitly). Tests use the already-present `redis:7-alpine` image; nothing is pulled.

**Tech Stack:** Node 22 stdlib (`child_process`, `crypto`, `fs`, `path`), Docker Engine 20.10 (Linux containers), `node:test` with runtime-gated live tests.

**Spec:** Phase 6 remainder — disposable isolated environments, network disabled, resource limits, no privileged containers or host socket access, cleanup after success and failure, persistent logs, machine-readable summaries. Out of scope: allowlisted-network runs, image builds, registry pushes, the benchmark suite.

## Global Constraints

- Preserve Astro 5 + Tailwind 4 architecture; no framework change.
- Preserve existing registry contract; results go to gitignored `data/cache/executions/` only.
- `npm run build` stays offline/deterministic; the engine never runs during build.
- Fail-closed: unpinned/missing images, network requests, and mount escapes block before anything spawns. Never pull implicitly.
- Never invent licenses, stars, test results, or verification.

---

### Task 1: Policy rules for container runs

**Files:**
- Modify: `pipelines/lib/exec-policy.mjs`
- Test: append to `tests/exec-policy.test.mjs` (it already statically imports `evaluatePolicy` — reuse that import, add no new ones)

**Interfaces:**
- Consumes: nothing new.
- Produces: extended `evaluatePolicy` handling `capabilities.runtime` + `image` (used by Task 2).

Rules: `capabilities.runtime` absent means `local` (backward compatible — all existing manifests keep working). When `runtime: 'docker'`: `image` is required, must contain a `:` tag, and must not end in `:latest` (code `unpinned-image`); `capabilities.network` must still be `off` (any allowlist → `network-not-supported`, unchanged); `mounts` (optional list of `{ host, container, readonly: true }`) — every `host` must be repo-relative without `..` (else `path-escape`), every `container` must be an absolute path (else `malformed-mount`), `readonly: false` is rejected (code `writable-mount`, only read-only mounts exist in this plan).

- [ ] **Step 1: Write the failing test**

```js
test('docker runtime needs a pinned image', () => {
  const m = { id: 'd', trust: 'curator-approved', workdir: '.', commands: [{ name: 'e', argv: ['echo', 'hi'] }], capabilities: { network: 'off', filesystem: 'workdir-only', runtime: 'docker' }, limits: {} };
  const noImage = evaluatePolicy(m);
  assert.equal(noImage.eligible, false);
  assert.ok(noImage.reasons.some((r) => r.code === 'unpinned-image'));
  const latest = evaluatePolicy({ ...m, image: 'redis:latest' });
  assert.ok(latest.reasons.some((r) => r.code === 'unpinned-image'));
  const pinned = evaluatePolicy({ ...m, image: 'redis:7-alpine' });
  assert.ok(!pinned.reasons.some((r) => r.code === 'unpinned-image'));
});

test('writable mounts and host escapes are blocked', () => {
  const m = { id: 'd', trust: 'curator-approved', workdir: '.', image: 'redis:7-alpine', commands: [{ name: 'e', argv: ['echo', 'hi'] }], capabilities: { network: 'off', filesystem: 'workdir-only', runtime: 'docker' }, limits: {} };
  const w = evaluatePolicy({ ...m, mounts: [{ host: '.', container: '/work', readonly: false }] });
  assert.ok(w.reasons.some((r) => r.code === 'writable-mount'));
  const e = evaluatePolicy({ ...m, mounts: [{ host: '../outside', container: '/work', readonly: true }] });
  assert.ok(e.reasons.some((r) => r.code === 'path-escape'));
  const ok = evaluatePolicy({ ...m, mounts: [{ host: 'data', container: '/work', readonly: true }] });
  assert.equal(ok.eligible, true);
});
```

Append both tests to `tests/exec-policy.test.mjs` using its existing static `evaluatePolicy` import.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/exec-policy.test.mjs`
Expected: FAIL — `runtime`/`image`/`mounts` ignored, `unpinned-image` never emitted

- [ ] **Step 3: Write minimal implementation**

In `evaluatePolicy`, after the filesystem check add:

```js
const runtime = manifest.capabilities?.runtime ?? 'local';
if (!['local', 'docker'].includes(runtime)) block('unsupported-runtime', 'runtime must be local or docker');
if (runtime === 'docker') {
  const image = manifest.image ?? '';
  if (!image.includes(':') || image.endsWith(':latest')) block('unpinned-image', `image ${JSON.stringify(image)} must be pinned name:tag, never latest`);
  for (const mt of manifest.mounts ?? []) {
    if (!mt || typeof mt !== 'object' || !mt.host || !mt.container) { block('malformed-mount', 'mounts need { host, container, readonly }'); continue; }
    if (isAbsolute(mt.host) || String(mt.host).split(/[\\/]/).includes('..')) block('path-escape', `mount host ${JSON.stringify(mt.host)} must be repo-relative without ..`);
    if (!String(mt.container).startsWith('/')) block('malformed-mount', `mount container ${JSON.stringify(mt.container)} must be absolute`);
    if (mt.readonly === false) block('writable-mount', 'only read-only mounts are supported');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/exec-policy.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/exec-policy.mjs tests/exec-policy.test.mjs
git commit -m "feat: add container policy rules for pinned images and read-only mounts"
```

### Task 2: Docker backend module + runner wiring

**Files:**
- Create: `pipelines/lib/exec-docker.mjs`
- Modify: `pipelines/lib/exec-runner.mjs` (accept `docker` backend, delegate per-command runs)
- Test: `tests/exec-docker.test.mjs`

**Interfaces:**
- Consumes: `evaluatePolicy` (policy), `redact`/`scrubEnv` (reuse from `exec-runner.mjs` — move nothing; import them).
- Produces: `dockerAvailable()`, `buildDockerArgs(cmd, { manifest, root, image })`, `runDockerCommand(...)` used by the runner; runner returns identical result shapes for all backends.

`buildDockerArgs` (pure, the unit under test) returns the exact argv for `docker run`:

```
docker run --rm -i
  --network none
  --memory 512m --memory-swap 512m --cpus 1.0 --pids-limit 64
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m
  --user 65534:65534
  --workdir /work
  --env NODE_ENV=production
  -v <root/data:/work/data:ro>            (per declared mount)
  <image>
  <cmd.argv...>
```

Memory/CPU from `manifest.limits.docker ?? { memory: '512m', cpus: '1.0', pids: 64 }`. `--user 65534:65534` (nobody) — never root. No `--privileged`, no socket mount, no `--net` other than `none`: these flags must not appear in the builder output (assert in tests). Workdir inside the container is `/work`; declared mounts map under it. Env: only `NODE_ENV=production` plus manifest `env` entries whose names pass the same secret filter (drop `TOKEN|KEY|SECRET|…`, never forward host secrets).

`dockerAvailable()`: runs `docker info` with a 10s timeout, returns boolean, never throws. `runDockerCommand`: `docker image inspect <image>` first (missing → `{ category: 'missing-executable', detail: 'image not present locally; pull it explicitly' }`, never pulls); then spawns `docker run` reusing the local backend's timeout/output-cap/redact/sha256 logic — implement by extracting that logic minimally: the runner's `runOne` stays local-only; docker module implements its own spawn loop with the same shape (duplicate ~40 lines deliberately: container stdio needs `-i` attach semantics and different kill handling; share `redact` and `classifyFailure` via import, nothing else).

Runner change: in `runManifest`, replace the `backend !== 'local'` throw with delegation:

```js
if (backend !== 'local' && backend !== 'docker') throw new Error(`unknown backend: ${backend} (supported: dry, local, docker)`);
```

and after the workdir jail check, branch: `if (backend === 'docker') return runDockerManifest(manifest, { root, env, limits: manifest.limits ?? {}, policy, provenance });` — implement `runDockerManifest` inside `exec-docker.mjs` (it imports `runDockerCommand`), keeping `exec-runner.mjs` free of docker specifics. `runDockerManifest` returns the same shape (`state`, `spawned: true`, `policy`, `commands`, `log`, `resultPath: null`, `provenance` + `finished_at`).

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDockerArgs, dockerAvailable } from '../pipelines/lib/exec-docker.mjs';

const manifest = () => ({
  id: 'd', trust: 'curator-approved', workdir: '.', image: 'redis:7-alpine',
  commands: [{ name: 'e', argv: ['echo', 'hi'] }],
  capabilities: { network: 'off', filesystem: 'workdir-only', runtime: 'docker' },
  limits: { timeout_ms: 30000, max_output_bytes: 50000 },
  mounts: [{ host: 'data', container: '/work/data', readonly: true }],
});

test('builder hardens every flag', () => {
  const argv = buildDockerArgs({ name: 'e', argv: ['echo', 'hi'] }, { manifest: manifest(), root: 'C:\\repo', runId: 'test-1' });
  const s = argv.join(' ');
  for (const f of ['--network none', '--read-only', '--pids-limit 64', '--user 65534:65534', '--name de-agent-exec-test-1', 'redis:7-alpine']) {
    assert.ok(s.includes(f), `missing ${f}`);
  }
  for (const f of ['--privileged', 'docker.sock', '--net host', '--network host', ':latest']) {
    assert.ok(!s.includes(f), `forbidden ${f} present`);
  }
});

test('live container echoes and cleans up', async () => {
  // No conditional-skip in node:test: early return keeps the suite green where no daemon runs.
  if (!(await dockerAvailable())) return;
  const { runManifest } = await import('../pipelines/lib/exec-runner.mjs');
  const out = await runManifest(manifest(), { backend: 'docker', root: process.cwd() });
  assert.equal(out.state, 'passed');
  assert.ok(out.log.includes('hi'));
});
```

Gating note: `node:test` has no conditional-skip expression — the early `return` when the daemon is down keeps the suite green on machines without Docker. Document that in the test comment.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/exec-docker.test.mjs`
Expected: FAIL with "Cannot find module ... exec-docker.mjs"

- [ ] **Step 3: Write minimal implementation** (per the contract above; reuse `redact`, `classifyFailure` by import; duplicate the spawn loop with `-i` attach)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/exec-docker.test.mjs`
Expected: PASS (live test runs a real `redis:7-alpine` echo; also run `docker ps -a --filter name=de-agent-exec` after to prove `--rm` cleaned up)

- [ ] **Step 5: Commit**

```bash
git add pipelines/lib/exec-docker.mjs pipelines/lib/exec-runner.mjs tests/exec-docker.test.mjs
git commit -m "feat: add docker backend with no-network disposable containers"
```

### Task 3: CLI unlock + live policy demo + docs

**Files:**
- Modify: `pipelines/execute.mjs` (accept `--backend docker`; two-key rule unchanged: needs `--local-i-understand` too — rename nothing, the flag means "I understand this executes code")
- Create: `data/executions/docker-echo-smoke.yaml` (example manifest, committed)
- Modify: `src/pages/docs/verification.md` (execution section: docker backend rules)
- Test: full suite + live CLI run.

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: user-facing backend; docs.

Example manifest (exact):

```yaml
id: docker-echo-smoke
target: null
trust: curator-approved
workdir: .
image: redis:7-alpine
commands:
  - name: echo-inside-container
    argv: ['echo', 'hello-from-container']
    timeout_ms: 30000
capabilities:
  network: 'off'
  filesystem: workdir-only
  runtime: docker
limits:
  timeout_ms: 30000
  max_output_bytes: 50000
```

CLI change: `backendArg` validation `['dry', 'local']` → `['dry', 'local', 'docker']` (find the exact line; today any string passes through to `runManifest` which threw — now it delegates). Keep the `--local-i-understand` degradation for `docker` exactly as for `local`. Update the usage string to list docker.

- [ ] **Step 1: Run the live CLI smoke test**

Run: `node pipelines/execute.mjs --manifest data/executions/docker-echo-smoke.yaml --backend docker --local-i-understand`
Expected: `state: passed`, log contains `hello-from-container`, result JSON in `data/cache/executions/` (ignored), exit 0.

Run: `docker ps -a --filter "name=de-agent" --format "{{.Names}}"`
Expected: empty (containers `--rm` themselves; name runs with `--name de-agent-exec-<pid>` — set `--name` in the builder so leftovers are identifiable; verify none remain)

- [ ] **Step 2: Docs + lint check**

Append/adjust the execution section in `verification.md`: docker backend rules (pinned image, present-locally, `--network none`, read-only FS, nobody user, CPU/memory/PID caps, no pulls), enforced-vs-deferred list updated (network isolation and disposable envs now enforced for docker; CPU/memory/disk quotas enforced via flags). Plain language; grep gatekeeping words clean.

- [ ] **Step 3: Final verify + commit**

Run: `node --test "tests/**/*.test.mjs"` (all PASS), `node pipelines/run.mjs --check` (green), `npm run build 2>&1 | Select-Object -Last 3` (340 pages)

```bash
git add pipelines/execute.mjs data/executions/docker-echo-smoke.yaml src/pages/docs/verification.md docs/superpowers/plans/2026-10-10-docker-execution-backend.md
git commit -m "feat: unlock docker backend in CLI with docs and example"
```

Plus a `chore: refresh generated artifacts` commit if the build dirtied generated JSON, keeping the tree clean.
