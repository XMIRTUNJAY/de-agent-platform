#!/usr/bin/env node
/**
 * DISCOVER — the online loop. Fetches trusted sources, extracts items,
 * classifies them against the taxonomy, and writes draft YAML records to
 * data/drafts/ for human review.
 *
 *   FETCH → EXTRACT → CLASSIFY → DRAFT
 *
 * This command TOUCHES THE NETWORK and is never run implicitly during a
 * build (npm run build stays offline and deterministic). Run it manually or
 * from the weekly GitHub Action, which opens a PR per batch.
 *
 * Flags:
 *   --source <id>   only run one source
 *   --limit <n>     cap new drafts per source (default 10)
 *   --dry           print what would be drafted, write nothing
 */
import { loadSeen, saveSeen, loadSources, writeDraft, writeExtractDraft, draftExists } from './lib/drafts.mjs';
import { fetchText, fetchJson, fetchWithRetry } from './lib/fetch.mjs';
import { recordResult } from './lib/source-health.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseFeed } from './lib/feeds.mjs';
import { classifyRules, resolveClassification } from './lib/classify.mjs';
import { githubSearchItems, githubOrgItems } from './lib/github.mjs';
import { extractRepo } from './lib/repo-extract.mjs';
import { readYaml } from './lib/load.mjs';
import { ROOT } from './lib/load.mjs';

const HEALTH_PATH = join(ROOT, 'data', 'drafts', '.source-health.json');
const DEAD_LETTER_PATH = join(ROOT, 'data', 'cache', 'dead-letter.json');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1] ?? true;
};
const ONLY = flag('source');
const LIMIT = Number(flag('limit') ?? 10);
const DRY = !!args.includes('--dry');

async function main() {
  console.log('\n  \x1b[1mDE//AGENT discovery pipeline\x1b[0m  \x1b[2m(network)\x1b[0m\n');

  const sources = loadSources().filter((s) => !ONLY || s.id === ONLY);
  const taxonomy = readYaml(join(ROOT, 'data', 'curated', 'taxonomy.yaml')) ?? {};
  const seen = loadSeen();
  let health = readJson(HEALTH_PATH, {});

  const totals = { fetched: 0, skipped_sources: 0, seen: 0, drafted: 0, low_confidence: 0 };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let first = true;
  for (const source of sources) {
    // Politeness: spaces out requests so YouTube/GitHub don't throttle us.
    if (!first) await sleep(400);
    first = false;
    const result = await runSource(source, taxonomy, seen, totals);
    health = recordResult(health, source.id, result);
    if (!result.ok) {
      console.log(`  \x1b[33m!\x1b[0m \x1b[1m${source.id.padEnd(18)}\x1b[0m \x1b[2m${result.error}\x1b[0m`);
      totals.skipped_sources++;
      if (!DRY) appendDeadLetter(DEAD_LETTER_PATH, { source: source.id, kind: source.kind, url: source.url, error: result.error });
      continue;
    }
    console.log(
      `  \x1b[32m✓\x1b[0m \x1b[1m${source.id.padEnd(18)}\x1b[0m \x1b[2m${result.items} items · ${result.drafted} new drafts\x1b[0m`
    );
  }

  if (!DRY) {
    saveSeen(seen);
    writeJson(HEALTH_PATH, { generated_at: new Date().toISOString(), sources: health });
    emitSourceHealth(health);
  }

  console.log(
    `\n  fetched ${totals.fetched} · already seen ${totals.seen} · \x1b[1mdrafted ${totals.drafted}\x1b[0m` +
      ` · low-confidence (review first) ${totals.low_confidence} · sources skipped ${totals.skipped_sources}`
  );
  console.log(`  drafts are in \x1b[2mdata/drafts/\x1b[0m — review, then promote to \x1b[2mdata/curated/\x1b[0m\n`);

  if (DRY) console.log('  \x1b[34m(dry run — nothing written)\x1b[0m\n');
}

async function runSource(source, taxonomy, seen, totals) {
  if (source.kind === 'rss' || source.kind === 'atom') {
    const res = await fetchWithRetry(() => fetchText(source.url), { retries: 2, baseMs: 400 });
    if (!res.ok) return { ok: false, error: `fetch failed (${res.status ?? res.error ?? 'unknown'})` };
    const feed = parseFeed(res.body);
    if (!feed.ok) return { ok: false, error: `parse failed (${feed.error})` };
    return handleItems(source, feed.items, taxonomy, seen, totals);
  }

  if (source.kind === 'github-search' || source.kind === 'github-org') {
    const res = await fetchWithRetry(() => fetchJson(source.url), { retries: 2, baseMs: 400 });
    if (!res.ok) return { ok: false, error: `github api failed (${res.status ?? res.error ?? 'unknown'})` };
    const items =
      source.kind === 'github-search' ? githubSearchItems(res.json) : githubOrgItems(res.json);
    return handleItems(source, items, taxonomy, seen, totals);
  }

  return { ok: false, error: `unknown source kind: ${source.kind}` };
}

async function handleItems(source, items, taxonomy, seen, totals) {
  totals.fetched += items.length;
  let drafted = 0;

  for (const item of items.slice(0, 40)) {
    if (drafted >= LIMIT) break;
    if (!item.url || draftExists(seen, item.url)) {
      totals.seen++;
      continue;
    }
    let cls = classifyRules(item, taxonomy);
    // Source-level hints: only a fallback when the rules can't decide,
    // and only kept if the hinted category actually exists in the taxonomy.
    if (!cls.category && source.default_category) cls = { ...cls, category: source.default_category };
    cls = resolveClassification(cls, taxonomy);
    if (!cls.suggested_type && source.default_type) cls = { ...cls, suggested_type: source.default_type };
    if (cls.confidence === 'low') totals.low_confidence++;
    if (DRY) { drafted++; totals.drafted++; continue; }
    // Lane 2: github-kind items get the installable surface when the license
    // allows; anything else (or a failed/closed extraction) stays summarize-only.
    if (source.kind === 'github-search' || source.kind === 'github-org') {
      let extraction = null;
      try {
        extraction = await extractRepo(item.url);
      } catch { extraction = { lane: 'summarize', reason: 'extraction threw' }; }
      if (extraction && extraction.lane === 'extract') {
        // Repo layout beats keyword guessing: a SKILL.md on disk means skill.
        if (extraction.typeHint && (cls.type === 'reference' || cls.confidence === 'low')) {
          cls = { ...cls, type: extraction.typeHint, suggested_type: extraction.typeHint };
        }
        writeExtractDraft(seen, { source, item: capItem(item, source), classification: cls, extraction });
        drafted++;
        totals.drafted++;
        totals.extracted = (totals.extracted ?? 0) + 1;
        continue;
      }
      totals.summarized = (totals.summarized ?? 0) + 1;
    }
    writeDraft(seen, { source, item: capItem(item, source), classification: cls });
    drafted++;
    totals.drafted++;
  }
  return { ok: true, items: items.length, drafted };
}

// Legal guardrail: excerpts stay short. Body text is never stored.
function capItem(item, source) {
  const cap = source.usage === 'metadata-link' ? 200 : 300;
  return { ...item, summary: (item.summary ?? '').slice(0, cap) };
}

function readJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 1) + '\n', 'utf8');
}

function appendDeadLetter(path, entry) {
  const cur = readJson(path, []);
  cur.push({ at: new Date().toISOString(), ...entry });
  writeJson(path, cur.slice(-500));
}

// Published beside the registry so /admin/health can render per-source
// freshness without touching the registry contract.
function emitSourceHealth(health) {
  const payload = { generated_at: new Date().toISOString(), sources: health };
  for (const dir of [join(ROOT, 'src', 'data', 'generated'), join(ROOT, 'public', 'data', 'generated')]) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'source-health.json'), JSON.stringify(payload, null, 1) + '\n', 'utf8');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
