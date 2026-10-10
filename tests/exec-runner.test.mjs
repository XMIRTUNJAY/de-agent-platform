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
