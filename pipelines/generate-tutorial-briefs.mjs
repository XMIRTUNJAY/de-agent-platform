#!/usr/bin/env node
/**
 * TUTORIAL BRIEFS — gap-driven proposals for original tutorials.
 *
 * A tutorial is a beginner-friendly arrangement of artifact content:
 * steps are ALWAYS verbatim lines from source records (workflow, diagnosis,
 * fix, numbered body rules), each cited with its source id + field.
 * Beginner-friendliness comes from structure (need → steps → check),
 * never from rephrasing. Gatekeeping words fail the brief.
 *
 * This script only ever PROPOSES, into data/drafts/tutorials/ for human
 * review. Nothing merges automatically; a curator promotes a brief by
 * copying it into data/curated/tutorials/ as a `tutorial` record.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GATEKEEPING = /\b(simply|obviously|trivial(?:ly)?|of course|as we all know)\b/i;

const registry = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'generated', 'registry.json'), 'utf8'));
const resources = registry.resources;
const mainPath = registry.roadmap?.roadmap?.main_path ?? registry.roadmap?.main_path ?? [];

function bodyRules(body) {
  if (typeof body !== 'string') return [];
  return [...body.matchAll(/^\s*\d+\.\s+(.+)$/gm)].map((m) => m[1].trim()).filter(Boolean);
}

/** Verbatim step candidates with provenance, per source type. */
function candidateSteps(r) {
  const steps = [];
  for (const s of r.workflow ?? []) steps.push({ text: String(s), from_field: 'workflow' });
  for (const s of r.diagnosis ?? []) steps.push({ text: String(s), from_field: 'diagnosis' });
  for (const s of r.fix ?? []) steps.push({ text: String(s), from_field: 'fix' });
  for (const s of bodyRules(r.body)) steps.push({ text: s, from_field: 'body' });
  return steps.filter((s) => s.text.length > 0 && s.text.length < 300);
}

function candidateNeeds(r) {
  const need = [];
  for (const s of r.inputs ?? []) need.push(String(s));
  for (const s of r.prerequisites ?? []) need.push(`Prior: ${s}`);
  if (r.install_command) need.push(`Install: ${r.install_command}`);
  return need;
}

function candidateChecks(r) {
  const checks = [];
  if (r.evaluation) checks.push(String(r.evaluation));
  if (r.example) checks.push(String(r.example));
  return checks;
}

function scoreCandidate(r, steps) {
  let score = 0;
  if (r.difficulty === 'beginner') score += 2;
  if ((r.learning_objectives ?? []).length > 0) score += 2;
  if (r.evaluation) score += 1;
  if (r.example) score += 1;
  if (steps.length >= 3 && steps.length <= 10) score += 1;
  if (r.author === 'de-agent') score += 1; // own artifacts: full provenance, no surprises
  return score;
}

const tutorialStages = new Set(resources.filter((r) => r.type === 'tutorial').map((r) => r.stage));
const briefs = [];

for (const stage of mainPath) {
  if (tutorialStages.has(stage)) continue;
  const inStage = resources.filter((r) => r.stage === stage && r.type !== 'tutorial' && r.type !== 'reference');
  const scored = inStage
    .map((r) => ({ r, steps: candidateSteps(r) }))
    .filter((c) => c.steps.length >= 3)
    .map((c) => ({ ...c, score: scoreCandidate(c.r, c.steps) }))
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    briefs.push({ stage, status: 'no-step-source', note: 'No in-stage artifact with 3+ verbatim steps yet.' });
    continue;
  }
  const best = scored[0].r;
  const steps = candidateSteps(best);
  const needs = candidateNeeds(best);
  const checks = candidateChecks(best);
  const allText = [best.title, ...steps.map((s) => s.text), ...needs, ...checks].join('. ');
  const gatekeeping = GATEKEEPING.test(allText);
  briefs.push({
    stage, status: gatekeeping ? 'blocked-gatekeeping' : 'draft',
    source_id: best.id, source_type: best.type, source_title: best.title,
    difficulty: best.difficulty, steps, needs, checks,
    alternates: scored.slice(1, 3).map((c) => c.r.id),
  });
}

const outDir = join(ROOT, 'data', 'drafts', 'tutorials');
mkdirSync(outDir, { recursive: true });
const day = new Date().toISOString().slice(0, 10);

for (const b of briefs) {
  const lines = [
    '# DRAFT tutorial brief — NOT served. Curator: verify every step against',
    '# the cited source field, then copy into data/curated/tutorials/ as type: tutorial.',
    `# stage: ${b.stage}`,
    `# status: ${b.status}`,
    '',
  ];
  if (b.status === 'no-step-source') {
    lines.push(b.note, '');
  } else {
    lines.push(`proposed_title: Learn with ${b.source_title}`, `source: ${b.source_id} (${b.source_type})`,
      `difficulty: ${b.difficulty ?? 'unspecified'}`, `alternates: ${(b.alternates ?? []).join(', ') || 'none'}`, '',
      'what_you_need (verbatim from source):');
    for (const n of b.needs.length > 0 ? b.needs : ['(none stated in source — leave empty, do not invent)']) lines.push(`- ${n}`);
    lines.push('', 'steps (verbatim, in source order — do not rephrase):');
    b.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.text}`, `   from: ${b.source_id}#${s.from_field}`));
    lines.push('', 'check_yourself (verbatim from source):');
    for (const c of b.checks.length > 0 ? b.checks : ['(none stated in source — leave empty, do not invent)']) lines.push(`- ${c}`);
    lines.push('', `gatekeeping_scan: ${b.status === 'blocked-gatekeeping' ? 'FAIL — re-source before promoting' : 'pass'}`, '');
  }
  writeFileSync(join(outDir, `${day}-${b.stage}.md`), lines.join('\n'));
}

const drafts = briefs.filter((b) => b.status === 'draft').length;
console.log(`[Tutorial Briefs] stages: ${mainPath.length}, drafts: ${drafts}, blocked: ${briefs.filter((b) => b.status === 'blocked-gatekeeping').length}, no-source: ${briefs.filter((b) => b.status === 'no-step-source').length}`);
for (const b of briefs) console.log(`  ${b.stage}: ${b.status}${b.source_id ? ` <- ${b.source_id}` : ''}`);
