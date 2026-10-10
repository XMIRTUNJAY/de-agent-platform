#!/usr/bin/env node
/**
 * The ingestion pipeline, end to end:
 *
 *   DISCOVER → FETCH METADATA → EXTRACT → CLASSIFY → NORMALIZE → DEDUPLICATE
 *      → LICENSE CHECK → QUALITY SCORE → VERIFY → PUBLISH
 *
 * Curated YAML is the reviewed input; this pipeline normalizes, validates,
 * scores and publishes it. Discovery and provenance refresh are separate,
 * network-touching commands (pipelines/discover.mjs, pipelines/refresh-provenance.mjs)
 * that are never run implicitly during a build.
 */
import { normalizeAll } from './lib/normalize.mjs';
import { validate } from './lib/validate.mjs';
import { scoreAll } from './lib/score.mjs';
import { emit } from './lib/emit.mjs';
import { findCandidates } from './lib/identity.mjs';
import { evaluateAll } from './lib/evidence.mjs';
import { pageEligibility } from './lib/eligibility.mjs';
import { ROUTE } from './lib/emit.mjs';
import { ROOT } from './lib/load.mjs';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const FLAGS = new Set(args);
const t0 = Date.now();
let failed = false;

banner();

// 1-4: discover/fetch/extract/classify are upstream of the curated files.
// NORMALIZE
const ctx = step('NORMALIZE', () => normalizeAll());
const { resources, taxonomy, meta, roadmap } = ctx;
info(`${resources.length} resources · ${taxonomy.categories.length} categories · ${taxonomy.technologies.length} technologies`);

// DEDUPLICATE
step('DEDUPLICATE', () => {
  const seen = new Map();
  let dupes = 0;
  for (const r of resources) {
    if (seen.has(r.slug)) dupes++;
    seen.set(r.slug, r);
  }
  info(`${dupes} duplicate slug(s) detected`);
  const { groups, checked } = findCandidates(resources);
  for (const g of groups.slice(0, 20)) warn('  ! candidate [' + g.reason + '] ' + g.ids.join(' ~ '));
  info(`${groups.length} duplicate-candidate group(s) across ${checked} resources (reported, never merged)`);
  emitDuplicates({ groups, checked });
  return null;
});

// LICENSE CHECK
step('LICENSE CHECK', () => {
  const cats = meta.licenses ?? [];
  const reproducible = cats.filter((l) => l.allows_reproduce).map((l) => l.spdx);
  const restricted = resources.filter((r) => r.license && !reproducible.includes(r.license) && !String(r.license).startsWith('Proprietary'));
  const proprietary = resources.filter((r) => String(r.license ?? '').startsWith('Proprietary'));
  info(`${proprietary.length} proprietary source(s) — summarised and linked only, never reproduced`);
  info(`${restricted.length} resource(s) with a non-reproducible license`);
  info(`${cats.length} licenses in the catalogue`);
  return null;
});

// VALIDATE
const v = step('VALIDATE', () => validate({ resources, taxonomy, meta }));
if (v.warnings.length) {
  warn(`${v.warnings.length} warning(s)`);
  if (FLAGS.has('--verbose') || FLAGS.has('--check')) for (const w of v.warnings.slice(0, 40)) warn('  ! ' + w);
}
if (v.errors.length) {
  failed = true;
  error(`${v.errors.length} error(s)`);
  for (const e of v.errors.slice(0, 40)) error('  x ' + e);
} else {
  ok('schema + referential integrity OK');
}

// QUALITY SCORE
step('QUALITY SCORE', () => {
  scoreAll(resources, meta);
  const scored = resources.filter((r) => r.scores.quality !== null);
  const avg = scored.length ? (scored.reduce((a, r) => a + r.scores.quality, 0) / scored.length).toFixed(2) : 'n/a';
  const compAvg = (resources.reduce((a, r) => a + r.scores.completeness, 0) / resources.length).toFixed(0);
  info(`${scored.length} source-quality scores (avg ${avg}/5) · mean completeness ${compAvg}%`);
  return null;
});

// EVIDENCE
step('EVIDENCE', () => {
  const pipelineVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const at = new Date().toISOString();
  for (const r of resources) {
    r.evidence = [...(r.evidence ?? []), { check: 'metadata_validated', status: 'passed', at, by: 'pipeline', tool: 'de-agent-pipeline', version: pipelineVersion, summary: 'schema + referential integrity OK' }];
  }
  evaluateAll(resources);
  const over = resources.filter((r) => r.evidence_summary.gap > 0);
  info(`${over.length} resource(s) claim more than evidence supports (labeled, never hidden)`);
  return null;
});

// VERIFY
step('VERIFY', () => {
  const byV = {};
  for (const r of resources) byV[r.verification] = (byV[r.verification] ?? 0) + 1;
  const stale = resources.filter((r) => r.stale).length;
  info(Object.entries(byV).map(([k, n]) => `${k}:${n}`).join('  '));
  const byEarned = {};
  for (const r of resources) byEarned[r.evidence_summary.earned] = (byEarned[r.evidence_summary.earned] ?? 0) + 1;
  info('earned: ' + Object.entries(byEarned).map(([k, n]) => `${k}:${n}`).join('  '));
  info(`${stale} resource(s) past the 180-day staleness threshold`);
  return null;
});

// ELIGIBILITY
step('ELIGIBILITY', () => {
  const states = {};
  for (const r of resources) {
    r.page_eligibility = pageEligibility(r);
    const url = `/${ROUTE[r.type] ?? 'resources'}/${r.slug}`;
    states[url] = r.page_eligibility.state;
  }
  emitEligibility(states);
  const counts = {};
  for (const s of Object.values(states)) counts[s] = (counts[s] ?? 0) + 1;
  info('eligibility: ' + Object.entries(counts).map(([k, n]) => `${k}:${n}`).join('  '));
  return null;
});

if (failed && !FLAGS.has('--no-fail')) {
  error('build halted — fix the errors above');
  process.exit(1);
}

// PUBLISH
const pub = step('PUBLISH', () => emit(ctx));
info(`registry.json · search-index.json · graph.json · stats.json written to src/data/generated/`);
info(`${pub.stats.counts.total} resources · ${pub.stats.readability.read_only} read-only · ${pub.stats.readability.needs_credentials} need credentials`);

const ms = Date.now() - t0;
console.log(`\n  \x1b[32m✓\x1b[0m pipeline complete in ${ms}ms\n`);

// ---------------------------------------------------------------- helpers --
function banner() {
  console.log('\n\x1b[2m  DISCOVER → FETCH → EXTRACT → CLASSIFY → NORMALIZE → DEDUPE → LICENSE → SCORE → VERIFY → PUBLISH\x1b[0m');
  console.log('\x1b[1m  DE//AGENT registry pipeline\x1b[0m\n');
}
function step(name, fn) {
  const started = Date.now();
  try {
    const out = fn();
    const ms = String(Date.now() - started).padStart(4);
    console.log(`  \x1b[32m✓\x1b[0m \x1b[1m${name.padEnd(16)}\x1b[0m \x1b[2m${ms}ms\x1b[0m`);
    return out;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m \x1b[1m${name.padEnd(16)}\x1b[0m`);
    console.error(e);
    process.exit(1);
  }
}
function info(msg) { console.log(`      \x1b[2m${msg}\x1b[0m`); }
function ok(msg) { console.log(`      \x1b[32m${msg}\x1b[0m`); }
function emitDuplicates(doc) {
  const payload = { generated_at: new Date().toISOString(), ...doc };
  for (const dir of [join(ROOT, 'src', 'data', 'generated'), join(ROOT, 'public', 'data', 'generated')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'duplicates.json'), JSON.stringify(payload, null, 1) + '\n', 'utf8');
  }
}
function emitEligibility(states) {
  const payload = { generated_at: new Date().toISOString(), states };
  for (const dir of [join(ROOT, 'src', 'data', 'generated'), join(ROOT, 'public', 'data', 'generated')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'page-eligibility.json'), JSON.stringify(payload, null, 1) + '\n', 'utf8');
  }
}
function warn(msg) { console.log(`      \x1b[33m${msg}\x1b[0m`); }
function error(msg) { console.log(`      \x1b[31m${msg}\x1b[0m`); }
