/**
 * VOTES DB — durable ratings + engagement counters on SQLite-wire (libsql).
 *
 * - Production (Vercel serverless): TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 *   better-sqlite3 cannot persist here (ephemeral filesystem), hence libsql over HTTP.
 * - Local dev: file:.data/votes.db (gitignored, zero new native deps).
 *
 * Lazy singleton: created on first request, never at import time, so static
 * prerender (`astro build`) never touches a database client.
 */
import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';

export const ENGAGEMENT_KINDS = ['install_click', 'install_copy', 'resource_view'];

let client = null;

export function getVotesClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL ?? 'file:.data/votes.db';
    if (url.startsWith('file:')) {
      try { mkdirSync('.data', { recursive: true }); } catch {}
    }
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

/** Test seam: swap the singleton for a temp-file/in-memory client. */
export function setVotesClientForTests(next) {
  client = next;
}

export async function ensureVotesSchema(db = getVotesClient()) {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS votes (
      resource_id TEXT NOT NULL,
      voter_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL DEFAULT '',
      score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
      review_text TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (resource_id, voter_hash)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_votes_ip_time ON votes (ip_hash, updated_at)`,
    `CREATE TABLE IF NOT EXISTS engagement (
      resource_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      day TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (resource_id, kind, day, ip_hash)
    )`,
  ]);
}

export function voterHash(ip, resourceId, salt = process.env.VOTE_SALT ?? 'dev-only-salt') {
  return createHash('sha256').update(`${salt}|${ip}|${resourceId}`).digest('hex');
}

export function ipHash(ip, salt = process.env.VOTE_SALT ?? 'dev-only-salt') {
  return createHash('sha256').update(`${salt}|${ip}`).digest('hex');
}

/** One vote per voter per resource: repeat votes update the score, never duplicate.
 * @param {{ resource_id: string, score: number, voter_hash: string, ip_hash: string, review_text?: string | null, verified?: boolean }} vote
 */
export async function submitVote({ resource_id, score, voter_hash, ip_hash, review_text = null, verified = false }, db = getVotesClient()) {
  const now = new Date().toISOString();
  await ensureVotesSchema(db);
  await db.execute({
    sql: `INSERT INTO votes (resource_id, voter_hash, ip_hash, score, review_text, verified, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (resource_id, voter_hash)
          DO UPDATE SET score = excluded.score, review_text = excluded.review_text,
                        verified = excluded.verified, updated_at = excluded.updated_at`,
    args: [resource_id, voter_hash, ip_hash, score, review_text, verified ? 1 : 0, now, now],
  });
  return getRatingStats(resource_id, db);
}

export async function getRatingStats(resource_id, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const rs = await db.execute({
    sql: `SELECT COUNT(*) AS n, AVG(score) AS avg FROM votes WHERE resource_id = ?`,
    args: [resource_id],
  });
  const dist = await db.execute({
    sql: `SELECT score, COUNT(*) AS n FROM votes WHERE resource_id = ? GROUP BY score`,
    args: [resource_id],
  });
  const distribution = {};
  for (const row of dist.rows) distribution[String(row.score)] = Number(row.n);
  return {
    average: rs.rows[0].n > 0 ? Math.round(Number(rs.rows[0].avg) * 100) / 100 : 0,
    count: Number(rs.rows[0].n),
    distribution,
  };
}

export async function getReviews(resource_id, page = 1, perPage = 10, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const totalRs = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM votes WHERE resource_id = ? AND review_text IS NOT NULL`,
    args: [resource_id],
  });
  const total = Number(totalRs.rows[0].n);
  const rs = await db.execute({
    sql: `SELECT score, review_text, verified, updated_at FROM votes
          WHERE resource_id = ? AND review_text IS NOT NULL
          ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    args: [resource_id, perPage, (page - 1) * perPage],
  });
  return {
    reviews: rs.rows.map((r) => ({
      score: r.score, review_text: r.review_text,
      verified: r.verified === 1, updated_at: r.updated_at,
    })),
    total,
  };
}

/** Abuse brake: votes per IP hash in the trailing window (default 10/hour). */
export async function countRecentVotes(ip_hash, hours = 1, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const rs = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM votes WHERE ip_hash = ? AND updated_at >= ?`,
    args: [ip_hash, since],
  });
  return Number(rs.rows[0].n);
}

/**
 * Engagement counters, day-bucketed, capped at 5/day per IP per resource+kind
 * so counter spam cannot move popularity far.
 */
export async function recordEngagement({ resource_id, kind, ip_hash }, db = getVotesClient()) {
  if (!ENGAGEMENT_KINDS.includes(kind)) throw new Error(`unknown engagement kind: ${kind}`);
  await ensureVotesSchema(db);
  const day = new Date().toISOString().slice(0, 10);
  await db.execute({
    sql: `INSERT INTO engagement (resource_id, kind, day, ip_hash, count)
          VALUES (?, ?, ?, ?, 1)
          ON CONFLICT (resource_id, kind, day, ip_hash)
          DO UPDATE SET count = MIN(count + 1, 5)`,
    args: [resource_id, kind, day, ip_hash],
  });
}

export async function getEngagementTotals(resource_id, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const rs = await db.execute({
    sql: `SELECT kind, SUM(count) AS n FROM engagement WHERE resource_id = ? GROUP BY kind`,
    args: [resource_id],
  });
  const totals = { installs: 0, copies: 0, views: 0 };
  for (const row of rs.rows) {
    if (row.kind === 'install_click') totals.installs = Number(row.n);
    else if (row.kind === 'install_copy') totals.copies = Number(row.n);
    else if (row.kind === 'resource_view') totals.views = Number(row.n);
  }
  return totals;
}
