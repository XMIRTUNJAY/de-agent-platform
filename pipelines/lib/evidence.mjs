/**
 * EVIDENCE — the ten verification checks, level gates, and earned computation.
 *
 * Pure and offline. A resource EARNS a level only when every required check
 * has a `passed` evidence entry with a timestamp and an author
 * (`human` or `pipeline`). Pipeline attestation covers only what the pipeline
 * actually ran; an LLM saying code is correct is not evidence.
 * Supplemental checks (tutorial, static analysis, security review) are
 * recorded and shown but never gate a level.
 */
export const CHECKS = [
  'source_reachable',
  'metadata_validated',
  'license_reviewed',
  'tutorial_generated',
  'static_checks_passed',
  'build_passed',
  'tests_passed',
  'smoke_passed',
  'output_validated',
  'security_reviewed',
];

export const LEVELS = ['community', 'reviewed', 'tested', 'verified'];
const RANK = Object.fromEntries(LEVELS.map((l, i) => [l, i]));

const REQUIRED = {
  reviewed: ['metadata_validated', 'license_reviewed', 'source_reachable'],
  tested: ['metadata_validated', 'license_reviewed', 'source_reachable', 'build_passed', 'tests_passed'],
  verified: ['metadata_validated', 'license_reviewed', 'source_reachable', 'build_passed', 'tests_passed', 'smoke_passed', 'output_validated'],
};

export function evaluateEvidence(resource) {
  const byCheck = {};
  for (const e of resource.evidence ?? []) {
    const prev = byCheck[e.check];
    if (!prev || String(e.at ?? '') >= String(prev.at ?? '')) byCheck[e.check] = e;
  }
  const checks = {};
  for (const c of CHECKS) {
    const e = byCheck[c];
    checks[c] = e ? { status: e.status, at: e.at ?? null, by: e.by ?? null } : { status: 'unclaimed', at: null, by: null };
  }
  const passed = (c) => checks[c].status === 'passed';
  let earned = 'community';
  for (const level of ['reviewed', 'tested', 'verified']) {
    if (REQUIRED[level].every(passed)) earned = level;
  }
  const claimed = resource.verification ?? 'community';
  return { checks, earned, claimed, gap: (RANK[claimed] ?? 0) - (RANK[earned] ?? 0) };
}

export function evaluateAll(resources) {
  for (const r of resources) r.evidence_summary = evaluateEvidence(r);
  return resources;
}
