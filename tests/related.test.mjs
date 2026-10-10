import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedFor } from '../pipelines/lib/related.mjs';

const r = (over = {}) => ({ id: 'a', title: 'A', type: 'skill', category: 'cat-sql', technologies: ['tech-spark'], stage: 's1', url: '/skills/a', ...over });

test('ranks shared category above shared stage', () => {
  const me = r();
  const pool = [me, r({ id: 'b', title: 'B', url: '/x/b', type: 'mcp', category: 'cat-other', technologies: [], stage: 's1' }), r({ id: 'c', title: 'C', url: '/x/c', category: 'cat-sql', technologies: [], stage: 'other' })];
  const out = relatedFor(me, pool, 5);
  assert.deepEqual(out.map((x) => x.id), ['c', 'b']);
});

test('excludes self and retired records', () => {
  const me = r();
  const pool = [me, r({ id: 'b', title: 'B', url: '/x/b' }), r({ id: 'z', title: 'Z', url: '/x/z', retired: true })];
  const out = relatedFor(me, pool, 5);
  assert.deepEqual(out.map((x) => x.id), ['b']);
});
