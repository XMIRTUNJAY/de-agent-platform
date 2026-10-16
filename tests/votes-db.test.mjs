import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import {
  ensureVotesSchema,
  submitVote,
  getRatingStats,
  getReviews,
  recordEngagement,
  getEngagementTotals,
  countRecentVotes,
  voterHash,
  ipHash,
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
});
