import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatScore, scoreBand } from '../src/lib/format.ts';

// Score meter contract (Task 6): display formatting mirrors the canonical
// banding in pipelines/lib/marketplace-score.mjs (80/65/45/25).

describe('formatScore', () => {
  it('rounds to an integer string', () => {
    assert.equal(formatScore(57.14), '57');
    assert.equal(formatScore(80.5), '81');
    assert.equal(formatScore(0), '0');
  });

  it('renders an em dash for missing scores', () => {
    assert.equal(formatScore(null), '—');
    assert.equal(formatScore(undefined), '—');
    assert.equal(formatScore(Number.NaN), '—');
  });
});

describe('scoreBand', () => {
  it('matches canonical pipeline thresholds', () => {
    assert.equal(scoreBand(91.2).label, 'exemplary');
    assert.equal(scoreBand(80).label, 'exemplary');
    assert.equal(scoreBand(79.9).label, 'strong');
    assert.equal(scoreBand(65).label, 'strong');
    assert.equal(scoreBand(64.9).label, 'adequate');
    assert.equal(scoreBand(45.14).label, 'adequate');
    assert.equal(scoreBand(44.86).label, 'weak');
    assert.equal(scoreBand(25).label, 'weak');
    assert.equal(scoreBand(24.9).label, 'unproven');
    assert.equal(scoreBand(0).label, 'unproven');
  });

  it('tones match severity', () => {
    assert.equal(scoreBand(85).tone, 'accent');
    assert.equal(scoreBand(70).tone, 'info');
    assert.equal(scoreBand(50).tone, 'warn');
    assert.equal(scoreBand(30).tone, 'danger');
    assert.equal(scoreBand(10).tone, 'dim');
  });

  it('clamps pct to 0–100 and handles missing scores', () => {
    assert.equal(scoreBand(57.14).pct, 57);
    assert.equal(scoreBand(140).pct, 100);
    assert.equal(scoreBand(-5).pct, 0);
    assert.equal(scoreBand(null).pct, 0);
    assert.equal(scoreBand(null).label, 'unproven');
  });
});
