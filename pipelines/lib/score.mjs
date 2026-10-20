/**
 * SCORE — two transparent scores, computed never hand-written.
 *  - quality: the source quality score (references carry explicit components).
 *  - completeness: how much of the canonical object model a resource fills in
 *    (shared contract — completeness.mjs — so both score paths agree).
 * Plus a trust summary derived from the verification level and security flags.
 */
import { completenessFor } from './completeness.mjs';

const RANK = { community: 1, reviewed: 2, tested: 3, verified: 4 };

export function scoreAll(resources, meta) {
  const guide = meta.scoring?.guide ?? [];
  for (const r of resources) {
    r.scores = {
      quality: qualityScore(r),
      completeness: completenessFor(r),
      trust: trustScore(r),
    };
    r.scores.qualityLabel = labelFor(r.scores.quality, guide);
  }
  return resources;
}

function qualityScore(r) {
  const comps = r.quality && typeof r.quality === 'object' ? r.quality : null;
  if (!comps) return null;
  const vals = Object.values(comps).filter((v) => typeof v === 'number');
  if (!vals.length) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return round(sum / vals.length);
}

function trustScore(r) {
  const base = (RANK[r.verification] ?? 1) - 1; // 0..3
  const secPenalty = (r.security_flags ?? 0) * 0.5;
  const stale = isStale(r.last_verified);
  const raw = base + 1 - secPenalty * 0.4 - (stale ? 0.5 : 0);
  return round(Math.max(0, Math.min(5, raw * 1.25)));
}

export function isStale(lastVerified, now = new Date()) {
  if (!lastVerified) return true;
  const d = new Date(lastVerified);
  if (Number.isNaN(d.getTime())) return true;
  const days = (now - d) / 86400000;
  return days > 180;
}

export function stalenessDays(lastVerified, now = new Date()) {
  if (!lastVerified) return null;
  const d = new Date(lastVerified);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((now - d) / 86400000);
}

function labelFor(score, guide) {
  if (score === null || score === undefined) return null;
  for (const g of guide) if (score >= g.min) return g.label;
  return null;
}

function round(n) {
  return Math.round(n * 100) / 100;
}
