/**
 * RELATED — computed "more like this" from shared taxonomy.
 * Curated relationships are endorsements; these are overlap scores,
 * labeled as computed in the UI. Never fabricates relations.
 */
import { isRoutable } from './eligibility.mjs';

export function relatedScore(a, b) {
  let s = 0;
  if (a.category && a.category === b.category) s += 3;
  const at = new Set(a.technologies ?? []);
  for (const t of b.technologies ?? []) if (at.has(t)) s += 2;
  if (a.stage && a.stage === b.stage) s += 1;
  if (a.type && a.type === b.type) s += 1;
  return s;
}

export function relatedFor(resource, pool, limit = 5) {
  return pool
    .filter((r) => r.id !== resource.id && isRoutable(r))
    .map((r) => ({ id: r.id, score: relatedScore(resource, r) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}
