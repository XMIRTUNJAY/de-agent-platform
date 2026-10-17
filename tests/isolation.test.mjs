import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, GENERATED, loadAll } from '../pipelines/lib/load.mjs';
import { DRAFTS } from '../pipelines/lib/drafts.mjs';

// ISOLATION CONTRACT: data/drafts/ is never under data/curated/, and
// load.mjs's TYPED_DIRS point inside CURATED only. This test exists so a
// future refactor can't silently start publishing unreviewed drafts.

test('draft directory is outside the curated directory', () => {
  const CURATED = join(ROOT, 'data', 'curated');
  assert.ok(!DRAFTS.startsWith(CURATED), 'drafts must not live inside data/curated');
});

test('the curated loader never yields draft records', () => {
  const { raw } = loadAll();
  const leaked = raw.filter((r) => r.curation_state === 'draft');
  assert.equal(leaked.length, 0, 'no record with curation_state: draft may reach the registry');
});

test('generated artifacts contain no draft markers', () => {
  const files = ['registry.json', 'search-index.json', 'graph.json', 'stats.json'];
  for (const f of files) {
    const p = join(GENERATED, f);
    if (!existsSync(p)) continue; // not built yet — build test coverage handles that
    const text = readFileSync(p, 'utf8');
    assert.ok(!text.includes('"curation_state":"draft"'), `${f} must not contain drafts`);
  }
});

test('every draft file starts with the DRAFT header comment', () => {
  if (!existsSync(DRAFTS)) return; // nothing to check yet
  const files = walk(DRAFTS).filter((f) => f.endsWith('.yaml'))
    // test-probe is promote-eligible.test.mjs scaffolding: it exists only for
    // milliseconds and can be caught mid-write by this parallel walker.
    .filter((f) => !f.includes('test-probe'));
  for (const f of files) {
    const head = readFileSync(f, 'utf8').slice(0, 40);
    assert.ok(head.startsWith('# DRAFT'), `${f} missing DRAFT header`);
  }
});

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
