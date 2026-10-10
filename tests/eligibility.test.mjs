import test from 'node:test';
import assert from 'node:assert/strict';
import { pageEligibility, isRoutable } from '../pipelines/lib/eligibility.mjs';

const base = (over = {}) => ({
  id: 'x', verification: 'reviewed', description: 'd '.repeat(300), stale: false,
  depth: { level: 'adequate', score: 60 }, evidence_summary: { earned: 'reviewed', claimed: 'reviewed', gap: 0 }, ...over,
});

test('adequate + aligned evidence is eligible', () => {
  assert.equal(pageEligibility(base()).state, 'eligible');
});

test('over-claim needs review, stays routable', () => {
  const gap = { earned: 'community', claimed: 'reviewed', gap: 1 };
  assert.equal(pageEligibility(base({ evidence_summary: gap })).state, 'needs_review');
  assert.equal(isRoutable(base({ evidence_summary: gap })), true);
});

test('thin community record is internal only', () => {
  const out = pageEligibility(base({ verification: 'community', description: 'short', depth: { level: 'thin', score: 20 }, evidence_summary: { earned: 'community', claimed: 'community', gap: 0 } }));
  assert.equal(out.state, 'internal_only');
});

test('curator retired wins over everything', () => {
  assert.equal(pageEligibility(base({ retired: true })).state, 'retired');
  assert.equal(isRoutable(base({ retired: true })), false);
});

test('curator override is honored and labeled', () => {
  const out = pageEligibility(base({ publish: 'eligible' }));
  assert.equal(out.state, 'eligible');
  assert.ok(out.reasons.includes('curator override'));
});
