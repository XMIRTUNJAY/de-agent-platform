/**
 * STAGE PHASES — the single authoritative stage→roadmap-phase mapping.
 * phases.ts (UI) builds its display objects from this table, and
 * marketplace-score.mjs (pipeline) resolves roadmap_phase from it — one
 * table, zero drift (AUD-010).
 *
 * Phase keys are the vocabulary already carried in generated registry data.
 */
export const PHASE_ORDER = ['foundations', 'platforms', 'trust-operations', 'advanced-agentic'];

export const PHASE_NAMES = {
  foundations: 'Foundations',
  platforms: 'Platforms',
  'trust-operations': 'Trust & Operations',
  'advanced-agentic': 'Advanced & Agentic',
};

export const STAGE_PHASE = {
  foundations: 'foundations',
  'python-sql': 'foundations',
  'data-processing': 'foundations',
  warehousing: 'platforms',
  lakehouse: 'platforms',
  cloud: 'platforms',
  streaming: 'platforms',
  'data-quality': 'trust-operations',
  observability: 'trust-operations',
  orchestration: 'trust-operations',
  reliability: 'trust-operations',
  'system-design': 'advanced-agentic',
  agentic: 'advanced-agentic',
};

/** roadmap phase key for a taxonomy stage id (null when unknown) */
export function phaseKeyForStage(stageId) {
  return STAGE_PHASE[stageId] ?? null;
}
