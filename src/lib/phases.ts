// Canonical roadmap phase mapping — the single authoritative source for how
// the thirteen taxonomy stages group into the four established phases
// (homepage, /categories, /roadmap all consume this; nothing else may
// hard-code the grouping — brief §D).
// Kept dependency-free (pure data) so node:test and Astro both import it.

export interface Phase {
  index: number;
  name: string;
  tagline: string;
  stageIds: string[];
}

const PHASE_SLUGS: [string, string, string[]][] = [
  ['Foundations', 'Storage, compute, and the primitives everything else builds on.', ['foundations', 'python-sql', 'data-processing']],
  ['Platforms', 'Warehouses, lakehouses, streaming backbones, and the cloud they run on.', ['warehousing', 'lakehouse', 'cloud', 'streaming']],
  ['Trust & Operations', 'Make data reliable: quality checks, observability, orchestration, reliability.', ['data-quality', 'observability', 'orchestration', 'reliability']],
  ['Advanced & Agentic', 'System design judgment and AI agents as first-class data workers.', ['system-design', 'agentic']],
];

export const PHASES: Phase[] = PHASE_SLUGS.map(([name, tagline, ids], i) => ({
  index: i + 1,
  name,
  tagline,
  stageIds: ids,
}));

const phaseByStage = new Map<string, Phase>();
for (const phase of PHASES) {
  for (const id of phase.stageIds) phaseByStage.set(id, phase);
}

export function phaseForStage(stageId: string): Phase | null {
  return phaseByStage.get(stageId) ?? null;
}
