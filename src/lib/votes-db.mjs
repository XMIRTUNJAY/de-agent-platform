/**
 * VOTES DB — durable ratings + engagement counters on SQLite-wire (libsql).
 *
 * - Production (Vercel serverless): TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 *   The old native driver cannot persist here (ephemeral filesystem), hence libsql over HTTP.
 * - Local dev: file:.data/votes.db (gitignored, zero new native deps).
 *
 * Lazy singleton: created on first request, never at import time, so static
 * prerender (`astro build`) never touches a database client.
 */
import { createClient } from '@libsql/client';
import { createHash, randomUUID } from 'node:crypto';
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
  // Migrate pre-existing DBs created before user_id existed. This MUST run
  // before the batch below: idx_votes_user references user_id and would fail
  // to create against an old votes table, aborting the whole batch.
  try {
    await db.execute(`ALTER TABLE votes ADD COLUMN user_id TEXT`);
  } catch { /* column already exists, or table is created by the batch below */ }
  await db.batch([
    `CREATE TABLE IF NOT EXISTS votes (
      resource_id TEXT NOT NULL,
      voter_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL DEFAULT '',
      user_id TEXT,
      score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
      review_text TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (resource_id, voter_hash)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_votes_ip_time ON votes (ip_hash, updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_votes_user ON votes (user_id)`,
    `CREATE TABLE IF NOT EXISTS engagement (
      resource_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      day TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (resource_id, kind, day, ip_hash)
    )`,
    `CREATE TABLE IF NOT EXISTS install_attempts (
      id TEXT PRIMARY KEY,
      resource_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      manifest_version TEXT NOT NULL,
      backend TEXT NOT NULL CHECK (backend IN ('dry', 'local', 'docker')),
      user_id TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      requested_at TEXT NOT NULL,
      success INTEGER,
      duration_ms INTEGER,
      exit_code INTEGER,
      command_count INTEGER,
      error_category TEXT,
      error_message TEXT,
      log_sha256 TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_install_attempts_resource ON install_attempts (resource_id)`,
    `CREATE INDEX IF NOT EXISTS idx_install_attempts_user ON install_attempts (user_id)`,
    `CREATE TABLE IF NOT EXISTS install_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id TEXT NOT NULL REFERENCES install_attempts(id),
      name TEXT NOT NULL,
      argv TEXT NOT NULL,
      exit_code INTEGER,
      duration_ms INTEGER,
      timed_out INTEGER DEFAULT 0,
      output_bytes INTEGER,
      sha256 TEXT,
      failure_category TEXT,
      failure_detail TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_install_commands_attempt ON install_commands (attempt_id)`,
    `CREATE TABLE IF NOT EXISTS publisher_claims (
      id TEXT PRIMARY KEY,
      resource_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      claimed_at TEXT NOT NULL,
      verified_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
      evidence TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_publisher_claims_user ON publisher_claims (user_id)`,
    `CREATE TABLE IF NOT EXISTS resource_versions (
      id TEXT PRIMARY KEY,
      resource_id TEXT NOT NULL,
      version TEXT NOT NULL,
      manifest TEXT NOT NULL,
      changelog TEXT,
      published_at TEXT NOT NULL,
      published_by TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_resource_versions_resource ON resource_versions (resource_id)`,
  ]);
}

export function voterHash(ip, resourceId, salt = process.env.VOTE_SALT ?? 'dev-only-salt') {
  return createHash('sha256').update(`${salt}|${ip}|${resourceId}`).digest('hex');
}

export function ipHash(ip, salt = process.env.VOTE_SALT ?? 'dev-only-salt') {
  return createHash('sha256').update(`${salt}|${ip}`).digest('hex');
}

/** One vote per voter per resource: repeat votes update the score, never duplicate.
 * @param {{ resource_id: string, score: number, voter_hash: string, ip_hash: string, user_id?: string | null, review_text?: string | null, verified?: boolean }} vote
 */
export async function submitVote({ resource_id, score, voter_hash, ip_hash, user_id = null, review_text = null, verified = false }, db = getVotesClient()) {
  const now = new Date().toISOString();
  await ensureVotesSchema(db);
  await db.execute({
    sql: `INSERT INTO votes (resource_id, voter_hash, ip_hash, user_id, score, review_text, verified, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (resource_id, voter_hash)
          DO UPDATE SET score = excluded.score, review_text = excluded.review_text,
                        verified = excluded.verified, user_id = excluded.user_id,
                        updated_at = excluded.updated_at`,
    args: [resource_id, voter_hash, ip_hash, user_id, score, review_text, verified ? 1 : 0, now, now],
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

// ---------------------------------------------------------------------------
// INSTALL LIFECYCLE — ported from the retired native store.
// Same record shapes (snake_case rows), same function names, async + durable.
// The native driver segfaults Windows builds and cannot persist on serverless.

/** @param {{ resource_id: string, resource_type: string, manifest_version: string, backend: string, user_id?: string | null, ip_hash?: string | null, user_agent?: string | null, requested_at: string }} attempt */
export async function createInstallAttempt(
  { resource_id, resource_type, manifest_version, backend, user_id = null, ip_hash = null, user_agent = null, requested_at },
  db = getVotesClient(),
) {
  await ensureVotesSchema(db);
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO install_attempts (id, resource_id, resource_type, manifest_version, backend, user_id, ip_hash, user_agent, requested_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, resource_id, resource_type, manifest_version, backend, user_id, ip_hash, user_agent, requested_at, new Date().toISOString()],
  });
  return id;
}

/** @param {string} id @param {boolean} success @param {number} duration_ms @param {number | null} exit_code @param {number} command_count @param {string | null} [error_category] @param {string | null} [error_message] @param {string | null} [log_sha256] */
export async function completeInstallAttempt(
  id, success, duration_ms, exit_code, command_count,
  error_category = null, error_message = null, log_sha256 = null, db = getVotesClient(),
) {
  await ensureVotesSchema(db);
  await db.execute({
    sql: `UPDATE install_attempts
          SET success = ?, duration_ms = ?, exit_code = ?, command_count = ?,
              error_category = ?, error_message = ?, log_sha256 = ?, completed_at = ?
          WHERE id = ?`,
    args: [success ? 1 : 0, duration_ms, exit_code, command_count, error_category, error_message, log_sha256, new Date().toISOString(), id],
  });
}

export async function addInstallCommands(attemptId, commands, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const batch = commands.map((cmd) => ({
    sql: `INSERT INTO install_commands (attempt_id, name, argv, exit_code, duration_ms, timed_out, output_bytes, sha256, failure_category, failure_detail, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [attemptId, cmd.name, JSON.stringify(cmd.argv), cmd.exit_code ?? null, cmd.duration_ms ?? null,
      cmd.timed_out ? 1 : 0, cmd.output_bytes ?? null, cmd.sha256 ?? null,
      cmd.failure_category ?? null, cmd.failure_detail ?? null, new Date().toISOString()],
  }));
  if (batch.length > 0) await db.batch(batch);
}

export async function getInstallAttempts(resourceId, page = 1, perPage = 10, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const totalRs = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM install_attempts WHERE resource_id = ?`,
    args: [resourceId],
  });
  const rs = await db.execute({
    sql: `SELECT * FROM install_attempts WHERE resource_id = ? ORDER BY requested_at DESC LIMIT ? OFFSET ?`,
    args: [resourceId, perPage, (page - 1) * perPage],
  });
  return { attempts: rs.rows, total: Number(totalRs.rows[0].n) };
}

export async function getUserInstalls(userId, page = 1, perPage = 10, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const totalRs = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM install_attempts WHERE user_id = ?`,
    args: [userId],
  });
  const rs = await db.execute({
    sql: `SELECT * FROM install_attempts WHERE user_id = ? ORDER BY requested_at DESC LIMIT ? OFFSET ?`,
    args: [userId, perPage, (page - 1) * perPage],
  });
  return { attempts: rs.rows, total: Number(totalRs.rows[0].n) };
}

/** Install stats computed live from attempts (no separate stats table to go stale). */
export async function getResourceInstallStats(resourceId, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const rs = await db.execute({
    sql: `SELECT COUNT(*) AS n, COALESCE(SUM(success), 0) AS ok, MAX(requested_at) AS last_at
          FROM install_attempts WHERE resource_id = ?`,
    args: [resourceId],
  });
  const row = rs.rows[0];
  const n = Number(row.n);
  return {
    install_count: n,
    install_success_rate: n > 0 ? Number(row.ok) / n : 0,
    last_installed_at: row.last_at,
  };
}

/**
 * Bulk aggregates for the whole registry (pipeline wiring): one query each
 * instead of N round-trips. Returns { [resource_id]: {average, count,
 * distribution} } for resources that have at least one vote.
 */
export async function getRatingStatsBulk(db = getVotesClient()) {
  await ensureVotesSchema(db);
  const totals = await db.execute(
    `SELECT resource_id, COUNT(*) AS n, AVG(score) AS avg FROM votes GROUP BY resource_id`,
  );
  const dist = await db.execute(
    `SELECT resource_id, score, COUNT(*) AS n FROM votes GROUP BY resource_id, score`,
  );
  const out = {};
  for (const row of totals.rows) {
    out[row.resource_id] = {
      average: Math.round(Number(row.avg) * 100) / 100,
      count: Number(row.n),
      distribution: {},
    };
  }
  for (const row of dist.rows) {
    if (out[row.resource_id]) out[row.resource_id].distribution[String(row.score)] = Number(row.n);
  }
  return out;
}

/**
 * Bulk install aggregates for the whole registry: { [resource_id]:
 * {count, success_rate, last_installed_at} } for resources with attempts.
 */
export async function getInstallStatsBulk(db = getVotesClient()) {
  await ensureVotesSchema(db);
  const rs = await db.execute(
    `SELECT resource_id, COUNT(*) AS n, COALESCE(SUM(success), 0) AS ok, MAX(requested_at) AS last_at
     FROM install_attempts GROUP BY resource_id`,
  );
  const out = {};
  for (const row of rs.rows) {
    const n = Number(row.n);
    out[row.resource_id] = {
      count: n,
      success_rate: n > 0 ? Number(row.ok) / n : 0,
      last_installed_at: row.last_at,
    };
  }
  return out;
}

/** Dashboard "my ratings": votes linked by the client-supplied user id, shaped like the old rows. */
export async function getVotesByUser(userId, page = 1, perPage = 10, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const totalRs = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM votes WHERE user_id = ?`,
    args: [userId],
  });
  const rs = await db.execute({
    sql: `SELECT resource_id, score AS rating, review_text, verified AS is_verified_install, user_id, created_at, updated_at
          FROM votes WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    args: [userId, perPage, (page - 1) * perPage],
  });
  const ratings = rs.rows.map((r) => ({ ...r, is_verified_install: r.is_verified_install === 1 }));
  const uniqueResources = new Set(rs.rows.map((r) => r.resource_id)).size;
  return { ratings, total: Number(totalRs.rows[0].n), uniqueResources };
}

// ---------------------------------------------------------------------------
// PUBLISHER WORKFLOW — same shapes and names as the retired store.

/** @param {string} resourceId @param {string} userId @param {Record<string, unknown> | null} [evidence] */
export async function createPublisherClaim(resourceId, userId, evidence = null, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO publisher_claims (id, resource_id, user_id, evidence, claimed_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [id, resourceId, userId, evidence ? JSON.stringify(evidence) : null, new Date().toISOString()],
  });
  return id;
}

export async function getPublisherClaimByResource(resourceId, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const rs = await db.execute({
    sql: `SELECT * FROM publisher_claims WHERE resource_id = ?`,
    args: [resourceId],
  });
  return rs.rows[0] ?? null;
}

export async function getPublisherClaimsByUser(userId, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const rs = await db.execute({
    sql: `SELECT * FROM publisher_claims WHERE user_id = ?`,
    args: [userId],
  });
  return rs.rows;
}

export async function verifyPublisherClaim(claimId, verified, db = getVotesClient()) {
  await ensureVotesSchema(db);
  await db.execute({
    sql: `UPDATE publisher_claims SET status = ?, verified_at = ? WHERE id = ?`,
    args: [verified ? 'verified' : 'rejected', verified ? new Date().toISOString() : null, claimId],
  });
}

export async function createResourceVersion(version, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO resource_versions (id, resource_id, version, manifest, changelog, published_at, published_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, version.resource_id, version.version, JSON.stringify(version.manifest),
      version.changelog ?? null, new Date().toISOString(), version.published_by],
  });
  return id;
}

export async function getResourceVersionsDb(resourceId, db = getVotesClient()) {
  await ensureVotesSchema(db);
  const rs = await db.execute({
    sql: `SELECT * FROM resource_versions WHERE resource_id = ? ORDER BY published_at DESC`,
    args: [resourceId],
  });
  return rs.rows.map((r) => ({ ...r, manifest: JSON.parse(r.manifest) }));
}
