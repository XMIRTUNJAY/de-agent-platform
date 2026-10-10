/**
 * FRESHNESS — is this record still true to its upstream?
 * Compares the upstream push timestamp (from provenance refresh) against
 * the record's last verification. Missing provenance means unknown, never
 * changed. Unreachable upstreams are recorded, not guessed.
 */
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
