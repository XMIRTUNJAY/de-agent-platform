import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, phaseForStage } from '../src/lib/phases.ts';

// Canonical phase mapping (brief §D: one authoritative source; §7: four
// established phases grouping the thirteen stages). The homepage previously
// hard-coded this in index.astro — the module is now the single source.

describe('PHASES', () => {
  it('defines exactly the four established phases in order', () => {
    assert.deepEqual(
      PHASES.map((p) => p.name),
      ['Foundations', 'Platforms', 'Trust & Operations', 'Advanced & Agentic'],
    );
    assert.deepEqual(PHASES.map((p) => p.index), [1, 2, 3, 4]);
    for (const p of PHASES) {
      assert.equal(typeof p.tagline, 'string');
      assert.ok(p.tagline.length > 0, 'tagline must be non-empty');
    }
  });

  it('covers all thirteen registry stages exactly once', async () => {
    const { default: registry } = await import('../src/data/generated/registry.json', { with: { type: 'json' } });
    const canonical = registry.taxonomy.stages.map((s) => s.id).sort();
    const mapped = PHASES.flatMap((p) => p.stageIds).sort();
    assert.deepEqual(mapped, canonical);
    assert.equal(new Set(mapped).size, mapped.length, 'no stage may appear in two phases');
    assert.equal(mapped.length, 13);
  });
});

describe('phaseForStage', () => {
  it('maps known stages to their phase', () => {
    assert.equal(phaseForStage('foundations')?.name, 'Foundations');
    assert.equal(phaseForStage('agentic')?.name, 'Advanced & Agentic');
  });

  it('returns null for unknown stages instead of throwing', () => {
    assert.equal(phaseForStage('not-a-stage'), null);
    assert.equal(phaseForStage(''), null);
  });
});
