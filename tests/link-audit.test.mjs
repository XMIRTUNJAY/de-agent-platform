import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInternalLinks, auditLinks, sitemapCoverage } from '../pipelines/lib/link-audit.mjs';

test('extracts internal links, ignoring externals, fragments, and queries', () => {
  const out = extractInternalLinks('<a href="/skills/x/">a</a><a href="https://e.io/">b</a><a href="#frag">c</a><a href="/guides/y/?q=1">d</a>');
  assert.deepEqual(out, ['/skills/x/', '/guides/y/']);
});

test('reports broken links against the known set', () => {
  const out = auditLinks([{ url: '/a/', links: ['/b/', '/missing/'] }], new Set(['/a/', '/b/']));
  assert.deepEqual(out.broken, [{ from: '/a/', to: '/missing/' }]);
});

test('sitemap must cover eligible and exclude non-eligible detail pages', () => {
  const out = sitemapCoverage(['/ok/', '/skills/stray/'], ['/ok/', '/needs/x/']);
  assert.deepEqual(out.uncovered, ['/needs/x/']);
  assert.deepEqual(out.extra, ['/skills/stray/']);
});
