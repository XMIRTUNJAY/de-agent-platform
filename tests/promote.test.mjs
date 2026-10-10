import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPromotion } from '../pipelines/promote.mjs';

const ctx = () => ({ ids: new Set(['taken']), slugs: new Set(['taken']), catIds: new Set(['cat-sql']), licenseIds: new Set(['MIT']) });
const draft = (over = {}) => ({
  id: 'new-thing', slug: 'new-thing', type: 'skill', title: 'T', description: 'd '.repeat(150),
  category: 'cat-sql', license: 'MIT', verification: 'community', version: '1.0.0', last_verified: '2026-10-01', ...over,
});

test('clean community draft passes', () => {
  const out = checkPromotion(draft(), ctx());
  assert.equal(out.ok, true);
  assert.equal(out.errors.length, 0);
});

test('duplicate id is blocked', () => {
  const out = checkPromotion(draft({ id: 'taken' }), ctx());
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => e.code === 'duplicate-id'));
});

test('thin description is blocked with the floor named', () => {
  const out = checkPromotion(draft({ description: 'short' }), ctx());
  assert.ok(out.errors.some((e) => e.code === 'too-thin' && e.detail.includes('200')));
});

test('reviewed claim without evidence is blocked', () => {
  const out = checkPromotion(draft({ verification: 'reviewed' }), ctx());
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => e.code === 'missing-evidence'));
});
