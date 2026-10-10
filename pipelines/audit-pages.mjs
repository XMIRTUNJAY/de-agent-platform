#!/usr/bin/env node
/**
 * AUDIT-PAGES — reconcile the built site against the registry.
 * Prints totals + the first 20 duplicate slugs, writes
 * data/cache/page-audit.json, exits 1 when duplicates or missing pages
 * exist. Audit signal only: never runs as part of `npm run build`.
 */
import { readdirSync, statSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { census } from './lib/page-census.mjs';
import { ROUTE } from './lib/emit.mjs';
import { ROOT } from './lib/load.mjs';

const DETAIL_SEGMENTS = new Set(['resources', ...Object.values(ROUTE)]);

function walkHtml(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (f === 'index.html') out.push(p);
  }
  return out;
}

const dist = join(ROOT, 'dist');
const distUrls = walkHtml(dist)
  .map((p) => '/' + p.replace(dist, '').replace(/\\/g, '/').replace(/index\.html$/, ''))
  .filter((u) => DETAIL_SEGMENTS.has(u.split('/').filter(Boolean)[0]))
  .filter((u) => u.split('/').filter(Boolean).length >= 2);

const registry = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'generated', 'registry.json'), 'utf8'));
const expected = registry.resources.map((r) => r.url).filter(Boolean);

const report = census(distUrls, expected);
console.log(`pages audited: ${report.total}`);
console.log(`duplicates: ${report.duplicates.length} · orphans: ${report.orphans.length} · missing: ${report.missing.length}`);
for (const d of report.duplicates.slice(0, 20)) console.log(`  ! duplicate slug ${d.slug}: ${d.urls.join(' ~ ')}`);
console.log('note: /resources/* URLs are the legacy route; typed routes (/skills/* etc.) are canonical.');

const cache = join(ROOT, 'data', 'cache');
mkdirSync(cache, { recursive: true });
writeFileSync(join(cache, 'page-audit.json'), JSON.stringify({ generated_at: new Date().toISOString(), ...report }, null, 1) + '\n', 'utf8');

process.exit(report.duplicates.length > 0 || report.missing.length > 0 ? 1 : 0);
