import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFreshness } from '../pipelines/lib/freshness.mjs';

test('upstream push after verification flags change', () => {
  const out = evaluateFreshness({ last_verified: '2026-09-01', stale: false, publisher_source: { checked_at: '2026-10-10', pushed_at: '2026-10-05', archived: false } });
  assert.equal(out.upstream_changed, true);
  assert.equal(out.archived, false);
});

test('missing provenance is unknown, not changed', () => {
  const out = evaluateFreshness({ last_verified: '2026-09-01', stale: false, publisher_source: null });
  assert.equal(out.upstream_changed, false);
  assert.equal(out.unreachable, false);
});

test('unreachable upstream is recorded', () => {
  const out = evaluateFreshness({ last_verified: null, stale: true, publisher_source: { checked_at: '2026-10-10', unreachable: true } });
  assert.equal(out.unreachable, true);
  assert.equal(out.stale, true);
});
