import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRoutable } from '../pipelines/lib/eligibility.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'generated', 'registry.json'), 'utf8'));

const inner = registry.roadmap?.roadmap ?? registry.roadmap ?? {};
const mainPath = inner.main_path ?? [];
const stageMeta = inner.stages ?? {};
const stages = registry.taxonomy?.stages ?? [];
const resources = registry.resources ?? [];

describe('roadmap coverage', () => {
  it('every main-path stage exists in taxonomy', () => {
    const ids = new Set(stages.map((s) => s.id));
    for (const stage of mainPath) assert.ok(ids.has(stage), `stage missing from taxonomy: ${stage}`);
  });

  it('every stage flagship artifact resolves to a routable resource', () => {
    for (const stage of mainPath) {
      const artifact = stageMeta[stage]?.artifact;
      assert.ok(artifact, `stage has no flagship artifact: ${stage}`);
      const target = resources.find((r) => r.id === artifact);
      assert.ok(target, `flagship artifact unknown: ${stage} -> ${artifact}`);
      assert.ok(isRoutable(target), `flagship artifact not routable: ${stage} -> ${artifact}`);
      assert.ok(target.url, `flagship artifact has no url: ${stage} -> ${artifact}`);
    }
  });

  it('every stage has at least one category chapter', () => {
    for (const stage of mainPath) {
      const cats = (registry.taxonomy?.categories ?? []).filter((c) => c.stage === stage);
      assert.ok(cats.length > 0, `stage has no categories: ${stage}`);
    }
  });

  it('reports stages still lacking a tutorial (informational)', () => {
    const covered = new Set(resources.filter((r) => r.type === 'tutorial').map((r) => r.stage));
    const missing = mainPath.filter((s) => !covered.has(s));
    console.log(`  tutorial coverage: ${mainPath.length - missing.length}/${mainPath.length}` +
      (missing.length > 0 ? ` — missing: ${missing.join(', ')}` : ''));
  });

  it('emits upcoming gaps for exactly the uncovered stages (never as pages)', () => {
    const stats = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'generated', 'stats.json'), 'utf8'));
    const gaps = stats.roadmapGaps ?? [];
    const covered = new Set(resources.filter((r) => r.type === 'tutorial').map((r) => r.stage));
    assert.equal(gaps.length, mainPath.filter((s) => !covered.has(s)).length);
    for (const g of gaps) {
      assert.ok(mainPath.includes(g.stage));
      assert.ok(!covered.has(g.stage));
      assert.ok(!resources.some((r) => r.id === `upcoming-${g.stage}`), 'gaps must not be registry records');
    }
  });
});
