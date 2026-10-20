import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { completenessFor } from '../pipelines/lib/completeness.mjs';
import { phaseKeyForStage } from '../pipelines/lib/stage-phases.mjs';
import { computeMarketplaceScores, compositeLabel } from '../pipelines/lib/marketplace-score.mjs';
import { scoreAll } from '../pipelines/lib/score.mjs';

describe('AUD-014: what_you_need alias', () => {
  it('prerequisites and what_you_need earn the same completeness credit', () => {
    const base = { type: 'tutorial', description: 'd', category: 'c' };
    const withPrereq = { ...base, prerequisites: ['x'] };
    const withAlias = { ...base, what_you_need: ['x'] };
    assert.equal(completenessFor(withAlias), completenessFor(withPrereq));
  });
  it('never double-counts when both spellings are present', () => {
    const both = { type: 'tutorial', prerequisites: ['x'], what_you_need: ['x'] };
    const only = { type: 'tutorial', prerequisites: ['x'] };
    assert.equal(completenessFor(both), completenessFor(only));
  });
  it('denominator includes type-specific fields', () => {
    const thin = { type: 'runbook', description: 'd' };
    const full = { type: 'runbook', description: 'd', symptoms: ['s'], diagnosis: ['d'], fix: ['f'], prevention: ['p'] };
    assert.ok(completenessFor(full) > completenessFor(thin));
  });
});

describe('AUD-007: one score path', () => {
  it('score.mjs and marketplace-score.mjs compute the same completeness', () => {
    const meta = { scoring: { guide: [] } };
    const fields = {
      type: 'skill', description: 'd', category: 'c', difficulty: 'beginner', tags: ['t'],
      technologies: ['py'], learning_objectives: ['l'], prerequisites: [], source_url: 'u',
      license: 'MIT', author: 'a', version: '1.0.0', last_verified: '2026-01-01',
      compatibility: [], install_command: 'i', security: {}, verification: 'reviewed',
    };
    const scored = [{ ...fields }, { ...fields }];
    scoreAll([scored[0]], meta);
    computeMarketplaceScores([scored[1]], meta, {});
    assert.equal(scored[0].scores.completeness, scored[1].marketplace.quality_scores.completeness);
  });
});

describe('AUD-008: null dimensions are not forgiven', () => {
  it('resource with null dimensions scores below an equally-good full one', () => {
    const meta = { scoring: { guide: [] } };
    const full = { type: 'reference', url: 'u', publisher: 'p', kind: 'k', verification: 'verified', description: 'd', category: 'c', evidence_summary: { gap: 0 } };
    const partial = { type: 'reference', url: 'u', publisher: 'p', kind: 'k', verification: 'verified', description: 'd', category: 'c', evidence_summary: { gap: 0 } };
    computeMarketplaceScores([full], meta, { [full.id]: { spawned: true, state: 'passed', commands: [{ exitCode: 0, durationMs: 1000 }] } });
    computeMarketplaceScores([partial], meta, {});
    assert.ok(full.marketplace.composite_score > partial.marketplace.composite_score);
  });
  it('evidence gap multiplies the composite down', () => {
    const meta = { scoring: { guide: [] } };
    const clean = { id: 'a', type: 'reference', url: 'u', publisher: 'p', kind: 'k', verification: 'reviewed', description: 'd', category: 'c', evidence_summary: { gap: 0 } };
    const overclaim = { id: 'b', type: 'reference', url: 'u', publisher: 'p', kind: 'k', verification: 'verified', description: 'd', category: 'c', evidence_summary: { gap: 2 } };
    computeMarketplaceScores([clean, overclaim], meta, {});
    assert.ok(clean.marketplace.composite_score > overclaim.marketplace.composite_score);
  });
  it('strong/exemplary labels require earned verification', () => {
    const meta = { scoring: { guide: [] } };
    const community = { id: 'c', type: 'reference', url: 'u', publisher: 'p', kind: 'k', verification: 'community', description: 'a very long description'.repeat(5), category: 'x', evidence_summary: { gap: 0 }, security_reviewed_at: 'now', vulnerability_scan_at: 'now', dependency_audit_at: 'now', least_privilege_config: true, credentials: false, network_access: false, runs_code: false };
    computeMarketplaceScores([community], meta, {});
    assert.equal(compositeLabel(90), 'exemplary');
    assert.ok(!['strong', 'exemplary'].includes(community.marketplace.composite_label));
  });
});

describe('AUD-010: single phase table', () => {
  it('orchestration maps to trust-operations everywhere', () => {
    assert.equal(phaseKeyForStage('orchestration'), 'trust-operations');
    const meta = { scoring: { guide: [] } };
    const r = { id: 'o', type: 'reference', url: 'u', publisher: 'p', kind: 'k', verification: 'community', description: 'd', category: 'c', stage: 'orchestration' };
    computeMarketplaceScores([r], meta, {});
    assert.equal(r.marketplace.roadmap_phase, 'trust-operations');
  });
});
