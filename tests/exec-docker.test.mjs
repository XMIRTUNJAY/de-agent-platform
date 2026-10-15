import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDockerArgs, dockerAvailable, imagePresent } from '../pipelines/lib/exec-docker.mjs';

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
  // No conditional-skip in node:test: early return keeps the suite green where
  // no daemon runs. Same when the pinned image is absent: the engine never
  // pulls (see exec-docker.mjs header), so a live run is impossible.
  if (!(await dockerAvailable())) return;
  if (!(await imagePresent('redis:7-alpine'))) return;
  const { runManifest } = await import('../pipelines/lib/exec-runner.mjs');
  const out = await runManifest(manifest(), { backend: 'docker', root: process.cwd() });
  assert.equal(out.state, 'passed');
  assert.ok(out.log.includes('hi'));
});
