import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('ci workflow gates check, tests, and build', () => {
  const p = new URL('../.github/workflows/ci.yml', import.meta.url);
  assert.ok(existsSync(p), 'ci.yml must exist');
  const yml = readFileSync(p, 'utf8');
  for (const cmd of ['pipelines/run.mjs --check', 'npm test', 'npm run build']) {
    assert.ok(yml.includes(cmd), `ci must run ${cmd}`);
  }
});
