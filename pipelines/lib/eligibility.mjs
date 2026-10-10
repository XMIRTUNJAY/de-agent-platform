/**
 * ELIGIBILITY — separate a resource's existence from its public page.
 * A record can live in the registry (and the knowledge graph) without
 * deserving a crawler-facing page. States: eligible (indexed, listed),
 * needs_review (browsable + internal search, noindex), internal_only
 * (browsable, noindex, hidden from listing grids), retired (no route,
 * curator-set only — nothing auto-retires).
 */
export function pageEligibility(r) {
  if (r.retired === true || r.publish === 'retired') return { state: 'retired', reasons: ['curator retired'] };
  if (['eligible', 'needs_review', 'internal_only'].includes(r.publish)) return { state: r.publish, reasons: ['curator override'] };
  const len = String(r.description ?? '').length;
  const depthLevel = r.depth?.level ?? (len >= 500 ? 'deep' : len >= 200 ? 'adequate' : 'thin');
  const gap = r.evidence_summary?.gap ?? 0;
  const stale = !!r.stale;
  const claimed = r.verification ?? 'community';
  if (depthLevel === 'thin' && claimed === 'community') return { state: 'internal_only', reasons: ['thin and unreviewed'] };
  const reasons = [];
  if (depthLevel === 'thin') reasons.push('thin content');
  if (gap > 0) reasons.push('claimed more than evidence supports');
  if (stale) reasons.push('past re-verify threshold');
  if (reasons.length > 0) return { state: 'needs_review', reasons };
  return { state: 'eligible', reasons: [] };
}

export function isRoutable(r) {
  return pageEligibility(r).state !== 'retired';
}
