/**
 * FRESHNESS — is this record still true to its upstream?
 * Compares the upstream push timestamp (from provenance refresh) against
 * the record's last verification. Missing provenance means unknown, never
 * changed. Unreachable upstreams are recorded, not guessed.
 */
import { isStale } from './score.mjs';

export function evaluateFreshness(r, now = new Date().toISOString()) {
  const src = r.publisher_source ?? {};
  const pushed = src.pushed_at ?? null;
  const verified = r.last_verified ?? null;
  return {
    stale: !!r.stale,
    upstream_changed: !!(pushed && verified && pushed > verified),
    upstream_checked_at: src.checked_at ?? null,
    pushed_at: pushed,
    last_verified: verified,
    archived: !!src.archived,
    unreachable: !!src.unreachable,
  };
}

/**
 * Run the FRESHNESS evaluation for every record IN PLACE, before scoring:
 * sets r.freshness and r.stale (previously r.stale was only set inside emit,
 * so VERIFY/ELIGIBILITY and the marketplace maintainability dimension read
 * undefined). Returns { upstream_changed, archived, stale } counts.
 */
export function applyFreshness(resources, now = new Date().toISOString()) {
  let upstreamChanged = 0, archived = 0, stale = 0;
  for (const r of resources) {
    r.stale = isStale(r.last_verified, new Date(now));
    r.freshness = evaluateFreshness(r, now);
    if (r.freshness.upstream_changed) upstreamChanged++;
    if (r.freshness.archived) archived++;
    if (r.freshness.stale) stale++;
  }
  return { upstream_changed: upstreamChanged, archived, stale };
}
