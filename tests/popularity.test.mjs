import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePopularity, POPULARITY_WEIGHTS } from '../pipelines/lib/popularity.mjs';

describe('popularity', () => {
  it('weights sum to 1', () => {
    const total = Object.values(POPULARITY_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
  });

  it('unrated resource ranks on GitHub signal, not neutral', () => {
    assert.equal(computePopularity({ community: 60 }), computePopularity({
      community: 60, ratingAvg: 5, ratingCount: 0,
    }));
    assert.equal(computePopularity({ community: 60 }), 60 * 0.5 + 60 * 0.3);
  });

  it('a single 5-star vote moves an unknown resource up', () => {
    const base = computePopularity({ community: 10 });
    const voted = computePopularity({ community: 10, ratingAvg: 5, ratingCount: 1 });
    assert.ok(voted > base);
  });

  it('monotonic in each input: rating, github, engagement', () => {
    const base = { community: 40, ratingAvg: 3, ratingCount: 12, installs: 20 };
    const p0 = computePopularity(base);
    assert.ok(computePopularity({ ...base, ratingAvg: 5 }) > p0);
    assert.ok(computePopularity({ ...base, community: 80 }) > p0);
    assert.ok(computePopularity({ ...base, installs: 200 }) > p0);
  });

  it('engagement follows a log scale and caps at 100 slice', () => {
    const a = computePopularity({ community: 0, installs: 9 });
    const b = computePopularity({ community: 0, installs: 99 });
    const c = computePopularity({ community: 0, installs: 99999 });
    assert.ok(b > a);
    assert.ok(c <= 100);
  });

  it('empty input scores zero, never NaN', () => {
    assert.equal(computePopularity(), 0);
    assert.equal(computePopularity({}), 0);
  });
});
