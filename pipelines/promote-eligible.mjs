#!/usr/bin/env node
/**
 * PROMOTE ELIGIBLE — the auto-publish step.
 *
 * Reads extract drafts (data/drafts/*), runs auto-gates (static + links),
 * and moves passing records into data/curated/<type>/. Failing drafts stay
 * put with reasons in data/drafts/.gate-reasons.json (gitignored).
 *
 * Promotion rules (all must hold):
 * - draft_kind 'extract', permissive license, 500+ words, full structure,
 *   install surface, beginner-friendly copy, secret-scan clean, links resolve
 * - docs-only: repos containing executables need human security review, always
 * - promoted records carry a complete security block + provenance trail
 *
 * Flags: --dry (report only) --limit <n>
 */
import { readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { ROOT, TYPED_DIRS, readYaml } from './lib/load.mjs';
import { DRAFTS } from './lib/drafts.mjs';
import { runStaticGates, runLinkGates } from './lib/auto-gates.mjs';
import { fetchText } from './lib/fetch.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true);
};
const DRY = flag('dry') === true;
const LIMIT = parseInt(flag('limit') ?? '10', 10);

const TYPE_TO_DIR = Object.fromEntries(Object.entries(TYPED_DIRS).map(([dir, type]) => [type, dir]));
const DAY = new Date().toISOString().slice(0, 10);

function listDrafts() {
  const out = [];
  if (!existsSync(DRAFTS)) return out;
  for (const sub of readdirSync(DRAFTS, { withFileTypes: true })) {
    if (!sub.isDirectory() || sub.name.startsWith('.')) continue;
    const dir = join(DRAFTS, sub.name);
    for (const f of readdirSync(dir)) {
      if (!/\.ya?ml$/.test(f)) continue;
      out.push(join(dir, f));
    }
  }
  return out.sort();
}

function toCurated(record) {
  const dir = TYPE_TO_DIR[record.type];
  if (!dir) return { ok: false, reason: `no curated dir for type "${record.type}"` };
  const { draft_kind, curation_state, install_candidates, skill_files, executables, ...kept } = record;
  const promoted = {
    ...kept,
    curation_state: 'auto-promoted',
    promoted_at: DAY,
    promoted_by: 'auto-gates',
    last_verified: DAY,
    // Valid ONLY because the executables gate passed above: docs-only skills
    // don't execute code. Anything else never reaches this line.
    security: {
      runs_code: false, network_access: false, credentials: false,
      filesystem_access: true, external_apis: false,
    },
  };
  const file = join(ROOT, 'data', 'curated', dir, `promoted-${record.slug}.yaml`);
  if (existsSync(file)) return { ok: false, reason: `already promoted (${basename(file)})` };
  return { ok: true, file, doc: stringify([promoted]) };
}

const reasons = {};
let promoted = 0;
let stayed = 0;

for (const file of listDrafts()) {
  if (promoted >= LIMIT) break;
  let docs;
  try {
    docs = readYaml(file);
  } catch { continue; }
  const records = Array.isArray(docs) ? docs : [docs];
  for (const record of records) {
    if (!record || record.curation_state !== 'draft' || record.draft_kind !== 'extract') continue;
    const staticRes = runStaticGates(record);
    const linkRes = staticRes.pass ? await runLinkGates(record, fetchText) : { pass: false, reasons: [] };
    const allReasons = [...staticRes.reasons, ...linkRes.reasons];
    if (record.executables !== false && record.type !== 'reference') {
      allReasons.push('repo contains executables — human security review required');
    }
    if (allReasons.length > 0) {
      reasons[record.id] = allReasons;
      stayed++;
      continue;
    }
    const target = toCurated(record);
    if (!target.ok) {
      reasons[record.id] = [target.reason];
      stayed++;
      continue;
    }
    if (!DRY) {
      writeFileSync(target.file, '# Auto-promoted by auto-gates — provenance in discovered_from.\n' + target.doc, 'utf8');
      rmSync(file);
    }
    promoted++;
    console.log(`[Promote] ${record.id} -> ${target.file}${DRY ? ' (dry)' : ''}`);
  }
}

if (!DRY) {
  writeFileSync(join(DRAFTS, '.gate-reasons.json'), JSON.stringify({ at: new Date().toISOString(), reasons }, null, 1) + '\n', 'utf8');
}
console.log(`[Promote] promoted: ${promoted}, stayed draft: ${stayed}${DRY ? ' (dry run)' : ''}`);
