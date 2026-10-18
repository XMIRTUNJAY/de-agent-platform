// Pure filter-state helpers for the /categories catalogue.
// URL contract: ?q=<text>&phase=<1-4>&sort=<roadmap|alpha|resources>
// The full catalogue is server-rendered; the client script narrows visibility
// using these same helpers (Vite bundles them) and node tests exercise them.

export const SORTS = ['roadmap', 'alpha', 'resources'];
export const DEFAULT_SORT = 'roadmap';

/** URLSearchParams -> { q?, phase?, sort? } (unknown/invalid values dropped) */
export function categoryStateFromParams(searchParams) {
  const state = {};
  const q = (searchParams.get('q') ?? '').trim();
  if (q) state.q = q;
  const phaseRaw = searchParams.get('phase');
  if (phaseRaw !== null && /^[1-4]$/.test(phaseRaw)) state.phase = Number.parseInt(phaseRaw, 10);
  const sort = searchParams.get('sort');
  if (sort && SORTS.includes(sort)) state.sort = sort;
  return state;
}

/** state -> URLSearchParams (omits defaults) */
export function categoryParamsFromState(state) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.phase) params.set('phase', String(state.phase));
  if (state.sort && state.sort !== DEFAULT_SORT) params.set('sort', state.sort);
  return params;
}

/**
 * Filter + sort categories. phaseOf maps category.stage -> phase index (1-4).
 * Returns a new array; never mutates the input.
 */
export function filterCategories(categories, state, counts, phaseOf) {
  const q = (state.q ?? '').toLowerCase();
  let out = categories.filter((cat) => {
    if (state.phase && phaseOf[cat.stage] !== state.phase) return false;
    if (!q) return true;
    return (
      cat.title.toLowerCase().includes(q) ||
      (cat.summary ?? '').toLowerCase().includes(q) ||
      (cat.group ?? '').toLowerCase().includes(q) ||
      String(cat.stage ?? '').toLowerCase().includes(q)
    );
  });
  const byCount = (cat) => counts[cat.id] ?? 0;
  const sorted = [...out];
  switch (state.sort) {
    case 'alpha': sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'resources': sorted.sort((a, b) => byCount(b) - byCount(a) || a.order - b.order); break;
    default: sorted.sort((a, b) => a.order - b.order);
  }
  return sorted;
}
