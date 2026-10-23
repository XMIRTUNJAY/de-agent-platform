/**
 * GITHUB ENRICHMENT PIPELINE
 * Fetches GitHub metadata (stars, forks, contributors, issues) for resources with github_url
 * Updates the community score in marketplace metrics
 */

import { Octokit } from '@octokit/rest';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT } from './lib/load.mjs';

// GitHub API client (uses GITHUB_TOKEN from env if available)
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  throttle: { onRateLimit: (retryAfter, options) => {
    console.log(`[GitHub] Rate limited, waiting ${retryAfter}s...`);
    return true;
  }}
});

// Cache file
const CACHE_DIR = join(ROOT, 'data', 'cache', 'github');
const CACHE_FILE = join(CACHE_DIR, 'enrichment.json');

// Cache TTLs: positive entries refetch after 24h; negative (404/dead repo)
// entries retry after 7 days instead of hammering the API every run.
export const CACHE_TTL_HOURS = 24;
export const NEGATIVE_TTL_HOURS = 24 * 7;

/** True when `entry` is a positive cache record fetched within maxAgeHours. */
export function isCacheFresh(entry, maxAgeHours = CACHE_TTL_HOURS) {
  if (!entry || entry.missing || !entry.fetched_at) return false;
  const age = (Date.now() - new Date(entry.fetched_at).getTime()) / (1000 * 60 * 60);
  return Number.isFinite(age) && age >= 0 && age < maxAgeHours;
}

/** True when `entry` is a still-fresh negative (missing repo) record. */
export function isNegativeCacheFresh(entry, maxAgeHours = NEGATIVE_TTL_HOURS) {
  if (!entry?.missing || !entry.fetched_at) return false;
  const age = (Date.now() - new Date(entry.fetched_at).getTime()) / (1000 * 60 * 60);
  return Number.isFinite(age) && age >= 0 && age < maxAgeHours;
}

if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * @typedef {Object} GitHubRepoData
 * @property {number} stars
 * @property {number} forks
 * @property {number} watchers
 * @property {number} open_issues
 * @property {number} contributors_count
 * @property {number} recent_commits
 * @property {number} releases_count
 * @property {string|null} last_release_at
 * @property {string|null} license
 * @property {string} default_branch
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string} pushed_at
 */

/**
 * @typedef {Object} EnrichmentCache
 * @property {string} updated_at
 * @property {Record<string, GitHubRepoData>} repos
 */

function cacheFile(cacheDir) {
  return join(cacheDir ?? CACHE_DIR, 'enrichment.json');
}

function loadCache(cacheDir) {
  const file = cacheFile(cacheDir);
  if (existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return { updated_at: new Date().toISOString(), repos: {} };
    }
  }
  return { updated_at: new Date().toISOString(), repos: {} };
}

function saveCache(cache, cacheDir) {
  cache.updated_at = new Date().toISOString();
  const file = cacheFile(cacheDir);
  if (!existsSync(join(file, '..'))) mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8');
}

function parseGitHubUrl(url) {
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/,
    /github\.com\/([^\/]+)\/([^\/]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
  }
  return null;
}

/**
 * Contributor total without walking the list: with per_page=1 each page holds
 * exactly one contributor, so the rel="last" Link header page number IS the
 * total. Falls back to the returned page length for small repos (no Link).
 */
function countContributors(res) {
  const data = res?.data ?? [];
  if (data.length === 0) return 0;
  const link = res?.headers?.link ?? res?.headers?.Link;
  const last = link ? Number((link.match(/[?&]page=(\d+)>;\s*rel="last"/) || [])[1]) : NaN;
  return Number.isFinite(last) ? last : data.length;
}

async function fetchRepoData(owner, repo, kit = octokit) {
  try {
    // Get repo info
    const { data: repoData } = await kit.repos.get({ owner, repo });

    // Get contributors count (single per_page=1 call + Link header — the old
    // code discarded this response and paginate()ed the whole list, 30+ calls
    // on big repos).
    const contributorsRes = await kit.repos.listContributors({ owner, repo, per_page: 1 });
    const contributorsCount = countContributors(contributorsRes);

    // Get recent commits (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: commits } = await kit.repos.listCommits({ owner, repo, since, per_page: 100 });
    const recentCommits = commits.length;

    // Get releases
    const { data: releases } = await kit.repos.listReleases({ owner, repo, per_page: 10 });
    const releasesCount = releases.length;
    const lastReleaseAt = releases.length > 0 ? releases[0].published_at : null;

    return {
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      watchers: repoData.watchers_count,
      open_issues: repoData.open_issues_count,
      contributors_count: contributorsCount,
      recent_commits: recentCommits,
      releases_count: releasesCount,
      last_release_at: lastReleaseAt,
      license: repoData.license?.spdx_id ?? null,
      default_branch: repoData.default_branch,
      created_at: repoData.created_at,
      updated_at: repoData.updated_at,
      pushed_at: repoData.pushed_at,
    };
  } catch (err) {
    console.warn(`[GitHub] Failed to fetch ${owner}/${repo}:`, err.message);
    return null;
  }
}

function computeCommunityScore(repoData) {
  // Scoring weights for community dimension
  const weights = {
    stars: 0.30,
    forks: 0.15,
    contributors: 0.20,
    recent_activity: 0.20,
    releases: 0.10,
    issues_health: 0.05,
  };

  // Normalize each metric (log scale for stars/forks, linear for others)
  const normalized = {
    stars: Math.min(100, Math.log10(Math.max(1, repoData.stars)) * 25), // 10 stars=25, 100=50, 1000=75, 10000=100
    forks: Math.min(100, Math.log10(Math.max(1, repoData.forks)) * 30),
    contributors: Math.min(100, repoData.contributors_count * 5), // 20 contributors = 100
    recent_activity: Math.min(100, repoData.recent_commits * 2), // 50 commits/month = 100
    releases: Math.min(100, repoData.releases_count * 10), // 10 releases = 100
    issues_health: repoData.open_issues === 0 ? 100 : Math.max(0, 100 - repoData.open_issues * 2),
  };

  // Weighted score
  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    score += normalized[key] * weight;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

export async function enrichResources(resources, { fetchRepo = fetchRepoData, cacheDir } = {}) {
  const cache = loadCache(cacheDir);
  const resourcesWithGithub = resources.filter(r => r.github_url);

  console.log(`[GitHub Enrichment] Found ${resourcesWithGithub.length} resources with GitHub URLs`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const resource of resourcesWithGithub) {
    const parsed = parseGitHubUrl(resource.github_url);
    if (!parsed) {
      console.warn(`[GitHub] Could not parse URL: ${resource.github_url}`);
      failed++;
      continue;
    }

    const cacheKey = `${parsed.owner}/${parsed.repo}`;
    const cached = cache.repos[cacheKey];

    // Fresh negative entry: this repo 404'd recently — don't refetch, don't score.
    if (isNegativeCacheFresh(cached)) {
      failed++;
      continue;
    }

    // Fresh positive entry: score from cache, zero API calls.
    if (isCacheFresh(cached)) {
      resource.marketplace = resource.marketplace || {};
      resource.marketplace.quality_scores = resource.marketplace.quality_scores || {};
      resource.marketplace.quality_scores.community = computeCommunityScore(cached);
      skipped++;
      continue;
    }

    console.log(`[GitHub] Fetching ${cacheKey}...`);
    const repoData = await fetchRepo(parsed.owner, parsed.repo);

    if (repoData) {
      // fetched_at is OUR fetch time (the repo's updated_at is upstream's, and
      // using it made the 24h TTL never hit).
      cache.repos[cacheKey] = { ...repoData, fetched_at: new Date().toISOString() };
      resource.marketplace = resource.marketplace || {};
      resource.marketplace.quality_scores = resource.marketplace.quality_scores || {};
      resource.marketplace.quality_scores.community = computeCommunityScore(repoData);
      updated++;
    } else {
      // Negative cache so dead repos stop retrying every run (7-day TTL).
      cache.repos[cacheKey] = { missing: true, fetched_at: new Date().toISOString() };
      failed++;
    }

    // Rate limiting: small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  saveCache(cache, cacheDir);
  console.log(`[GitHub Enrichment] Updated: ${updated}, Cached: ${skipped}, Failed: ${failed}`);
}

// Main entry point
async function main() {
  console.log('[GitHub Enrichment] Starting...');
  
  // Load registry
  const registryPath = join(ROOT, 'src', 'data', 'generated', 'registry.json');
  if (!existsSync(registryPath)) {
    console.error('[GitHub Enrichment] Registry not found. Run pipeline first.');
    process.exit(1);
  }

  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  await enrichResources(registry.resources);
  
  // Write updated registry back
  writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
  console.log('[GitHub Enrichment] Complete!');
}

// Export for pipeline integration
export { fetchRepoData };

// Run standalone CLI mode only when invoked directly (node pipelines/github-enrichment.mjs),
// never on import — importing during run.mjs used to re-read the PREVIOUS build's
// registry.json and write it back after emit(), silently reverting the fresh build.
import { fileURLToPath, pathToFileURL } from 'node:url';
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch(err => {
    console.error('[GitHub Enrichment] Fatal error:', err);
    process.exit(1);
  });
}