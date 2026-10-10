#!/usr/bin/env node
/**
 * AUDIT-LINKS — crawl the built site for dangling internal links and
 * sitemap drift. Offline: never fetches anything. Exit 1 on broken
 * links, uncovered eligible pages, or non-eligible detail pages in the
 * sitemap. Audit signal only: never runs as part of `npm run build`.
 */
import { readdirSync, statSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { extractInternalLinks, auditLinks, sitemapCoverage } from './lib/link-audit.mjs';
import { ROOT } from './lib/load.mjs';

function walkFiles(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

const dist = join(ROOT, 'dist');
if (!existsSync(dist)) {
  console.error('dist/ missing — run npm run build first');
  process.exit(2);
}
const toUrl = (p) => {
  const rel = p.replace(dist, '').replace(/\\/g, '/');
  if (rel.endsWith('/index.html')) return rel.slice(0, -'/index.html'.length) + '/';
  if (rel === '/index.html') return '/';
  return rel;
};
const allFiles = walkFiles(dist);
const pages = allFiles
  .filter((p) => p.endsWith('.html'))
  .map((p) => ({ url: toUrl(p), links: extractInternalLinks(readFileSync(p, 'utf8')) }));
const known = new Set(allFiles.map(toUrl));
for (const u of [...known]) {
  known.add(u.replace(/\/+$/, ''));
  known.add(u.replace(/\/+$/, '') + '/');
}

const { broken } = auditLinks(pages, known);

const locs = [];
for (const f of allFiles.filter((p) => p.replace(/\\/g, '/').match(/\/sitemap[^/]*\.xml$/))) {
  const xml = readFileSync(f, 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    try {
      locs.push(new URL(m[1]).pathname);
    } catch { /* ignore malformed locs */ }
  }
}
const eligibility = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'generated', 'page-eligibility.json'), 'utf8'));
const eligible = Object.entries(eligibility.states ?? {}).filter(([, s]) => s === 'eligible').map(([u]) => u);
const { uncovered, extra } = sitemapCoverage(locs, eligible);

console.log(`pages crawled: ${pages.length}`);
console.log(`broken: ${broken.length} · sitemap uncovered: ${uncovered.length} · sitemap extra: ${extra.length}`);
for (const b of broken.slice(0, 20)) console.log(`  ! broken ${b.from} -> ${b.to}`);
for (const u of uncovered.slice(0, 20)) console.log(`  ! uncovered ${u}`);
for (const u of extra.slice(0, 20)) console.log(`  ! extra ${u}`);

const cache = join(ROOT, 'data', 'cache');
mkdirSync(cache, { recursive: true });
writeFileSync(join(cache, 'link-audit.json'), JSON.stringify({ generated_at: new Date().toISOString(), broken, uncovered, extra }, null, 1) + '\n', 'utf8');

process.exit(broken.length > 0 || uncovered.length > 0 || extra.length > 0 ? 1 : 0);
