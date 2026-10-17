import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  stateFromParams,
  paramsFromState,
  activeCount,
  chipList,
  withoutChip,
  DEFAULT_SORT,
} from '../src/lib/filter-state.mjs';

// Marketplace URL sync contract (audit P1-3): filter state survives reload
// via URL params and back/forward restores prior state.

describe('filter-state', () => {
  it('parses multi-value params and ignores unknown keys', () => {
    const p = new URLSearchParams('type=skill,mcp&category=sql&bogus=x');
    const s = stateFromParams(p);
    assert.deepEqual(s, { type: ['skill', 'mcp'], category: ['sql'] });
  });

  it('round-trips state -> params -> state', () => {
    const state = { type: ['skill'], verification: ['community', 'reviewed'], stage: ['python-sql'] };
    const params = paramsFromState(state, 'rating-desc');
    assert.equal(params.get('type'), 'skill');
    assert.equal(params.get('verification'), 'community,reviewed');
    assert.equal(params.get('sort'), 'rating-desc');
    assert.deepEqual(stateFromParams(params), state);
  });

  it('omits default sort from the URL', () => {
    const params = paramsFromState({ type: ['skill'] });
    assert.equal(params.has('sort'), false);
    assert.equal(paramsFromState({}, DEFAULT_SORT).toString(), '');
  });

  it('counts active values and lists chips in stable key order', () => {
    const state = { verification: ['community'], type: ['skill', 'mcp'] };
    assert.equal(activeCount(state), 3);
    const chips = chipList(state);
    // key order follows FILTER_KEYS, not insertion order
    assert.deepEqual(chips, [
      { key: 'type', value: 'skill' },
      { key: 'type', value: 'mcp' },
      { key: 'verification', value: 'community' },
    ]);
  });

  it('removes a chip and drops emptied keys', () => {
    const state = { type: ['skill', 'mcp'], category: ['sql'] };
    const next = withoutChip(state, 'type', 'skill');
    assert.deepEqual(next, { type: ['mcp'], category: ['sql'] });
    assert.deepEqual(withoutChip(next, 'type', 'mcp'), { category: ['sql'] });
    // never mutates the input
    assert.deepEqual(state.type, ['skill', 'mcp']);
  });
});
