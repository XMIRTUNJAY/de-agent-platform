import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('search index carries earned and eligibility per entry', () => {
  const p = new URL('../src/data/generated/search-index.json', import.meta.url);
  assert.ok(existsSync(p));
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  assert.ok(doc.entries.length > 100);
  for (const e of doc.entries.slice(0, 20)) {
    assert.ok(typeof e.earned === 'string', `entry ${e.id} needs earned`);
    assert.ok(typeof e.eligibility === 'string', `entry ${e.id} needs eligibility`);
    assert.ok(typeof e.url === 'string');
  }
});
