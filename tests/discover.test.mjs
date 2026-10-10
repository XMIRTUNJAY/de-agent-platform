import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../pipelines/lib/feeds.mjs';
import { classifyRules, resolveClassification } from '../pipelines/lib/classify.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(HERE, 'fixtures', name), 'utf8');

const TAXONOMY = {
  categories: [
    { id: 'cat-kafka', title: 'Kafka' },
    { id: 'cat-dbt', title: 'dbt' },
    { id: 'cat-warehouses', title: 'Data Warehouses' },
  ],
};

// ---- feed parsing ----------------------------------------------------------

test('parses RSS 2.0 items', () => {
  const feed = parseFeed(fixture('rss-sample.xml'));
  assert.equal(feed.ok, true);
  assert.equal(feed.kind, 'rss');
  assert.equal(feed.items.length, 2);
  assert.equal(feed.items[0].title, 'Exactly-once Streaming at Scale');
  assert.ok(feed.items[0].url.startsWith('https://'));
  assert.ok(feed.items[0].published);
});

test('parses Atom entries with alternate link', () => {
  const feed = parseFeed(fixture('atom-sample.xml'));
  assert.equal(feed.ok, true);
  assert.equal(feed.kind, 'atom');
  assert.equal(feed.items.length, 1);
  assert.equal(feed.items[0].url, 'https://example.dev/blog/iceberg-maintenance');
});

test('rejects non-feed XML gracefully', () => {
  const feed = parseFeed('<html><body>not a feed</body></html>');
  assert.equal(feed.ok, false);
  assert.equal(feed.items.length, 0);
});

test('strips HTML from summaries', () => {
  const feed = parseFeed(fixture('rss-sample.xml'));
  assert.ok(!feed.items[0].summary.includes('<'));
});

// ---- classification ---------------------------------------------------------

test('classifies a Kafka post to its category with confidence', () => {
  const cls = resolveClassification(
    classifyRules({ title: 'Taming Kafka consumer lag in production', summary: 'How we scaled our consumer groups.' }, TAXONOMY),
    TAXONOMY
  );
  assert.equal(cls.category, 'cat-kafka');
  assert.notEqual(cls.confidence, 'low');
});

test('ambiguous items fall back to reference + null category', () => {
  const cls = resolveClassification(
    classifyRules({ title: 'Our Q3 platform update', summary: 'News and notes from the team.' }, TAXONOMY),
    TAXONOMY
  );
  assert.equal(cls.type, 'reference');
  assert.equal(cls.category, null);
  assert.equal(cls.confidence, 'low');
});

test('drops categories not in the taxonomy', () => {
  const cls = resolveClassification(
    classifyRules({ title: 'dbt semantic layer deep dive', summary: 'dbt metrics' }, TAXONOMY),
    { categories: [] } // empty taxonomy — nothing can resolve
  );
  assert.equal(cls.category, null);
  assert.deepEqual(cls.suggested_categories, []);
});

test('low confidence never exceeds reference type on network sources', () => {
  const cls = classifyRules({ title: 'getting started tutorial step by step', summary: '' }, TAXONOMY);
  assert.equal(cls.type, 'reference');
});
