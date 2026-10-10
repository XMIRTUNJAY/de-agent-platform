/**
 * GITHUB-META — pure mapping from registry records to upstream repos and
 * API payloads to provenance entries. Network lives in
 * refresh-provenance.mjs; nothing here fetches. Stars are never recorded:
 * activity is provenance, popularity is not a metric.
 */
import { repoIdentity } from './identity.mjs';

export function repoTargets(resources) {
  const out = {};
  for (const r of resources) {
    const repo = repoIdentity(r.github_url ?? '');
    if (!repo) continue;
    const key = `${repo.owner}/${repo.repo}`;
    if (!out[key]) out[key] = [];
    out[key].push(r.id);
  }
  return out;
}

export function entryFor(repo, api, checked_at) {
  return {
    checked_at, repo,
    pushed_at: api.pushed_at ?? null,
    archived: !!api.archived,
    default_branch: api.default_branch ?? null,
    stars: null,
  };
}

export function unreachableEntry(repo, error, checked_at) {
  return { checked_at, repo, unreachable: true, error: String(error ?? 'unknown') };
}
