import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTopics, buildTopicPage, resourcesForTopic, topicSlug } from '../pipelines/lib/learn-topics.mjs';
import registry from '../src/data/generated/registry.json' with { type: 'json' };

test('topic selection: technologies + tags with >=2 resources, unique slugs', () => {
  const topics = selectTopics(registry);
  const slugs = topics.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slugs');
  assert.ok(topics.length >= 90, `expected >=90 topics, got ${topics.length}`);
  for (const t of topics) {
    const rs = resourcesForTopic(t, registry);
    assert.ok(rs.length >= (t.kind === 'technology' ? 1 : 2), `${t.slug} too thin: ${rs.length}`);
  }
});

test('topic pages have 8-10 grounded sections and real links only', () => {
  const topics = selectTopics(registry);
  let built = 0;
  const urls = new Set(registry.resources.map((r) => r.url));
  for (const t of topics.slice(0, 20)) {
    const page = buildTopicPage(t, registry);
    if (!page) continue;
    built++;
    assert.ok(page.sections.length >= 6, `${t.slug}: only ${page.sections.length} sections`);
    assert.ok(page.sections.length <= 11, `${t.slug}: ${page.sections.length} sections`);
    // every /resource link in section HTML must exist in the registry
    for (const s of page.sections) {
      for (const m of s.html.matchAll(/href="(\/[a-z]+\/[a-z0-9-]+)"/g)) {
        const href = m[1];
        if (/^\/(learn|docs|roadmap|categories)/.test(href)) continue;
        assert.ok(urls.has(href), `${t.slug}: broken link ${href}`);
      }
    }
  }
  assert.ok(built >= 18);
});

test('topic titles and counts in the overview match the registry', () => {
  const spark = selectTopics(registry).find((t) => t.slug === 'spark');
  assert.ok(spark, 'spark topic missing');
  const page = buildTopicPage(spark, registry);
  const rs = resourcesForTopic(spark, registry);
  assert.ok(page.sections[0].html.includes(`<strong>${rs.length}</strong>`), 'count mismatch');
});

test('topicSlug handles technology ids and tag strings', () => {
  const techs = registry.taxonomy.technologies;
  const tech = techs.find((t) => t.id === 'tech-spark') ?? techs[0];
  assert.equal(topicSlug('technology', tech.id, techs), tech.slug ?? tech.id.replace(/^tech-/, ''));
  assert.equal(topicSlug('tag', 'Data Quality'), 'data-quality');
});

test("stage pages: all 13 build with gate + resources + progression", async () => {
  const { buildStagePage } = await import('../pipelines/lib/stage-compare.mjs');
  let built = 0;
  for (const s of registry.taxonomy.stages) {
    const page = buildStagePage(s.id, registry);
    assert.ok(page, s.id);
    built++;
    assert.ok(page.sections.length >= 5, `${s.id}: ${page.sections.length} sections`);
    assert.ok(page.sections.some((x) => x.id === "gate"), `${s.id}: no gate section`);
  }
  assert.equal(built, 13);
});

test("compare pages: categories with >=3 resources build with table + trust", async () => {
  const { buildComparePage } = await import('../pipelines/lib/stage-compare.mjs');
  let built = 0;
  for (const c of registry.taxonomy.categories) {
    const page = buildComparePage(c.slug, registry);
    if (!page) continue;
    built++;
    assert.ok(page.n >= 3);
    assert.ok(page.sections.some((x) => x.id === "table"));
    assert.ok(page.sections.some((x) => x.id === "trust"));
    for (const s of page.sections) {
      for (const m of s.html.matchAll(/href="(\/[a-z]+\/[a-z0-9-]+)"/g)) {
        if (/^\/(learn|docs|roadmap|categories|marketplace)/.test(m[1])) continue;
        assert.ok(registry.resources.some((r) => r.url === m[1]), `broken ${m[1]}`);
      }
    }
  }
  assert.ok(built >= 20, `only ${built} compare pages`);
});

test("learn-path pages: slug lookup, guided path + context sections", async () => {
  const { buildLearnPath } = await import('../pipelines/lib/stage-compare.mjs');
  let built = 0;
  for (const c of registry.taxonomy.categories) {
    const page = buildLearnPath(c.slug, registry);
    if (!page) continue;
    built++;
    assert.ok(page.sections.some((x) => x.id === "path"));
    assert.ok(page.sections.some((x) => x.id === "context"));
  }
  assert.ok(built >= 30, `only ${built} learn-path pages`);
});
