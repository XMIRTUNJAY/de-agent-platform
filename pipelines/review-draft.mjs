#!/usr/bin/env node
/**
 * REVIEW-DRAFT — score one draft file against the 16 prebuilt checks.
 * Prints a grouped report (and raw JSON with --json). Exit 1 on any fail
 * so agent retry loops have a machine signal. Reads only; moves nothing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { parse } from 'yaml';
import { reviewDraft } from './lib/review-checks.mjs';
import { ROOT } from './lib/load.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? true);
};
const draftArg = flag('draft');
const asJson = args.includes('--json');

if (!draftArg) { console.error('usage: node pipelines/review-draft.mjs --draft <file> [--json]'); process.exit(2); }
const draftPath = resolve(ROOT, String(draftArg));
if (relative(ROOT, draftPath).startsWith('..')) { console.error('draft must live under the repo root'); process.exit(2); }
if (!existsSync(draftPath)) { console.error(`draft not found: ${draftArg}`); process.exit(2); }

const doc = parse(readFileSync(draftPath, 'utf8'));
const record = Array.isArray(doc) ? doc[0] : doc;
if (!record || typeof record !== 'object') { console.error('draft is empty or invalid YAML'); process.exit(2); }

let ids = new Set();
try {
  const reg = JSON.parse(readFileSync(new URL('../src/data/generated/registry.json', import.meta.url), 'utf8'));
  ids = new Set((reg.resources ?? []).map((r) => r.id));
} catch {
  console.error('registry.json missing — run the pipeline first');
  process.exit(2);
}

const out = reviewDraft(record, { ids });
if (asJson) {
  console.log(JSON.stringify(out, null, 1));
} else {
  console.log(`draft ${record.id ?? '(no id)'} [${record.draft_kind ?? 'brief'}]: pass ${out.score.pass} · warn ${out.score.warn} · fail ${out.score.fail}`);
  for (const c of out.checks) console.log(`  [${c.status}] ${c.id} — ${c.detail}`);
}
process.exit(out.score.fail > 0 ? 1 : 0);
