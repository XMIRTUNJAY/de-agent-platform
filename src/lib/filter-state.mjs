// Pure filter-state serialization for marketplace/category filters.
// Shared by the client script (Vite bundles it) and node tests.

export const FILTER_KEYS = [
  'type', 'kind', 'category', 'difficulty', 'verification', 'agent',
  'security', 'technology', 'stage', 'quality',
];

export const DEFAULT_SORT = 'composite-desc';

/** URLSearchParams -> { [key]: string[] } (only keys with values) */
export function stateFromParams(searchParams) {
  const state = {};
  for (const key of FILTER_KEYS) {
    const raw = searchParams.get(key);
    if (raw) {
      const values = raw.split(',').filter(Boolean);
      if (values.length) state[key] = values;
    }
  }
  return state;
}

/** { [key]: string[] } + sort -> URLSearchParams (omits defaults) */
export function paramsFromState(state, sort = DEFAULT_SORT) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const values = state[key];
    if (values && values.length) params.set(key, values.join(','));
  }
  if (sort && sort !== DEFAULT_SORT) params.set('sort', sort);
  return params;
}

/** total number of selected filter values */
export function activeCount(state) {
  return Object.values(state).reduce((n, values) => n + (values?.length ?? 0), 0);
}

/** filter key -> human label used on removable chips */
export const CHIP_KEY_LABELS = {
  kind: 'Kind',
};

/** flat [{ key, value }] list for removable chips, stable key order */
export function chipList(state) {
  const chips = [];
  for (const key of FILTER_KEYS) {
    for (const value of state[key] ?? []) {
      chips.push({ key, value, label: `${CHIP_KEY_LABELS[key] ?? key}: ${value}` });
    }
  }
  return chips;
}

/** state minus one chip */
export function withoutChip(state, key, value) {
  const next = { ...state };
  const values = (next[key] ?? []).filter((v) => v !== value);
  if (values.length) next[key] = values;
  else delete next[key];
  return next;
}

/** empty state (all filters cleared) */
export function emptyState() {
  return {};
}
