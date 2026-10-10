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
