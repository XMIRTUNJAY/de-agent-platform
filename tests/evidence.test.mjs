import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, evaluateEvidence } from '../pipelines/lib/evidence.mjs';

const ev = (check, status = 'passed') => ({ check, status, at: '2026-10-01', by: 'human', tool: 'hands', version: '1' });

test('ten checks in the vocabulary', () => {
  assert.equal(CHECKS.length, 10);
  assert.ok(CHECKS.includes('output_validated'));
});

test('full reviewed evidence earns reviewed', () => {
  const r = { id: 'x', verification: 'reviewed', evidence: [ev('metadata_validated'), ev('license_reviewed'), ev('source_reachable')] };
  const out = evaluateEvidence(r);
  assert.equal(out.earned, 'reviewed');
  assert.equal(out.gap, 0);
});

test('claimed reviewed with no evidence earns community and flags over-claim', () => {
  const r = { id: 'x', verification: 'reviewed', evidence: [] };
  const out = evaluateEvidence(r);
  assert.equal(out.earned, 'community');
  assert.equal(out.gap, 1);
});

test('failed check blocks its level', () => {
  const r = { id: 'x', verification: 'tested', evidence: [ev('metadata_validated'), ev('license_reviewed'), ev('source_reachable'), ev('build_passed'), { ...ev('tests_passed'), status: 'failed' }] };
  const out = evaluateEvidence(r);
  assert.equal(out.earned, 'reviewed');
  assert.equal(out.checks.tests_passed.status, 'failed');
});
