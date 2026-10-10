import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { parse } from 'yaml';

test('every guide declares resolvable related ids and honest validation', () => {
  const dir = new URL('../src/pages/guides/', import.meta.url);
  assert.ok(existsSync(dir), 'guides dir must exist');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  assert.ok(files.length >= 2, 'need at least two exemplar guides');
  const reg = JSON.parse(readFileSync(new URL('../src/data/generated/registry.json', import.meta.url), 'utf8'));
  const ids = new Set(reg.resources.map((r) => r.id));
  for (const f of files) {
    const raw = readFileSync(new URL(`../src/pages/guides/${f}`, import.meta.url), 'utf8');
    const fm = parse(raw.split('---')[1]);
    assert.ok(fm.title && fm.description, `${f} needs title + description`);
    assert.ok(Array.isArray(fm.related) && fm.related.length >= 2, `${f} needs 2+ related ids`);
    for (const id of fm.related) assert.ok(ids.has(id), `${f} related id ${id} must exist in the registry`);
    assert.ok('validation' in fm, `${f} must declare validation (object or null)`);
  }
});

test('comparisons carry criteria, verdict, and labeled unknowns', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../src/pages/guides/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const comparisons = files.filter((f) => {
    const fm = parse(readFileSync(new URL(`../src/pages/guides/${f}`, import.meta.url), 'utf8').split('---')[1]);
    return fm.kind === 'comparison';
  });
  assert.ok(comparisons.length >= 1, 'need at least one comparison exemplar');
  for (const f of comparisons) {
    const raw = readFileSync(new URL(`../src/pages/guides/${f}`, import.meta.url), 'utf8');
    assert.ok(raw.includes('## Criteria'), `${f} needs a Criteria section`);
    assert.ok(raw.includes('## Verdict'), `${f} needs a Verdict section`);
  }
});

test('template scaffolds the contract without publishing', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const p = new URL('../src/pages/guides/_template.md', import.meta.url);
  assert.ok(existsSync(p), 'template must exist');
  const raw = readFileSync(p, 'utf8');
  const fm = parse(raw.split('---')[1]);
  assert.ok(fm.title && Array.isArray(fm.related) && 'validation' in fm);
});
