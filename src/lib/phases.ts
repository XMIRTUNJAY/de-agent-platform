// Canonical roadmap phase model — built on the single stage→phase table
// (pipelines/lib/stage-phases.mjs) so the UI and the scoring pipeline can
// never drift apart. Node tests and Astro both import this.
import { PHASE_ORDER, PHASE_NAMES, STAGE_PHASE } from '../../pipelines/lib/stage-phases.mjs';

export interface Phase {
  index: number;
  key: string;
  name: string;
  tagline: string;
  stageIds: string[];
}

const PHASE_TAGLINES: Record<string, string> = {
  foundations: 'Storage, compute, and the primitives everything else builds on.',
  platforms: 'Warehouses, lakehouses, streaming backbones, and the cloud they run on.',
  'trust-operations': 'Make data reliable: quality checks, observability, orchestration, reliability.',
  'advanced-agentic': 'System design judgment and AI agents as first-class data workers.',
};

export const PHASES: Phase[] = PHASE_ORDER.map((key, i) => {
  const phaseKey: keyof typeof PHASE_NAMES = key as keyof typeof PHASE_NAMES;
  return {
    index: i + 1,
    key,
    name: PHASE_NAMES[phaseKey] ?? key,
    tagline: PHASE_TAGLINES[phaseKey] ?? '',
    stageIds: Object.entries(STAGE_PHASE)
      .filter(([, k]) => k === key)
      .map(([id]) => id),
  };
});

const phaseByStage: Map<string, Phase> = new Map<string, Phase>();
for (const phase of PHASES) {
  for (const id of phase.stageIds) phaseByStage.set(id, phase);
}

export function phaseForStage(stageId: string): Phase | null {
  return phaseByStage.get(stageId) ?? null;
}
