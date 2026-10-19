import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  depthFlags, depthScore, thinResources, THIN_SCORE,
  synthesizeCategoryOverview, emptyCategoryAlternatives, compositeOf,
  renderDraftWorksheet,
} from '../pipelines/lib/content-depth.mjs';
import registry from '../src/data/generated/registry.json' with { type: 'json' };

const full = {
  slug: 'x', title: 'X', type: 'skill', typeLabel: 'Skill', url: '/skills/x',
  tagline: 'A tagline that is definitely long enough to pass the length gate here.',
  description: 'A description with plenty of concrete, specific detail that easily clears the ninety character floor without padding.',
  purpose: 'When you need X.', problem: 'Stops Y.', prerequisites: ['a'], learning_objectives: ['b'],
  technologies: ['tech-sql'], verification: 'community', stage: 'stage-1',
  marketplace: { composite_score: 72 },
};

test('depthScore: full resource scores 100, thin resource scores low', () => {
  assert.equal(depthScore(full), 100);
  const bare = { slug: 'y', title: 'Y', type: 'skill', typeLabel: 'Skill' };
  assert.ok(depthScore(bare) < THIN_SCORE);
});

test('depthFlags names every missing actionable field', () => {
  const bare = depthFlags({ slug: 'y' });
  for (const f of ['short_description', 'short_tagline', 'no_purpose', 'no_problem', 'no_prerequisites', 'no_learning_objectives']) {
    assert.ok(bare.includes(f), f);
  }
  assert.deepEqual(depthFlags(full), []);
});

test('thinResources: only sub-threshold entries, sorted worst-first', () => {
  const thin = thinResources([full, { slug: 'y', title: 'Y', type: 'skill', typeLabel: 'Skill', url: '/skills/y' }]);
  assert.equal(thin[0].slug, 'y');
  assert.ok(thin.every((t) => t.score < THIN_SCORE));
});

test('synthesis is grounded: counts, urls and names exist in the registry', () => {
  const cat = registry.taxonomy.categories.find((c) => c.id === 'cat-sql');
  const resources = registry.resources.filter((r) => r.category === 'cat-sql');
  const o = synthesizeCategoryOverview(cat, resources, registry.taxonomy);
  assert.ok(o.intro.includes(`${resources.length} resource`));
  for (const s of o.startHere) {
    assert.ok(resources.some((r) => r.url === s.url && r.title === s.title), s.url);
    assert.equal(s.composite, compositeOf(resources.find((r) => r.url === s.url)));
  }
  // no raw ids leak (tech names resolved)
  assert.ok(!/tech-[a-z]/.test(o.intro));
});

test('empty-category alternatives are real, same-stage, non-empty', () => {
  const cat = registry.taxonomy.categories.find((c) => c.id === 'cat-python');
  const rel = emptyCategoryAlternatives(cat, registry);
  assert.ok(rel.length > 0 && rel.length <= 3);
  for (const r2 of rel) {
    const sibling = registry.taxonomy.categories.find((c) => c.slug === r2.slug);
    assert.equal(sibling.stage, cat.stage);
    assert.ok(r2.n > 0);
    assert.notEqual(sibling.id, 'cat-python');
  }
});

test('draft worksheets quote real fields and mark gaps TODO — never prose', () => {
  const r = registry.resources.find((x) => !x.purpose && x.description);
  const ws = renderDraftWorksheet(r, depthFlags(r));
  assert.ok(ws.includes(`url: ${r.url}`));
  assert.ok(ws.includes('TODO'));
  assert.ok(!ws.includes('It currently holds'));
});

test('every registry category has a generated overview file', async () => {
  const { readdirSync } = await import('node:fs');
  const files = new Set(readdirSync(new URL('../src/data/enrichment/categories/', import.meta.url)));
  for (const c of registry.taxonomy.categories) {
    assert.ok(files.has(`${c.slug}.json`), c.slug);
  }
});
