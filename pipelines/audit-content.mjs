#!/usr/bin/env node
/**
 * AUDIT-CONTENT — content-depth audit + enrichment scaffolding.
 *
 * Modes (default: audit only):
 *   node pipelines/audit-content.mjs              audit → console + data/cache/content-audit.json
 *   node pipelines/audit-content.mjs --categories generate src/data/enrichment/categories/<slug>.json
 *                                                 (grounded overviews rendered by category pages;
 *                                                  existing files are NEVER overwritten without --force)
 *   node pipelines/audit-content.mjs --drafts     write data/enrichment/drafts/<type>/<slug>.md
 *                                                 worklists for thin resources (human enrichment queue)
 *
 * Grounding: overviews derive only from registry fields and counts. Drafts
 * quote real fields and mark gaps as TODO — the tool never writes invented
 * copy into the curated YAML sources.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  thinResources, depthFlags, depthScore, categoriesWithCounts,
  synthesizeCategoryOverview, emptyCategoryAlternatives, renderDraftWorksheet,
} from './lib/content-depth.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'generated', 'registry.json'), 'utf8'));

const args = process.argv.slice(2);
const force = args.includes('--force');
const writeCategories = args.includes('--categories');
const writeDrafts = args.includes('--drafts');

// --- audit -----------------------------------------------------------------
const cats = categoriesWithCounts(registry);
const zeroCats = cats.filter((c) => c.n === 0);
const thinCats = cats.filter((c) => c.n > 0 && c.n < 5);
const thin = thinResources(registry.resources);

const depthScores = registry.resources.map((r) => depthScore(r));
const avgDepth = Math.round(depthScores.reduce((a, b) => a + b, 0) / Math.max(depthScores.length, 1));
const flagCounts = {};
for (const r of registry.resources) for (const f of depthFlags(r)) flagCounts[f] = (flagCounts[f] ?? 0) + 1;

const report = {
  generated_at: new Date().toISOString(),
  resources: registry.resources.length,
  avg_depth_score: avgDepth,
  thin_resources: thin.length,
  flag_counts: flagCounts,
  categories: { total: cats.length, zero: zeroCats.map((c) => c.slug), thin_lt5: thinCats.map((c) => ({ slug: c.slug, n: c.n })) },
  thin: thin.slice(0, 40),
};

console.log(`resources: ${report.resources} · avg depth: ${avgDepth}/100 · thin: ${thin.length}`);
console.log(`categories: ${cats.length} total · zero: ${zeroCats.length} · thin(<5): ${thinCats.length}`);
console.log('top flags:', Object.entries(flagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, c]) => `${f}:${c}`).join(' '));

mkdirSync(join(ROOT, 'data', 'cache'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'cache', 'content-audit.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');

// --- category overviews (grounded, human-editable) --------------------------
if (writeCategories) {
  const outDir = join(ROOT, 'src', 'data', 'enrichment', 'categories');
  mkdirSync(outDir, { recursive: true });
  let written = 0, skipped = 0;
  for (const cat of cats) {
    const file = join(outDir, `${cat.slug}.json`);
    if (existsSync(file) && !force) { skipped++; continue; }
    const resources = registry.resources.filter((r) => r.category === cat.id);
    const overview = synthesizeCategoryOverview(cat, resources, registry.taxonomy);
    if (resources.length === 0) {
      overview.related = emptyCategoryAlternatives(cat, registry);
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(overview, null, 1) + '\n', 'utf8');
    written++;
  }
  console.log(`category overviews: ${written} written, ${skipped} skipped (exist; use --force to regenerate)`);
}

// --- thin-resource drafts (human enrichment queue) --------------------------
if (writeDrafts) {
  const outDir = join(ROOT, 'data', 'enrichment', 'drafts');
  mkdirSync(outDir, { recursive: true });
  let written = 0, skipped = 0;
  for (const r of registry.resources) {
    const flags = depthFlags(r);
    if (!flags.length) continue;
    const file = join(outDir, r.type, `${r.slug}.md`);
    if (existsSync(file) && !force) { skipped++; continue; }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, renderDraftWorksheet(r, flags), 'utf8');
    written++;
  }
  console.log(`drafts: ${written} written, ${skipped} skipped (exist; use --force to regenerate)`);
}
