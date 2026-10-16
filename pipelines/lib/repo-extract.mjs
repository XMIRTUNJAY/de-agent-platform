/**
 * REPO EXTRACT — lane 2 of discovery: pull the *installable surface* of a
 * repo, not just its summary.
 *
 * License-gated (curator decision): only SPDX allowlist below is extracted.
 * Everything else stays on the summarize-and-link lane. Extracted text is
 * always attributed and bounded; drafts never auto-publish (see auto-gates).
 */
import { fetchJson, fetchText } from './fetch.mjs';

export const EXTRACTABLE_LICENSES = new Set([
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0', 'Unlicense',
]);

const RAW = (owner, repo, branch, path) =>
  `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

export function parseRepoUrl(url) {
  const m = String(url).match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export async function fetchRepoMeta(owner, repo) {
  const res = await fetchJson(`https://api.github.com/repos/${owner}/${repo}`);
  if (!res.ok) return { ok: false, status: res.status };
  const j = res.json;
  return {
    ok: true,
    license: j.license?.spdx_id ?? 'NOASSERTION',
    stars: j.stargazers_count ?? 0,
    forks: j.forks_count ?? 0,
    branch: j.default_branch ?? 'main',
    description: j.description ?? '',
    topics: j.topics ?? [],
  };
}

export async function fetchRepoTree(owner, repo, branch) {
  const res = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  if (!res.ok) return { ok: false, status: res.status, truncated: true, paths: [] };
  const paths = (res.json.tree ?? []).filter((t) => t.type === 'blob').map((t) => t.path);
  return { ok: true, truncated: !!res.json.truncated, paths };
}

const SKILL_MARKERS = ['SKILL.md', 'skills/', '.claude/skills/', '.agents/skills/'];
const PLUGIN_MARKERS = ['.claude-plugin/plugin.json', 'plugin.json', 'manifest.json'];
const MCP_MARKERS = ['mcp', 'server.py', 'server.ts', 'server.js', 'src/index.ts'];

function hasMarker(paths, markers) {
  return markers.some((m) => paths.some((p) => p === m || p.includes(m)));
}

/** Best-effort type hint from repo layout; classifier still decides. */
export function hintTypeFromTree(paths) {
  if (hasMarker(paths, SKILL_MARKERS)) return 'skill';
  if (hasMarker(paths, PLUGIN_MARKERS)) return 'plugin';
  if (hasMarker(paths, MCP_MARKERS)) return 'mcp';
  return null;
}

/** Install section of a README: code blocks under install-ish headings, bounded. */
export function extractInstallSection(readme, maxChars = 2000) {
  if (!readme) return '';
  const lines = readme.split('\n');
  let capture = false;
  const out = [];
  for (const line of lines) {
    if (/^#{1,4}\s+/.test(line)) capture = /install|quick ?start|getting started/i.test(line);
    else if (capture) out.push(line);
    if (out.join('\n').length >= maxChars) break;
  }
  return out.join('\n').trim().slice(0, maxChars);
}

export function candidateInstallCommands(text) {
  const found = new Set();
  for (const m of String(text).matchAll(/(?:npm i(?:nstall)?(?: -g)?|npx|pip install|uv add|amp (?:skill|plugin) add|brew install)\s+[^\s`'"]+/g)) {
    found.add(m[0].slice(0, 120));
  }
  return [...found].slice(0, 5);
}

export async function fetchSkillDoc(owner, repo, branch, paths) {
  const skillPath = paths.find((p) => p === 'SKILL.md' || p.endsWith('/SKILL.md'));
  if (!skillPath) return '';
  const res = await fetchText(RAW(owner, repo, branch, skillPath));
  return res.ok ? String(res.text).slice(0, 8000) : '';
}

/**
 * Full lane-2 extraction for one repo URL. Returns { lane: 'extract', ... }
 * or { lane: 'summarize', reason } when the license gate or fetch fails.
 */
export async function extractRepo(url) {
  const parsed = parseRepoUrl(url);
  if (!parsed) return { lane: 'summarize', reason: 'not a github repo url' };
  const meta = await fetchRepoMeta(parsed.owner, parsed.repo);
  if (!meta.ok) return { lane: 'summarize', reason: `repo meta fetch failed (${meta.status})` };
  if (!EXTRACTABLE_LICENSES.has(meta.license)) {
    return { lane: 'summarize', reason: `license ${meta.license} not extractable` };
  }
  const tree = await fetchRepoTree(parsed.owner, parsed.repo, meta.branch);
  const paths = tree.paths ?? [];
  const readmeRes = await fetchText(RAW(parsed.owner, parsed.repo, meta.branch, 'README.md'));
  const readme = readmeRes.ok ? String(readmeRes.text).slice(0, 12000) : '';
  const installMd = extractInstallSection(readme);
  const skillDoc = await fetchSkillDoc(parsed.owner, parsed.repo, meta.branch, paths);
  return {
    lane: 'extract',
    license: meta.license,
    stars: meta.stars,
    forks: meta.forks,
    description: meta.description,
    topics: meta.topics,
    typeHint: hintTypeFromTree(paths),
    fileCount: paths.length,
    treeTruncated: tree.truncated,
    skillFiles: paths.filter((p) => p === 'SKILL.md' || p.endsWith('/SKILL.md')).slice(0, 10),
    installSection: installMd,
    installCandidates: candidateInstallCommands(`${installMd}\n${readme.slice(0, 3000)}`),
    skillDoc: skillDoc.slice(0, 4000),
  };
}
