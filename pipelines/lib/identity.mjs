/**
 * IDENTITY — canonical URL normalization, upstream repo identity, content
 * fingerprints, and duplicate-candidate grouping.
 *
 * Pure and offline: no network, no filesystem. Candidates are REPORTED for
 * curator review — nothing here merges, deletes, or rewrites records.
 * Same repo + different subpath (monorepo artifacts) is NOT a duplicate.
 */
import { createHash } from 'node:crypto';

export function normalizeUrl(url) {
  return String(url ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
}

/** Split a GitHub URL into host/owner/repo/subpath; null when not GitHub. */
export function repoIdentity(githubUrl) {
  const n = normalizeUrl(githubUrl);
  const m = n.match(/^github\.com\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
  if (!m) return null;
  return { host: 'github.com', owner: m[1], repo: m[2], subpath: m[3] ?? null };
}

/**
 * Artifact identity: the canonical content URL plus the upstream repo.
 * Two records from one monorepo share `repo` but differ in `url`/subpath,
 * so they stay distinct — an upstream project is not its extracted artifacts.
 */
export function artifactIdentity(r) {
  const url = normalizeUrl(r.source_url ?? r.url ?? '');
  const repo = repoIdentity(r.github_url ?? '');
  return { url: url || null, repo: repo ? `${repo.owner}/${repo.repo}` : null, subpath: repo?.subpath ?? null };
}

function collapse(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Short stable hash of type + title + description for exact-content matches. */
export function fingerprint(r) {
  return createHash('sha256').update(`${r.type ?? ''}|${collapse(r.title)}|${collapse(r.description)}`).digest('hex').slice(0, 16);
}

/**
 * Group candidate duplicates. Reasons: same-url, same-fingerprint,
 * possible-fork (same repo name, different owners — offline heuristic).
 */
export function findCandidates(resources) {
  const groups = [];
  const byKey = new Map();
  const add = (key, id, reason) => {
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, { key, reason, ids: [] });
    byKey.get(key).ids.push(id);
  };
  const seenFp = new Map();
  for (const r of resources) {
    const ident = artifactIdentity(r);
    if (ident.url) add(`url:${ident.url}`, r.id, 'same-url');
    const fp = fingerprint(r);
    if (seenFp.has(fp) && seenFp.get(fp) !== r.id) add(`fp:${fp}`, r.id, 'same-fingerprint');
    else if (!seenFp.has(fp)) seenFp.set(fp, r.id);
    if (seenFp.get(fp) !== r.id) byKey.get(`fp:${fp}`)?.ids.unshift(seenFp.get(fp));
  }
  for (const g of byKey.values()) {
    const ids = [...new Set(g.ids)];
    if (ids.length > 1) groups.push({ ...g, ids: ids.sort() });
  }
  // possible forks/mirrors (offline heuristic): same repo name under
  // different owners. Labeled candidate only — never merged.
  const byRepoName = new Map();
  for (const r of resources) {
    const repo = repoIdentity(r.github_url ?? '');
    if (!repo) continue;
    if (!byRepoName.has(repo.repo)) byRepoName.set(repo.repo, []);
    byRepoName.get(repo.repo).push({ owner: repo.owner, id: r.id });
  }
  for (const [name, list] of byRepoName) {
    if (new Set(list.map((e) => e.owner)).size > 1) {
      groups.push({ key: `fork:${name}`, reason: 'possible-fork', ids: [...new Set(list.map((e) => e.id))].sort() });
    }
  }
  return { groups: groups.sort((a, b) => a.key.localeCompare(b.key)), checked: resources.length };
}
