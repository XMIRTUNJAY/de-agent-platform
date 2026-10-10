import test from 'node:test';
import assert from 'node:assert/strict';
import { repoTargets, entryFor } from '../pipelines/lib/github-meta.mjs';

const apiRepo = { full_name: 'awslabs/mcp', pushed_at: '2026-10-01T00:00:00Z', archived: false, default_branch: 'main' };

test('groups records by upstream repo', () => {
  const out = repoTargets([
    { id: 'a', github_url: 'https://github.com/awslabs/mcp' },
    { id: 'b', github_url: 'https://github.com/awslabs/mcp/tree/main/x' },
    { id: 'c', github_url: null },
    { id: 'd', github_url: 'https://spark.apache.org/' },
  ]);
  assert.deepEqual(Object.keys(out), ['awslabs/mcp']);
  assert.deepEqual(out['awslabs/mcp'].sort(), ['a', 'b']);
});

test('builds an entry without stars, ever', () => {
  const out = entryFor('awslabs/mcp', apiRepo, '2026-10-10T00:00:00.000Z');
  assert.equal(out.pushed_at, '2026-10-01T00:00:00Z');
  assert.equal(out.archived, false);
  assert.equal(out.stars, null);
  assert.ok(!('stargazers_count' in out));
});
