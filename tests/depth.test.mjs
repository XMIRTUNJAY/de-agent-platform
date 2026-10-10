import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreDepth } from '../pipelines/lib/depth.mjs';

const rich = (over = {}) => ({
  id: 'x', type: 'skill', title: 'T', description: 'd '.repeat(300),
  category: 'cat-sql', license: 'MIT', verification: 'reviewed', last_verified: '2026-10-01',
  version: '1.0.0', tags: ['a', 'b'], learning_objectives: ['o'],
  install_command: 'npm i x', tests: ['t1'], ...over,
});

test('full record scores deep', () => {
  const out = scoreDepth(rich());
  assert.equal(out.level, 'deep');
  assert.ok(out.score >= 75);
});

test('one-line description scores thin', () => {
  const out = scoreDepth(rich({ description: 'does stuff', tags: [], learning_objectives: [], install_command: null, tests: [] }));
  assert.equal(out.level, 'thin');
  assert.ok(out.score < 50);
});

test('reference without install is judged fairly', () => {
  const out = scoreDepth({ id: 'r', type: 'reference', title: 'Docs', description: 'd '.repeat(300), category: 'cat-sql', url: 'https://x.io/', publisher: 'X', license: 'Proprietary', tags: ['docs'] });
  assert.ok(['adequate', 'deep'].includes(out.level));
});
