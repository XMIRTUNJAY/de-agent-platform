// Deep-dive content block (2026-10 redesign): every detail page gets a
// What/When/Where/Why block, a tradeoff table, a derived stats table, plus
// authored gotchas / production notes / diagram sections where curated.
// Card redesign: score pill on top, metadata collapsed behind a Details expander.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, '..', p), 'utf8');

// ---------- pure lib: src/lib/deep-dive.ts ----------

test('tradeoffRows splits pro:/con: entries into table rows', async () => {
  const { tradeoffRows } = await import('../src/lib/deep-dive.ts');
  const rows = tradeoffRows([
    'pro: testable, reviewable transformations',
    'con: adds a layer to learn; over-testing becomes slow CI',
    'works best with multiple consumers',
  ]);
  if (rows.length !== 3) throw new Error(`expected 3 rows, got ${rows.length}`);
  if (rows[0].kind !== 'pro' || !rows[0].text.includes('testable')) throw new Error('pro row mis-parsed');
  if (rows[1].kind !== 'con' || !rows[1].text.includes('layer to learn')) throw new Error('con row mis-parsed');
  if (rows[2].kind !== 'neutral' || !rows[2].text.includes('multiple consumers')) throw new Error('neutral row mis-parsed');
});

test('atAGlance yields What/When/Where/Why rows and skips empty ones', async () => {
  const { atAGlanceRows } = await import('../src/lib/deep-dive.ts');
  const full = atAGlanceRows({
    description: 'A batch Spark job runtime has jumped. Find the cause.',
    when_to_use: ['Batch job latency regressed', 'No code change shipped'],
    categoryTitle: 'Spark',
    technologies: ['spark', 'yarn'],
    why: 'Slow jobs burn warehouse budget and delay SLAs.',
  });
  const labels = full.map((r) => r.label);
  if (labels.join('|') !== 'What|When|Where|Why') throw new Error(`unexpected labels: ${labels}`);
  if (!full[0].value.includes('runtime has jumped')) throw new Error('What should use first description sentence');
  if (!full[2].value.includes('Spark')) throw new Error('Where should include categoryTitle');

  const sparse = atAGlanceRows({ description: 'Only a description.', categoryTitle: 'Kafka' });
  const sparseLabels = sparse.map((r) => r.label);
  if (!sparseLabels.includes('What') || !sparseLabels.includes('Where')) throw new Error('What/Where missing on sparse resource');
  if (sparseLabels.includes('Why') || sparseLabels.includes('When')) throw new Error('empty rows must be skipped, got ' + sparseLabels);
});

test('statRows derives verification/score/freshness stats from registry data only', async () => {
  const { statRows } = await import('../src/lib/deep-dive.ts');
  const rows = statRows({
    verification: 'community',
    last_verified: '2026-09-28',
    scores: { completeness: 81, trust: 1.25, composite_score: null, qualityLabel: null },
    marketplace: { composite_score: 72, composite_label: 'adequate' },
    stale_days: 22,
    license: 'CC-BY-4.0',
    version: '1.2.0',
    security_flags: 0,
  });
  const by = Object.fromEntries(rows.map((r) => [r.label, r.value]));
  if (!by['Verification']?.includes('community')) throw new Error('Verification row missing');
  if (by['Completeness'] !== 81) throw new Error('Completeness row missing/wrong: ' + by['Completeness']);
  if (!by['Composite']?.includes('72')) throw new Error('Composite row missing: ' + by['Composite']);
  if (by['License'] !== 'CC-BY-4.0' || by['Version'] !== '1.2.0') throw new Error('license/version rows wrong');
  if (by['Security flags'] !== 'none') throw new Error('security row wrong: ' + by['Security flags']);

  const minimal = statRows({ scores: {} });
  if (minimal.some((r) => r.label === 'Composite')) throw new Error('no composite data must omit the row');
});

// ---------- markup contracts ----------

test('card: metadata collapses behind a details expander; score pill carries the label', () => {
  const card = read('src/components/ResourceCard.astro');
  if (!card.includes('<details') || !card.includes('card-details')) {
    throw new Error('card metadata expander (<details class="card-details">) missing');
  }
  const detailsStart = card.indexOf('<details');
  const detailsEnd = card.indexOf('</details>');
  for (const marker of ['card-meta', 'r.difficulty', '{installCount > 0']) {
    const at = card.indexOf(marker);
    if (at < 0) throw new Error(`card marker missing: ${marker}`);
    if (at < detailsStart || at > detailsEnd) throw new Error(`'${marker}' must live inside the details expander`);
  }
  if (!card.includes('score-circle')) throw new Error('score circle (gauge + label) missing from card top');
  if (!card.includes('compositeLabel')) throw new Error('score pill must show the quality label, not just the number');
});

test('detail: gotchas, production notes, tradeoff table, stats table, at-a-glance sections render', () => {
  const detail = read('src/components/ResourceDetail.astro');
  for (const section of ['at-a-glance', 'gotchas', 'production-notes', 'stats-table']) {
    if (!detail.includes(`data-section="${section}"`)) throw new Error(`missing data-section: ${section}`);
  }
  if (!detail.includes('<h2>Common gotchas</h2>')) throw new Error('gotchas heading missing');
  if (!detail.includes('<h2>Production considerations</h2>')) throw new Error('production notes heading missing');
  if (!detail.includes('tradeoffRows')) throw new Error('tradeoff table must render via tradeoffRows');
  if (!detail.includes('statRows')) throw new Error('stats table must render via statRows');
  if (!detail.includes('atAGlanceRows')) throw new Error('at-a-glance must render via atAGlanceRows');
});

test('detail: runbook and tutorial ordering rules place the new sections', () => {
  const detail = read('src/components/ResourceDetail.astro');
  for (const rule of [
    "[data-artifact-type='runbook'] [data-section='at-a-glance'] { order: 5; }",
    "[data-artifact-type='runbook'] [data-section='gotchas'] { order: 65; }",
    "[data-artifact-type='runbook'] [data-section='diagram'] { order: 72; }",
    "[data-artifact-type='tutorial'] [data-section='at-a-glance'] { order: 5; }",
    "[data-artifact-type='tutorial'] [data-section='diagram'] { order: 60; }",
  ]) {
    if (!detail.includes(rule)) throw new Error(`ordering rule missing: ${rule}`);
  }
});

test('pipeline: enriched runbook + tutorial YAML carry the new content fields', async () => {
  const registry = JSON.parse(read('src/data/generated/registry.json'));
  const items = Array.isArray(registry) ? registry : registry.resources ?? Object.values(registry);
  const runbooks = items.filter((x) => x.type === 'runbook');
  if (runbooks.length === 0) throw new Error('no runbooks in registry');
  const withNew = runbooks.filter((r) => r.gotchas?.length && r.production_notes?.length && r.why && r.diagram);
  if (withNew.length !== runbooks.length) {
    throw new Error(`expected all ${runbooks.length} runbooks enriched with gotchas/production_notes/why/diagram, found ${withNew.length}`);
  }
  const tutorials = items.filter((x) => x.type === 'tutorial');
  const enrichedTutorials = tutorials.filter((r) => r.gotchas?.length && r.diagram);
  if (tutorials.length > 0 && enrichedTutorials.length !== tutorials.length) {
    throw new Error(`expected all ${tutorials.length} tutorials enriched, found ${enrichedTutorials.length}`);
  }
});

test('tutorials carry code snippets: pipeline passes them, detail pages render a worked-example block', () => {
  const detail = read('src/components/ResourceDetail.astro');
  if (!detail.includes('data-section="worked-example"')) throw new Error('worked-example section missing');
  if (!detail.includes('<h2>Worked example</h2>')) throw new Error('Worked example heading missing');
  if (!detail.includes('res.code')) throw new Error('worked example must render from res.code');
  if (!detail.includes("[data-artifact-type='tutorial'] [data-section='worked-example'] { order: 35; }")) {
    throw new Error('worked-example ordering rule missing');
  }
  const normalize = read('pipelines/lib/normalize.mjs');
  if (!normalize.includes('code: r.code ?? []')) throw new Error('tutorial payload must pass the code field through');
  const registry = JSON.parse(read('src/data/generated/registry.json'));
  const items = Array.isArray(registry) ? registry : registry.resources ?? Object.values(registry);
  const tutorials = items.filter((x) => x.type === 'tutorial');
  const withCode = tutorials.filter((t) => Array.isArray(t.code) && t.code.length > 0 && t.code.every((c) => c.title && c.lang && c.code && c.source_id));
  if (tutorials.length > 0 && withCode.length !== tutorials.length) {
    throw new Error(`expected all ${tutorials.length} tutorials to carry code snippets, found ${withCode.length}`);
  }
});

test('runbooks render an incident notebook block (impact/escalation/evidence/rollback/follow-up)', () => {
  const detail = read('src/components/ResourceDetail.astro');
  if (!detail.includes('data-section="incident-notebook"')) throw new Error('incident-notebook section missing');
  if (!detail.includes('<h2>Incident notebook</h2>')) throw new Error('Incident notebook heading missing');
  if (!detail.includes("[data-artifact-type='runbook'] [data-section='incident-notebook'] { order: 12; }")) {
    throw new Error('incident-notebook ordering rule missing');
  }
  const registry = JSON.parse(read('src/data/generated/registry.json'));
  const items = Array.isArray(registry) ? registry : registry.resources ?? Object.values(registry);
  const runbooks = items.filter((x) => x.type === 'runbook');
  const missing = runbooks.filter(
    (r) => !r.impact || !r.escalation || !(r.evidence_to_collect ?? []).length || !r.rollback || !(r.follow_up ?? []).length
  );
  if (missing.length) {
    throw new Error('runbooks missing notebook fields: ' + missing.map((m) => m.id).join(', '));
  }
});

test('detail sidebar: Marketplace Quality Score card is FIRST; other metadata cards are folded', () => {
  const detail = read('src/components/ResourceDetail.astro');
  const asideStart = detail.indexOf('<aside');
  const asideEnd = detail.indexOf('</aside>');
  if (asideStart < 0 || asideEnd < 0) throw new Error('sidebar aside not found');
  const aside = detail.slice(asideStart, asideEnd);

  // score card must be the first section in the aside (expanded), folded cards after it
  const scoreAt = aside.indexOf('Marketplace Quality Score</h3>');
  if (scoreAt < 0) throw new Error('score card missing from sidebar');
  const firstCard = aside.indexOf('<section');
  const firstDetails = aside.indexOf('<details');
  if (firstCard < 0 || scoreAt < firstCard) {
    throw new Error('score card must be the first card in the sidebar');
  }
  if (firstDetails >= 0 && firstDetails < firstCard) {
    throw new Error('a folded card precedes the score card');
  }
  if (!aside.slice(firstCard, scoreAt).includes('<h3') || scoreAt - firstCard > 200) {
    throw new Error('an unexpected expanded card sits between the aside start and the score heading');
  }

  // metadata + security + provenance must be folded (details), not h3 cards
  for (const label of ['Metadata', 'Security Posture', 'Provenance', 'Technologies', 'Roadmap Alignment']) {
    if (aside.includes(`<h3 class="mono-label mb-3">${label}</h3>`)) {
      throw new Error(`'${label}' card is still expanded — must be a folded side-fold`);
    }
    const re = new RegExp(`<summary class="mono-label">\\s*${label}`);
    if (!re.test(aside)) throw new Error(`'${label}' missing a folded summary`);
  }
});
