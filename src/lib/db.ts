import Database from 'better-sqlite3';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Database file location (in production, use a persistent volume)
const DB_PATH = process.env.MARKETPLACE_DB_PATH 
  ? process.env.MARKETPLACE_DB_PATH 
  : join(homedir(), '.de-agent', 'marketplace.db');

// Ensure directory exists
import { mkdirSync } from 'node:fs';
const dbDir = join(homedir(), '.de-agent');
try { mkdirSync(dbDir, { recursive: true }); } catch {}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS install_attempts (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    manifest_version TEXT NOT NULL,
    backend TEXT NOT NULL CHECK (backend IN ('dry', 'local', 'docker')),
    user_id TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    requested_at TEXT NOT NULL,
    success BOOLEAN,
    duration_ms INTEGER,
    exit_code INTEGER,
    command_count INTEGER,
    error_category TEXT,
    error_message TEXT,
    log_sha256 TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_install_attempts_resource ON install_attempts(resource_id);
  CREATE INDEX IF NOT EXISTS idx_install_attempts_user ON install_attempts(user_id);
  CREATE INDEX IF NOT EXISTS idx_install_attempts_requested_at ON install_attempts(requested_at);

  CREATE TABLE IF NOT EXISTS install_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id TEXT NOT NULL REFERENCES install_attempts(id),
    name TEXT NOT NULL,
    argv TEXT NOT NULL, -- JSON array
    exit_code INTEGER,
    duration_ms INTEGER,
    timed_out BOOLEAN DEFAULT 0,
    output_bytes INTEGER,
    sha256 TEXT,
    failure_category TEXT,
    failure_detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_install_commands_attempt ON install_commands(attempt_id);

  CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    user_id TEXT NOT NULL,
    install_attempt_id TEXT REFERENCES install_attempts(id),
    is_verified_install BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ratings_resource ON ratings(resource_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON ratings(created_at);

  CREATE TABLE IF NOT EXISTS resource_stats (
    resource_id TEXT PRIMARY KEY,
    install_count INTEGER NOT NULL DEFAULT 0,
    install_success_count INTEGER NOT NULL DEFAULT 0,
    install_success_rate REAL NOT NULL DEFAULT 0,
    last_installed_at TEXT,
    rating_count INTEGER NOT NULL DEFAULT 0,
    rating_sum INTEGER NOT NULL DEFAULT 0,
    rating_average REAL NOT NULL DEFAULT 0,
    rating_distribution TEXT NOT NULL DEFAULT '{}', -- JSON: {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS publisher_claims (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
    verified_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    evidence TEXT -- JSON
  );

  CREATE INDEX IF NOT EXISTS idx_publisher_claims_user ON publisher_claims(user_id);

  CREATE TABLE IF NOT EXISTS resource_versions (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    version TEXT NOT NULL,
    manifest TEXT NOT NULL, -- JSON
    changelog TEXT,
    published_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_by TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_resource_versions_resource ON resource_versions(resource_id);
`);

// Prepared statements
const insertInstallAttempt = db.prepare(`
  INSERT INTO install_attempts (id, resource_id, resource_type, manifest_version, backend, user_id, ip_hash, user_agent, requested_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateInstallAttempt = db.prepare(`
  UPDATE install_attempts 
  SET success = ?, duration_ms = ?, exit_code = ?, command_count = ?, 
      error_category = ?, error_message = ?, log_sha256 = ?, completed_at = ?
  WHERE id = ?
`);

const insertInstallCommand = db.prepare(`
  INSERT INTO install_commands (attempt_id, name, argv, exit_code, duration_ms, timed_out, output_bytes, sha256, failure_category, failure_detail)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertRating = db.prepare(`
  INSERT INTO ratings (id, resource_id, resource_type, rating, review_text, user_id, install_attempt_id, is_verified_install)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const upsertResourceStats = db.prepare(`
  INSERT INTO resource_stats (resource_id, install_count, install_success_count, install_success_rate, last_installed_at, rating_count, rating_sum, rating_average, rating_distribution, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(resource_id) DO UPDATE SET
    install_count = install_count + excluded.install_count,
    install_success_count = install_success_count + excluded.install_success_count,
    install_success_rate = (install_success_count + excluded.install_success_count) * 1.0 / (install_count + excluded.install_count),
    last_installed_at = excluded.last_installed_at,
    rating_count = rating_count + excluded.rating_count,
    rating_sum = rating_sum + excluded.rating_sum,
    rating_average = (rating_sum + excluded.rating_sum) * 1.0 / (rating_count + excluded.rating_count),
    rating_distribution = json_patch(rating_distribution, excluded.rating_distribution),
    updated_at = datetime('now')
`);

const getResourceStats = db.prepare(`
  SELECT * FROM resource_stats WHERE resource_id = ?
`);

const getRatings = db.prepare(`
  SELECT * FROM ratings WHERE resource_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
`);

const getInstallAttempts = db.prepare(`
  SELECT * FROM install_attempts WHERE resource_id = ? ORDER BY requested_at DESC LIMIT ? OFFSET ?
`);

const getUserInstallAttempts = db.prepare(`
  SELECT * FROM install_attempts WHERE user_id = ? ORDER BY requested_at DESC LIMIT ? OFFSET ?
`);

const getUserRatings = db.prepare(`
  SELECT * FROM ratings WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
`);

const getPublisherClaims = db.prepare(`
  SELECT * FROM publisher_claims WHERE user_id = ?
`);

const insertPublisherClaim = db.prepare(`
  INSERT INTO publisher_claims (id, resource_id, user_id, evidence)
  VALUES (?, ?, ?, ?)
`);

const getPublisherClaim = db.prepare(`
  SELECT * FROM publisher_claims WHERE resource_id = ?
`);

const updatePublisherClaim = db.prepare(`
  UPDATE publisher_claims SET status = ?, verified_at = ? WHERE id = ?
`);

const insertResourceVersion = db.prepare(`
  INSERT INTO resource_versions (id, resource_id, version, manifest, changelog, published_by)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const getResourceVersions = db.prepare(`
  SELECT * FROM resource_versions WHERE resource_id = ? ORDER BY published_at DESC
`);

// Helper functions
function generateId(): string {
  return crypto.randomUUID();
}

export interface InstallAttempt {
  id: string;
  resource_id: string;
  resource_type: string;
  manifest_version: string;
  backend: 'dry' | 'local' | 'docker';
  user_id?: string;
  ip_hash?: string;
  user_agent?: string;
  requested_at: string;
  success?: boolean;
  duration_ms?: number;
  exit_code?: number;
  command_count?: number;
  error_category?: string;
  error_message?: string;
  log_sha256?: string;
  completed_at?: string;
}

export interface InstallCommand {
  id: number;
  attempt_id: string;
  name: string;
  argv: string[];
  exit_code?: number;
  duration_ms?: number;
  timed_out?: boolean;
  output_bytes?: number;
  sha256?: string;
  failure_category?: string;
  failure_detail?: string;
}

export interface Rating {
  id: string;
  resource_id: string;
  resource_type: string;
  rating: number;
  review_text?: string;
  user_id: string;
  install_attempt_id?: string;
  is_verified_install: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResourceStats {
  resource_id: string;
  install_count: number;
  install_success_count: number;
  install_success_rate: number;
  last_installed_at?: string;
  rating_count: number;
  rating_sum: number;
  rating_average: number;
  rating_distribution: Record<string, number>;
  updated_at: string;
}

export interface PublisherClaim {
  id: string;
  resource_id: string;
  user_id: string;
  claimed_at: string;
  verified_at?: string;
  status: 'pending' | 'verified' | 'rejected';
  evidence?: string;
}

export interface ResourceVersion {
  id: string;
  resource_id: string;
  version: string;
  manifest: any;
  changelog?: string;
  published_at: string;
  published_by: string;
}

// Database operations
export function createInstallAttempt(attempt: Omit<InstallAttempt, 'id'>): string {
  const id = generateId();
  insertInstallAttempt.run(
    id,
    attempt.resource_id,
    attempt.resource_type,
    attempt.manifest_version,
    attempt.backend,
    attempt.user_id ?? null,
    attempt.ip_hash ?? null,
    attempt.user_agent ?? null,
    attempt.requested_at
  );
  return id;
}

export function completeInstallAttempt(
  id: string,
  success: boolean,
  duration_ms: number,
  exit_code: number | null,
  command_count: number,
  error_category?: string,
  error_message?: string,
  log_sha256?: string
): void {
  updateInstallAttempt.run(
    success ? 1 : 0,
    duration_ms,
    exit_code,
    command_count,
    error_category ?? null,
    error_message ?? null,
    log_sha256 ?? null,
    new Date().toISOString(),
    id
  );
}

export function addInstallCommands(attemptId: string, commands: Omit<InstallCommand, 'id' | 'attempt_id'>[]): void {
  const insertMany = db.transaction((cmds) => {
    for (const cmd of cmds) {
      insertInstallCommand.run(
        attemptId,
        cmd.name,
        JSON.stringify(cmd.argv),
        cmd.exit_code ?? null,
        cmd.duration_ms ?? null,
        cmd.timed_out ? 1 : 0,
        cmd.output_bytes ?? null,
        cmd.sha256 ?? null,
        cmd.failure_category ?? null,
        cmd.failure_detail ?? null
      );
    }
  });
  insertMany(commands);
}

export function createRating(rating: Omit<Rating, 'id' | 'created_at' | 'updated_at'>): string {
  const id = generateId();
  const now = new Date().toISOString();
  
  const tx = db.transaction(() => {
    insertRating.run(
      id,
      rating.resource_id,
      rating.resource_type,
      rating.rating,
      rating.review_text ?? null,
      rating.user_id,
      rating.install_attempt_id ?? null,
      rating.is_verified_install ? 1 : 0
    );
    
    // Update resource stats
    const dist: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    dist[rating.rating.toString()] = 1;
    
    upsertResourceStats.run(
      rating.resource_id,
      0, 0, 0, null,
      1, rating.rating, rating.rating,
      JSON.stringify(dist)
    );
  });
  
  tx();
  return id;
}

export function getResourceStatsDb(resourceId: string): ResourceStats | null {
  const row = getResourceStats.get(resourceId) as any;
  if (!row) return null;
  return {
    ...row,
    rating_distribution: JSON.parse(row.rating_distribution || '{}')
  };
}

export function getRatingsDb(resourceId: string, page = 1, perPage = 10): { ratings: Rating[], total: number } {
  const total = db.prepare('SELECT COUNT(*) as count FROM ratings WHERE resource_id = ?').get(resourceId) as { count: number };
  const rows = getRatings.all(resourceId, perPage, (page - 1) * perPage) as Rating[];
  return { ratings: rows, total: total.count };
}

export function getInstallAttemptsDb(resourceId: string, page = 1, perPage = 10): { attempts: InstallAttempt[], total: number } {
  const total = db.prepare('SELECT COUNT(*) as count FROM install_attempts WHERE resource_id = ?').get(resourceId) as { count: number };
  const rows = getInstallAttempts.all(resourceId, perPage, (page - 1) * perPage) as InstallAttempt[];
  return { attempts: rows, total: total.count };
}

export function getUserInstalls(userId: string, page = 1, perPage = 10): { attempts: InstallAttempt[], total: number } {
  const total = db.prepare('SELECT COUNT(*) as count FROM install_attempts WHERE user_id = ?').get(userId) as { count: number };
  const rows = getUserInstallAttempts.all(userId, perPage, (page - 1) * perPage) as InstallAttempt[];
  return { attempts: rows, total: total.count };
}

export function getUserRatingsDb(userId: string, page = 1, perPage = 10): { ratings: Rating[], total: number } {
  const total = db.prepare('SELECT COUNT(*) as count FROM ratings WHERE user_id = ?').get(userId) as { count: number };
  const rows = getUserRatings.all(userId, perPage, (page - 1) * perPage) as Rating[];
  return { ratings: rows, total: total.count };
}

export function createPublisherClaim(resourceId: string, userId: string, evidence?: any): string {
  const id = generateId();
  insertPublisherClaim.run(id, resourceId, userId, evidence ? JSON.stringify(evidence) : null);
  return id;
}

export function getPublisherClaimByResource(resourceId: string): PublisherClaim | null {
  return getPublisherClaim.get(resourceId) as PublisherClaim | null;
}

export function getPublisherClaimsByUser(userId: string): PublisherClaim[] {
  return getPublisherClaims.all(userId) as PublisherClaim[];
}

export function verifyPublisherClaim(claimId: string, verified: boolean): void {
  updatePublisherClaim.run(verified ? 'verified' : 'rejected', verified ? new Date().toISOString() : null, claimId);
}

export function createResourceVersion(version: Omit<ResourceVersion, 'id' | 'published_at'>): string {
  const id = generateId();
  insertResourceVersion.run(
    id,
    version.resource_id,
    version.version,
    JSON.stringify(version.manifest),
    version.changelog ?? null,
    version.published_by
  );
  return id;
}

export function getResourceVersionsDb(resourceId: string): ResourceVersion[] {
  return getResourceVersions.all(resourceId) as ResourceVersion[];
}

// Export db for direct queries if needed
export { db };