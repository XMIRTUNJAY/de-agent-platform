#!/usr/bin/env node
/**
 * REFRESH-PROVENANCE — record upstream repo state per registry record.
 *
 * Explicit network command (like discover): fetches GitHub repo metadata
 * for the upstream repos behind github_url records and merges it into
 * data/curated/.cache/provenance.json, keyed by record id. One repo
 * failing never fails the run. Never runs during build.
 *
 * Flags:
 *   --repo <owner/name>   only refresh one repo
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readYamlList, CURATED, TYPED_DIRS } from './lib/load.mjs';
import { repoTargets, entryFor, unreachableEntry } from './lib/github-meta.mjs';
import { fetchJson } from './lib/fetch.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? true);
};
const ONLY = flag('repo');

const CACHE_PATH = join(CURATED, '.cache', 'provenance.json');

function readCache() {
  try {
    if (!existsSync(CACHE_PATH)) return {};
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  console.log('\n  \x1b[1mDE//AGENT provenance refresh\x1b[0m  \x1b[2m(network)\x1b[0m\n');
  const raw = [];
  for (const dir of Object.keys(TYPED_DIRS)) raw.push(...readYamlList(join(CURATED, dir)));
  const targets = repoTargets(raw);
  const repos = Object.keys(targets).filter((r) => !ONLY || r === ONLY).sort();
  if (ONLY && repos.length === 0) {
    console.log(`  no curated records point at ${ONLY}`);
    process.exit(2);
  }
  const cache = readCache();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let ok = 0, failed = 0, first = true;
  for (const repo of repos) {
    if (!first) await sleep(400);
    first = false;
    const checked_at = new Date().toISOString();
    const res = await fetchJson(`https://api.github.com/repos/${repo}`);
    if (res.ok && res.json) {
      const entry = entryFor(repo, res.json, checked_at);
      for (const id of targets[repo]) cache[id] = entry;
      console.log(`  \x1b[32m✓\x1b[0m \x1b[1m${repo.padEnd(32)}\x1b[0m \x1b[2mpushed ${entry.pushed_at ?? 'unknown'} · ${targets[repo].length} record(s)\x1b[0m`);
      ok++;
    } else {
      const entry = unreachableEntry(repo, res.status ?? res.error ?? 'unknown', checked_at);
      for (const id of targets[repo]) cache[id] = entry;
      console.log(`  \x1b[33m!\x1b[0m \x1b[1m${repo.padEnd(32)}\x1b[0m \x1b[2munreachable (${entry.error}) · recorded\x1b[0m`);
      failed++;
    }
  }
  mkdirSync(join(CURATED, '.cache'), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1) + '\n', 'utf8');
  console.log(`\n  ok ${ok} · unreachable ${failed} (recorded, run stays green) · cache ${CACHE_PATH}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
