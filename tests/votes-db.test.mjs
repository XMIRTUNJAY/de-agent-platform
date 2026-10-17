import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import {
  ensureVotesSchema,
  submitVote,
  getRatingStats,
  getReviews,
  getVotesByUser,
  recordEngagement,
  getEngagementTotals,
  countRecentVotes,
  voterHash,
  ipHash,
  createInstallAttempt,
  completeInstallAttempt,
  addInstallCommands,
  getInstallAttempts,
  getUserInstalls,
  getResourceInstallStats,
  createPublisherClaim,
  getPublisherClaimByResource,
  getPublisherClaimsByUser,
  verifyPublisherClaim,
  createResourceVersion,
  getResourceVersionsDb,
} from '../src/lib/votes-db.mjs';

process.env.VOTE_SALT = 'test-salt';

let db;

before(async () => {
  db = createClient({ url: 'file::memory:?cache=shared' });
  await ensureVotesSchema(db);
});

after(async () => {
  await db.close();
});

describe('votes-db', () => {
  it('one vote per voter per resource: repeats update, never duplicate', async () => {
    const vh = voterHash('1.2.3.4', 'skill-x');
    await submitVote({ resource_id: 'skill-x', score: 5, voter_hash: vh, ip_hash: ipHash('1.2.3.4') }, db);
    await submitVote({ resource_id: 'skill-x', score: 2, voter_hash: vh, ip_hash: ipHash('1.2.3.4') }, db);
    const stats = await getRatingStats('skill-x', db);
    assert.equal(stats.count, 1);
    assert.equal(stats.average, 2);
    assert.deepEqual(stats.distribution, { 2: 1 });
  });

  it('averages across voters', async () => {
    await submitVote({ resource_id: 'skill-y', score: 4, voter_hash: 'a', ip_hash: 'ip-a' }, db);
    await submitVote({ resource_id: 'skill-y', score: 2, voter_hash: 'b', ip_hash: 'ip-b' }, db);
    const stats = await getRatingStats('skill-y', db);
    assert.equal(stats.count, 2);
    assert.equal(stats.average, 3);
  });

  it('reviews list only votes with text', async () => {
    await submitVote({ resource_id: 'skill-z', score: 5, voter_hash: 'c', ip_hash: 'ip-c', review_text: 'solid' }, db);
    await submitVote({ resource_id: 'skill-z', score: 1, voter_hash: 'd', ip_hash: 'ip-d' }, db);
    const { reviews, total } = await getReviews('skill-z', 1, 10, db);
    assert.equal(total, 1);
    assert.equal(reviews[0].review_text, 'solid');
  });

  it('throttle counts recent votes per IP', async () => {
    const ip = ipHash('9.9.9.9');
    assert.equal(await countRecentVotes(ip, 1, db), 0);
    await submitVote({ resource_id: 'skill-t', score: 5, voter_hash: 'e', ip_hash: ip }, db);
    assert.equal(await countRecentVotes(ip, 1, db), 1);
  });

  it('engagement caps at 5/day per IP', async () => {
    const ip = ipHash('7.7.7.7');
    for (let i = 0; i < 9; i++) {
      await recordEngagement({ resource_id: 'skill-e', kind: 'install_copy', ip_hash: ip }, db);
    }
    const totals = await getEngagementTotals('skill-e', db);
    assert.equal(totals.copies, 5);
    assert.equal(totals.installs, 0);
  });

  it('rejects unknown engagement kinds', async () => {
    await assert.rejects(recordEngagement({ resource_id: 'x', kind: 'like', ip_hash: 'ip' }, db));
  });

  it('links votes to a dashboard user id without trusting it for counting', async () => {
    await submitVote({ resource_id: 'skill-u', score: 4, voter_hash: 'vh-u1', ip_hash: 'ip-u1', user_id: 'user-1' }, db);
    const { ratings, total, uniqueResources } = await getVotesByUser('user-1', 1, 10, db);
    assert.equal(total, 1);
    assert.equal(uniqueResources, 1);
    assert.equal(ratings[0].rating, 4);
    // one-vote-per-voter still keyed by voter_hash, not user_id
    await submitVote({ resource_id: 'skill-u', score: 2, voter_hash: 'vh-u1', ip_hash: 'ip-u1', user_id: 'user-1' }, db);
    assert.equal((await getRatingStats('skill-u', db)).count, 1);
  });

  it('records full install lifecycles with live stats', async () => {
    const id = await createInstallAttempt({
      resource_id: 'skill-i', resource_type: 'skill', manifest_version: '0.1.0',
      backend: 'dry', user_id: 'user-1', requested_at: new Date().toISOString(),
    }, db);
    await addInstallCommands(id, [{ name: 'step', argv: ['run'] }], db);
    await completeInstallAttempt(id, true, 120, 0, 1, null, null, null, db);
    const stats = await getResourceInstallStats('skill-i', db);
    assert.equal(stats.install_count, 1);
    assert.equal(stats.install_success_rate, 1);
    assert.ok(stats.last_installed_at);
    const { attempts, total } = await getInstallAttempts('skill-i', 1, 5, db);
    assert.equal(total, 1);
    assert.equal(attempts[0].id, id);
    const mine = await getUserInstalls('user-1', 1, 5, db);
    assert.equal(mine.total, 1);
  });

  it('runs the publisher claim + version workflow', async () => {
    const claimId = await createPublisherClaim('skill-p', 'user-9', { url: 'https://example.com' }, db);
    const claim = await getPublisherClaimByResource('skill-p', db);
    assert.equal(claim.id, claimId);
    assert.equal(claim.status, 'pending');
    await verifyPublisherClaim(claimId, true, db);
    assert.equal((await getPublisherClaimByResource('skill-p', db)).status, 'verified');
    assert.equal((await getPublisherClaimsByUser('user-9', db)).length, 1);
    const vId = await createResourceVersion({ resource_id: 'skill-p', version: '0.2.0', manifest: { steps: [] }, published_by: 'user-9' }, db);
    const versions = await getResourceVersionsDb('skill-p', db);
    assert.equal(versions.length, 1);
    assert.equal(versions[0].id, vId);
    assert.deepEqual(versions[0].manifest, { steps: [] });
  });
});
