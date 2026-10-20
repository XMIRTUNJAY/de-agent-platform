import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, '..', '..', p), 'utf8');
test('AUD-003: res.commands renders exactly once in ResourceDetail template', () => {
  const detail = read('src/components/ResourceDetail.astro');
  const occurrences = detail.split('res.commands && res.commands.length').length - 1;
  if (occurrences !== 1) throw new Error(`Expected 1 commands section, found ${occurrences}`);
});

test('AUD-004: rating and install widgets are gated on liveWidgets (SSR only)', () => {
  const detail = read('src/components/ResourceDetail.astro');
  for (const marker of ["data-rate-widget data-resource-id", 'id="install-btn"']) {
    if (!detail.includes(marker)) throw new Error(`Missing widget marker: ${marker}`);
  }
  if (!detail.includes('const liveWidgets = process.env.VERCEL')) {
    throw new Error('liveWidgets gate missing from ResourceDetail');
  }
  // both widget tags must sit inside a liveWidgets gate
  const gateCount = detail.split('{liveWidgets && (').length - 1;
  if (gateCount < 2) throw new Error(`Expected >=2 liveWidgets gates, found ${gateCount}`);
});

test('AUD-002: sections carry data-section attributes and runbook ordering rules exist', () => {
  const detail = read('src/components/ResourceDetail.astro');
  for (const key of ['symptoms', 'diagnosis', 'fix', 'commands', 'prevention', 'monitoring']) {
    if (!detail.includes(`data-section="${key}"`)) {
      throw new Error(`Missing data-section attribute: ${key}`);
    }
  }
  if (!detail.includes("[data-artifact-type='runbook'] [data-section='symptoms'] { order: 10; }")) {
    throw new Error('Runbook Ordering CSS rule missing');
  }
  if (!detail.includes('data-artifact-type={res.type}')) {
    throw new Error('Content container missing data-artifact-type');
  }
});

test('AUD-012: learning objectives section rendered on detail pages', () => {
  const detail = read('src/components/ResourceDetail.astro');
  if (!detail.includes('res.learning_objectives ?? []).length > 0')) {
    throw new Error('Learning objectives section missing');
  }
  if (!detail.includes('<h2>Learning objectives</h2>')) {
    throw new Error('Learning objectives heading missing');
  }
});

test('AUD-009: object-type fields render entries, never bare [object Object]', () => {
  const detail = read('src/components/ResourceDetail.astro');
  // Symptoms used to use Object.values(s)[0]; now joins entries like Diagnosis.
  if (/<li[^>]*>\{typeof s === 'string' \? s : Object\.values\(s\)\[0\]\}/.test(detail)) {
    throw new Error('Symptoms still renders bare Object.values()[0]');
  }
  for (const key of ['s', 'h', 'm']) {
    const re = new RegExp(`typeof ${key} === 'string' \\? ${key} : \\(${key}\\.title \\?\\? ${key}\\.name`);
    if (!re.test(detail)) throw new Error(`link text for '${key}' lacks string-first rendering`);
  }
});

test('AUD-005: marketplace filters split into 4 primary + collapsed advanced, quality removed', () => {
  const page = read('src/pages/marketplace.astro');
  const panel = read('src/components/FilterPanel.astro');
  const state = read('src/lib/filter-state.mjs');

  // quality group no longer declared as a filter
  if (page.includes("{ label: 'Quality Score'")) throw new Error('Quality Score filter still declared');
  // legacy type checkbox group removed in favor of kind super-groups
  if (page.includes("{ label: 'Type', key: 'type'")) throw new Error('raw Type group still declared');
  if (!page.includes("key: 'kind'")) throw new Error('kind super-group missing');
  // primary list = exactly 4 keys
  const primaryMatch = page.match(/primary=\{\[([^\]]*)\]\}/);
  if (!primaryMatch) throw new Error('FilterPanel primary prop missing');
  const keys = primaryMatch[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  if (keys.length !== 4) throw new Error(`Expected 4 primary groups, got ${keys.length}: ${keys.join(',')}`);

  // FilterPanel collapses non-primary groups behind one advanced toggle
  if (!panel.includes('primary')) throw new Error('FilterPanel lacks primary prop');
  if (!panel.includes('filter-advanced')) throw new Error('FilterPanel lacks advanced collapsible');

  // URL compatibility: kind + legacy keys both serializable
  if (!state.includes("'kind'")) throw new Error('filter-state missing kind key');
  if (!state.includes("'quality'")) throw new Error('filter-state must keep quality key for legacy URLs');
});

test('AUD-013: ResourceCard hierarchy — no rating chip, no success %, <=6 visual rows', () => {
  const card = read('src/components/ResourceCard.astro');
  if (card.includes('ratingCount > 0')) throw new Error('rating chip still rendered on cards');
  if (card.includes('% success')) throw new Error('install success % still rendered on cards');
  if (card.includes('(r.tags || []).slice(0, 3)')) throw new Error('cards still show 3 tag chips');
  // description fallback chain present
  for (const marker of ['firstSentence', 'lacksDepth', 'showObjectives']) {
    if (!card.includes(marker)) throw new Error(`card fallback missing: ${marker}`);
  }
});

test('AUD-015: empty state offers clear-all recovery action', () => {
  const page = read('src/pages/marketplace.astro');
  if (!page.includes('data-empty-clear')) throw new Error('empty state lacks clear button');
  if (!page.includes('emptyClear')) throw new Error('empty state clear button not wired');
});
