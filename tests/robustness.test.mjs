// Marketplace robustness fixes (audit findings 20, 29, 39) — TDD: written
// before implementation. Each test names the production change that fixes it.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';

// ------------------------------------------------- R3: github_url validation
// Malformed github_url (owner/repo shorthand, trailing paths, typos) passed
// VALIDATE then failed every downstream parser (the 404 class).
describe('R3 validate rejects malformed github_url', () => {
  const mkValidate = async () => (await import('../pipelines/lib/validate.mjs')).validate;
  const base = (github_url) => ({
    id: 'ref-a', slug: 'ref-a', type: 'reference', title: 'T', description: 'D',
    category: 'cat-x', url: 'https://example.com', publisher: 'P',
    ...(github_url === undefined ? {} : { github_url }),
  });
  const taxonomy = { categories: [{ id: 'cat-x', slug: 'cat-x', title: 'X', stage: 'st' }], stages: [], technologies: [] };
  const meta = { licenses: [] };

  test('shorthand owner/repo, paths, and non-github urls are errors', async () => {
    const validate = await mkValidate();
    for (const bad of ['o/r', 'https://github.com/o/r/extra/path', 'https://github.com/o', 'https://gitlab.com/o/r']) {
      const v = validate({ resources: [base(bad)], taxonomy, meta });
      assert.ok(v.errors.some((e) => e.includes('ref-a') && e.includes('github_url')), `missing github_url error for ${bad}: ${JSON.stringify(v.errors)}`);
    }
  });
  test('canonical urls pass and absence is fine', async () => {
    const validate = await mkValidate();
    for (const good of ['https://github.com/o/r', 'https://github.com/o/r/']) {
      const v = validate({ resources: [base(good)], taxonomy, meta });
      assert.ok(!v.errors.some((e) => e.includes('github_url')), `unexpected github_url error for ${good}`);
    }
    const v = validate({ resources: [base(undefined)], taxonomy, meta });
    assert.ok(!v.errors.some((e) => e.includes('github_url')));
  });
});

// ------------------------------------------------ R2: trust scan in pipeline
// trust-findings.json was only written by the standalone script, so detail
// pages rendered an arbitrarily stale "Static trust scan" card and new
// resources had none.
describe('R2 trust scan freshness', () => {
  test('runTrustScan scans a registry in-memory and returns fresh payload', async () => {
    const { runTrustScan } = await import('../pipelines/scan-trust.mjs');
    const registry = { resources: [{ id: 'ref-a', slug: 'ref-a', type: 'reference', url: '/references/ref-a/', title: 'T', description: 'D', source_file: 'references/x.yaml' }] };
    const payload = await runTrustScan({ registry, remote: false });
    assert.ok(payload.generated_at, 'payload carries generated_at');
    assert.ok(payload.resources['/references/ref-a/'], 'scanned resource recorded by url');
    assert.ok(payload.stats.resources_scanned >= 1);
  });
  test('isTrustScanFresh gates on 7-day age and null safety', async () => {
    const { isTrustScanFresh } = await import('../pipelines/scan-trust.mjs');
    const now = Date.now();
    assert.equal(isTrustScanFresh(null), false, 'missing scan hides the card');
    assert.equal(isTrustScanFresh({ generated_at: new Date(now - 2 * 86400000).toISOString() }), true, '2 days is fresh');
    assert.equal(isTrustScanFresh({ generated_at: new Date(now - 9 * 86400000).toISOString() }), false, '9 days is stale');
    assert.equal(isTrustScanFresh({ generated_at: 'garbage' }), false, 'unparsable date hides the card');
  });
});

// ------------------------------------------- R1: votes DB -> marketplace fields
// install_count/rating_* were hardcoded zeros; the popularity model never saw
// its rating/engagement inputs.
describe('R1 marketplace reads votes aggregates', () => {
  test('computeMarketplaceScores wires ratings + installs into marketplace', async () => {
    const { computeMarketplaceScores } = await import('../pipelines/lib/marketplace-score.mjs');
    const res = { id: 'skill-x', slug: 'skill-x', type: 'skill', version: '1.0.0', license: 'MIT', verification: 'reviewed', last_verified: '2026-10-01', description: 'x', files: [] };
    computeMarketplaceScores([res], {}, {}, {
      ratings: { 'skill-x': { average: 4.5, count: 3, distribution: { '4': 1, '5': 2 } } },
      installs: { 'skill-x': { count: 10, success_rate: 0.8, last_installed_at: '2026-10-23T00:00:00Z' } },
    });
    assert.equal(res.marketplace.rating_average, 4.5);
    assert.equal(res.marketplace.rating_count, 3);
    assert.deepEqual(res.marketplace.rating_distribution, { '4': 1, '5': 2 });
    assert.equal(res.marketplace.install_count, 10);
    assert.equal(res.marketplace.install_success_rate, 0.8);
    assert.equal(res.marketplace.last_installed_at, '2026-10-23T00:00:00Z');
    assert.ok(res.marketplace.popularity_inputs.rating_avg === 4.5 && res.marketplace.popularity_inputs.rating_count === 3, 'popularity inputs carry rating');
    assert.ok(res.marketplace.popularity_base > 0, 'popularity reflects votes');
  });
  test('without votes, zeros (unchanged behavior)', async () => {
    const { computeMarketplaceScores } = await import('../pipelines/lib/marketplace-score.mjs');
    const res = { id: 'skill-y', slug: 'skill-y', type: 'skill', version: '1.0.0', license: 'MIT', verification: 'reviewed', last_verified: '2026-10-01', description: 'x', files: [] };
    computeMarketplaceScores([res], {}, {});
    assert.equal(res.marketplace.rating_average, 0);
    assert.equal(res.marketplace.install_count, 0);
  });
});

describe('R1 votes-db bulk aggregates', () => {
  const db = createClient({ url: 'file::memory:?cache=shared' });
  after(async () => { try { await db.close(); } catch {} });
  test('getRatingStatsBulk returns stats for every voted resource', async () => {
    const v = await import('../src/lib/votes-db.mjs');
    const { submitVote, voterHash, ipHash, getRatingStatsBulk } = v;
    await submitVote({ resource_id: 'r1', score: 5, voter_hash: voterHash('1.1.1.1', 'r1'), ip_hash: ipHash('1.1.1.1') }, db);
    await submitVote({ resource_id: 'r1', score: 3, voter_hash: voterHash('2.2.2.2', 'r1'), ip_hash: ipHash('2.2.2.2') }, db);
    await submitVote({ resource_id: 'r2', score: 4, voter_hash: voterHash('3.3.3.3', 'r2'), ip_hash: ipHash('3.3.3.3') }, db);
    const bulk = await getRatingStatsBulk(db);
    assert.equal(bulk.r1.count, 2);
    assert.equal(bulk.r1.average, 4);
    assert.equal(bulk.r2.count, 1);
    assert.deepEqual(bulk.r2.distribution, { '4': 1 });
  });
  test('getInstallStatsBulk returns counts + success rate per resource', async () => {
    const v = await import('../src/lib/votes-db.mjs');
    const { createInstallAttempt, completeInstallAttempt, getInstallStatsBulk } = v;
    const a = await createInstallAttempt({ resource_id: 'r1', resource_type: 'skill', manifest_version: '1', backend: 'dry', requested_at: '2026-10-23T01:00:00Z' }, db);
    await completeInstallAttempt(a, true, 100, 0, 1, null, null, null, db);
    const b = await createInstallAttempt({ resource_id: 'r1', resource_type: 'skill', manifest_version: '1', backend: 'dry', requested_at: '2026-10-23T02:00:00Z' }, db);
    await completeInstallAttempt(b, false, 50, 1, 1, 'exit-code', 'boom', null, db);
    const stats = await getInstallStatsBulk(db);
    assert.equal(stats.r1.count, 2);
    assert.equal(stats.r1.success_rate, 0.5);
    assert.equal(stats.r1.last_installed_at, '2026-10-23T02:00:00Z');
  });
});
