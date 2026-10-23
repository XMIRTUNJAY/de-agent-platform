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
import { relatedFor } from './lib/related.mjs';
import { depthAll } from './lib/depth.mjs';
import { computeMarketplaceScores } from './lib/marketplace-score.mjs';
import { applyFreshness } from './lib/freshness.mjs';
import { loadExecutions } from './lib/exec-runner.mjs';
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
const ctx = await step('NORMALIZE', () => normalizeAll());
const { resources, taxonomy, meta, roadmap } = ctx;
info(`${resources.length} resources · ${taxonomy.categories.length} categories · ${taxonomy.technologies.length} technologies`);

// DEDUPLICATE
await step('DEDUPLICATE', () => {
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
await step('LICENSE CHECK', () => {
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
const v = await step('VALIDATE', () => validate({ resources, taxonomy, meta }));
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
await step('QUALITY SCORE', () => {
  scoreAll(resources, meta);
  const scored = resources.filter((r) => r.scores.quality !== null);
  const avg = scored.length ? (scored.reduce((a, r) => a + r.scores.quality, 0) / scored.length).toFixed(2) : 'n/a';
  const compAvg = (resources.reduce((a, r) => a + r.scores.completeness, 0) / resources.length).toFixed(0);
  info(`${scored.length} source-quality scores (avg ${avg}/5) · mean completeness ${compAvg}%`);
  return null;
});

// DEPTH
await step('DEPTH', () => {
  depthAll(resources);
  const byLevel = {};
  for (const r of resources) byLevel[r.depth.level] = (byLevel[r.depth.level] ?? 0) + 1;
  for (const r of resources.filter((r) => r.depth.level === 'thin').slice(0, 20)) warn('  ! thin [' + r.depth.score + '] ' + r.id);
  info('depth: ' + Object.entries(byLevel).map(([k, n]) => `${k}:${n}`).join('  '));
  emitDepth(byLevel);
  return null;
});

// EVIDENCE
await step('EVIDENCE', () => {
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

// GITHUB ENRICHMENT
await step('GITHUB ENRICHMENT', async () => {
  try {
    const { enrichResources } = await import('./github-enrichment.mjs');
    await enrichResources(resources);
    info('GitHub enrichment complete');
  } catch (err) {
    warn('GitHub enrichment skipped: ' + err.message);
  }
  return null;
});

// SECRET SCAN — hardcoded-credential sweep (local curated tree + top remote
// repos). Findings merge in-memory; clean scans earn vulnerability_scan_at,
// which the marketplace security score rewards. Never modifies curated YAML.
await step('SECRET SCAN', async () => {
  try {
    const { scanResources } = await import('./scan-secrets.mjs');
    const { scanned, skipped, dirty } = await scanResources(resources);
    info(`Secret scan: ${scanned} scanned, ${skipped} skipped (no token or unreachable)`);
    for (const d of dirty.slice(0, 10)) warn(`  ! secrets in ${d.id} (${d.hits} non-example hits)`);
    if (dirty.length > 10) warn(`  ! ...and ${dirty.length - 10} more`);
  } catch (err) {
    warn('Secret scan skipped: ' + err.message);
  }
  return null;
});

// INSTALL MANIFESTS — propose install commands for top resources lacking
// them. Drafts ONLY (data/drafts/install-manifests/): manifests execute on
// user machines, so a curator tests each on a clean machine and copies the
// block into the curated record by hand. Never auto-merges.
await step('INSTALL MANIFESTS', async () => {
  try {
    const { proposeInstallManifests } = await import('./generate-install-manifests.mjs');
    const { proposed, skipped, noToken } = await proposeInstallManifests(resources);
    info(`Install manifests: ${proposed} drafts proposed, ${skipped} skipped${noToken ? ' (no token)' : ''}`);
  } catch (err) {
    warn('Install manifests skipped: ' + err.message);
  }
  return null;
});

// FRESHNESS — must run BEFORE MARKETPLACE SCORE so the maintainability
// dimension sees r.freshness (freshness points and the archived-repo penalty
// used to read undefined) and VERIFY/ELIGIBILITY see a real r.stale.
await step('FRESHNESS', () => {
  const counts = applyFreshness(resources, new Date().toISOString());
  info(`${counts.upstream_changed} upstream-changed · ${counts.archived} archived · ${counts.stale} stale`);
  return null;
});

// MARKETPLACE SCORE
await step('MARKETPLACE SCORE', async () => {
  // Load execution results for performance scoring
  const executions = loadExecutions(join(ROOT, 'data', 'cache', 'executions'));
  // Live votes aggregates (ratings + install attempts). Optional: a missing
  // or unreachable DB leaves the fields at zero rather than failing builds.
  let votes = { ratings: {}, installs: {} };
  try {
    const { getRatingStatsBulk, getInstallStatsBulk } = await import('../src/lib/votes-db.mjs');
    votes = { ratings: await getRatingStatsBulk(), installs: await getInstallStatsBulk() };
    const nR = Object.keys(votes.ratings).length, nI = Object.keys(votes.installs).length;
    if (nR || nI) info(`votes: ${nR} rated · ${nI} with install attempts`);
  } catch (err) {
    warn('votes aggregates unavailable: ' + err.message);
  }
  computeMarketplaceScores(resources, meta, executions, votes);
  const scored = resources.filter(r => r.marketplace?.composite_score > 0);
  const avg = scored.length ? (scored.reduce((a, r) => a + r.marketplace.composite_score, 0) / scored.length).toFixed(1) : 'n/a';
  const labels = {};
  for (const r of scored) {
    labels[r.marketplace.composite_label] = (labels[r.marketplace.composite_label] ?? 0) + 1;
  }
  info(`${scored.length} resources scored (avg ${avg}) · ${Object.entries(labels).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  return null;
});

// VERIFY
await step('VERIFY', () => {
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
await step('ELIGIBILITY', () => {
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

// RELATED
await step('RELATED', () => {
  for (const r of resources) r.related_computed = relatedFor(r, resources, 5);
  info(`related links computed for ${resources.length} resources`);
  return null;
});

if (failed && !FLAGS.has('--no-fail')) {
  error('build halted — fix the errors above');
  process.exit(1);
}

// TRUST — fold the LOCAL static trust scan into every build so the detail
// pages' "Static trust scan" card is never stale and new resources are
// covered (the standalone scan-trust.mjs keeps remote scanning for manual runs).
await step('TRUST', async () => {
  const { runTrustScan } = await import('./scan-trust.mjs');
  const { atomicWrite } = await import('./lib/emit.mjs');
  const payload = await runTrustScan({ remote: false });
  atomicWrite(join(ROOT, 'src', 'data', 'generated', 'trust-findings.json'), JSON.stringify(payload, null, 1) + '\n');
  info(`trust scan: ${payload.stats.resources_scanned} resources · ${payload.stats.total_findings} findings · ${payload.stats.flagged_resources} flagged`);
  return null;
});

// PUBLISH
const pub = await step('PUBLISH', () => emit(ctx));
info(`registry.json · search-index.json · graph.json · stats.json written to src/data/generated/`);
info(`${pub.stats.counts.total} resources · ${pub.stats.readability.read_only} read-only · ${pub.stats.readability.needs_credentials} need credentials`);

const ms = Date.now() - t0;
console.log(`\n  \x1b[32m✓\x1b[0m pipeline complete in ${ms}ms\n`);

// ---------------------------------------------------------------- helpers --
function banner() {
  console.log('\n\x1b[2m  DISCOVER → FETCH → EXTRACT → CLASSIFY → NORMALIZE → DEDUPE → LICENSE → SCORE → VERIFY → PUBLISH\x1b[0m');
  console.log('\x1b[1m  DE//AGENT registry pipeline\x1b[0m\n');
}
async function step(name, fn) {
  const started = Date.now();
  try {
    const out = await fn();
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
function emitDepth(byLevel) {
  const payload = { generated_at: new Date().toISOString(), levels: byLevel, thin_ids: resources.filter((r) => r.depth.level === 'thin').map((r) => r.id).sort() };
  for (const dir of [join(ROOT, 'src', 'data', 'generated'), join(ROOT, 'public', 'data', 'generated')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'depth.json'), JSON.stringify(payload, null, 1) + '\n', 'utf8');
  }
}

function warn(msg) { console.log(`      \x1b[33m${msg}\x1b[0m`); }
function error(msg) { console.log(`      \x1b[31m${msg}\x1b[0m`); }
