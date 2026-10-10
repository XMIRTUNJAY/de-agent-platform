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
  const reasons = out.groups.map((g) => g.reason).sort();
  assert.deepEqual(reasons, ['same-fingerprint', 'same-url']);
  for (const g of out.groups) assert.deepEqual(g.ids, ['a', 'b']);
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

test('duplicates.json payload shape', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const p = new URL('../src/data/generated/duplicates.json', import.meta.url);
  assert.ok(existsSync(p), 'duplicates.json must exist after a pipeline run');
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  assert.ok(Array.isArray(doc.groups), 'groups must be an array');
  assert.equal(typeof doc.checked, 'number');
});
