import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!p.includes('node_modules')) walk(p, out); }
    else if (/\.(astro|md|mdx|ts)$/.test(f)) out.push(p);
  }
  return out;
}

test('disclosure component states the independence rule', () => {
  const p = new URL('../src/components/AffiliateDisclosure.astro', import.meta.url);
  assert.ok(existsSync(p), 'disclosure component must exist');
  const src = readFileSync(p, 'utf8');
  assert.ok(src.includes('commission') && src.includes('/docs/monetization'));
});

test('no live affiliate links anywhere in src', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const hits = [];
  for (const f of walk(root)) {
    if (f.replace(/\\/g, '/').includes('docs/monetization.md')) continue;
    const src = readFileSync(f, 'utf8');
    const re = /https?:\/\/[^\s"')]+(?:tag=|affiliate|referral|_reward|associate-?id)[^\s"')]*|amazon\.[a-z.]+\/[^\s"')]*tag=/i;
    if (re.test(src)) hits.push(f);
  }
  assert.deepEqual(hits, [], `affiliate links must not ship before program review: ${hits.join(', ')}`);
});
