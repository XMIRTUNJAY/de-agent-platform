import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryStateFromParams,
  categoryParamsFromState,
  filterCategories,
  SORTS,
} from '../src/lib/category-filters.mjs';

// /categories URL contract: ?q=<text>&phase=<1-4>&sort=<roadmap|alpha|resources>
// Full catalogue stays server-rendered; the client only narrows visibility.

const CATS = [
  { id: 'c-sql', slug: 'sql', title: 'SQL', summary: 'Query and model relational data.', stage: 'python-sql', group: 'Core', order: 2 },
  { id: 'c-lake', slug: 'lakehouse', title: 'Lakehouse', summary: 'Table formats and open lakehouses.', stage: 'lakehouse', group: 'Platforms', order: 5 },
  { id: 'c-qual', slug: 'data-quality', title: 'Data Quality', summary: 'Tests, expectations, and quality gates.', stage: 'data-quality', group: 'Trust', order: 9 },
  { id: 'c-agentic', slug: 'agentic', title: 'Agentic', summary: 'Agents as data workers.', stage: 'agentic', group: 'Advanced', order: 13 },
];
const COUNTS = { 'c-sql': 8, 'c-lake': 3, 'c-qual': 5, 'c-agentic': 2 };
// phase index per stage id, mirroring src/lib/phases.ts
const PHASE_OF = { 'python-sql': 1, lakehouse: 2, 'data-quality': 3, agentic: 4 };

describe('categoryStateFromParams', () => {
  it('parses q, phase, sort and ignores unknown params', () => {
    const s = categoryStateFromParams(new URLSearchParams('q=sql&phase=2&sort=alpha&bogus=1'));
    assert.deepEqual(s, { q: 'sql', phase: 2, sort: 'alpha' });
  });

  it('rejects out-of-range phase and unknown sort', () => {
    assert.deepEqual(categoryStateFromParams(new URLSearchParams('phase=9')), {});
    assert.deepEqual(categoryStateFromParams(new URLSearchParams('sort=random')), {});
    assert.deepEqual(categoryStateFromParams(new URLSearchParams('phase=abc')), {});
  });
});

describe('categoryParamsFromState', () => {
  it('round-trips and omits defaults', () => {
    const state = { q: 'lake', phase: 2, sort: 'resources' };
    const params = categoryParamsFromState(state);
    assert.deepEqual(Object.fromEntries(params), { q: 'lake', phase: '2', sort: 'resources' });
    assert.deepEqual(categoryStateFromParams(params), state);
  });

  it('empty state serializes to an empty string', () => {
    assert.equal(categoryParamsFromState({}).toString(), '');
  });
});

describe('filterCategories', () => {
  it('filters by q across title and summary (case-insensitive)', () => {
    const out = filterCategories(CATS, { q: 'LAKEHOUSE' }, COUNTS, PHASE_OF);
    assert.deepEqual(out.map((c) => c.id), ['c-lake']);
  });

  it('matches q against stage title context too', () => {
    const out = filterCategories(CATS, { q: 'quality' }, COUNTS, PHASE_OF);
    assert.deepEqual(out.map((c) => c.id), ['c-qual']);
  });

  it('filters by phase index', () => {
    const out = filterCategories(CATS, { phase: 4 }, COUNTS, PHASE_OF);
    assert.deepEqual(out.map((c) => c.id), ['c-agentic']);
  });

  it('combines q and phase', () => {
    assert.deepEqual(filterCategories(CATS, { q: 'sql', phase: 1 }, COUNTS, PHASE_OF).map((c) => c.id), ['c-sql']);
    assert.deepEqual(filterCategories(CATS, { q: 'sql', phase: 4 }, COUNTS, PHASE_OF), []);
  });

  it('sorts deterministically: roadmap (default), alpha, resources', () => {
    assert.deepEqual(filterCategories(CATS, {}, COUNTS, PHASE_OF).map((c) => c.id), ['c-sql', 'c-lake', 'c-qual', 'c-agentic']);
    assert.deepEqual(filterCategories(CATS, { sort: 'alpha' }, COUNTS, PHASE_OF).map((c) => c.id), ['c-agentic', 'c-qual', 'c-lake', 'c-sql']);
    assert.deepEqual(filterCategories(CATS, { sort: 'resources' }, COUNTS, PHASE_OF).map((c) => c.id), ['c-sql', 'c-qual', 'c-lake', 'c-agentic']);
  });

  it('never mutates the input array', () => {
    const snapshot = JSON.stringify(CATS);
    filterCategories(CATS, { sort: 'alpha' }, COUNTS, PHASE_OF);
    assert.equal(JSON.stringify(CATS), snapshot);
  });

  it('exposes the canonical sort list', () => {
    assert.deepEqual([...SORTS], ['roadmap', 'alpha', 'resources']);
  });
});
