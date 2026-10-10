#!/usr/bin/env node
/**
 * PROMOTE — the evidence-gated doorway from drafts to curated records.
 * Default is dry (verdict only, moves nothing). --apply moves the file.
 * A draft ships as community unless evidence for a higher claim rides
 * along; metadata_validated is attested by the pipeline at build, so the
 * gate asks only for the human checks behind each claimed level.
 */
import { existsSync, readFileSync, renameSync } from 'node:fs';
import { basename, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { REQUIRED } from './lib/evidence.mjs';
import { TYPED_DIRS, ROOT } from './lib/load.mjs';

const TYPES = new Set(Object.values(TYPED_DIRS));
const DIR_FOR = Object.fromEntries(Object.entries(TYPED_DIRS).map(([d, t]) => [t, d]));

function passedEvidence(draft, check) {
  return (draft.evidence ?? []).some((e) => e?.check === check && e?.status === 'passed');
}

export function checkPromotion(draft, ctx) {
  const errors = [];
  const warnings = [];
  const err = (code, detail) => errors.push({ code, detail });
  const warn = (code, detail) => warnings.push({ code, detail });

  for (const k of ['id', 'slug', 'type', 'title', 'description', 'category']) {
    if (draft[k] === undefined || draft[k] === null || draft[k] === '') err('missing-field', `missing required field "${k}"`);
  }
  if (draft.id && ctx.ids.has(draft.id)) err('duplicate-id', `id "${draft.id}" already in the registry`);
  if (draft.slug && ctx.slugs.has(draft.slug)) err('duplicate-slug', `slug "${draft.slug}" already in the registry`);
  if (draft.type && !TYPES.has(draft.type)) err('unknown-type', `unknown type "${draft.type}"`);
  if (draft.category && !ctx.catIds.has(draft.category)) err('unknown-category', `unknown category "${draft.category}"`);
  if (!draft.license) err('missing-license', 'records must declare a license (Proprietary allowed, link-and-summarise only)');
  else if (!ctx.licenseIds.has(draft.license) && !String(draft.license).startsWith('Proprietary')) err('unknown-license', `license "${draft.license}" not in the catalogue`);

  const descLen = typeof draft.description === 'string' ? draft.description.length : 0;
  if (descLen > 0 && descLen < 200) err('too-thin', `description is ${descLen} chars; promotion floor is 200 — expand before promoting`);

  const level = draft.verification ?? 'community';
  const needFor = { reviewed: REQUIRED.reviewed, tested: REQUIRED.tested, verified: REQUIRED.verified };
  if (needFor[level]) {
    const missing = needFor[level].filter((c) => c !== 'metadata_validated' && !passedEvidence(draft, c));
    if (missing.length) err('missing-evidence', `claimed ${level} needs passed evidence for: ${missing.join(', ')} (metadata_validated is attested at build)`);
  } else if (level !== 'community') {
    err('unknown-verification', `unknown verification "${level}"`);
  }

  if (descLen >= 200 && descLen < 500) warn('thin-but-passable', 'adequate but improvable — consider 500+ chars');
  if (!((draft.tags ?? []).length)) warn('no-tags', 'no tags — add at least one for discoverability');

  return { ok: errors.length === 0, errors, warnings };
}

function loadContext() {
  let reg, taxonomy, meta;
  try {
    reg = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'generated', 'registry.json'), 'utf8'));
    taxonomy = reg.taxonomy ?? {};
    meta = reg.meta ?? {};
  } catch {
    console.error('registry.json missing — run the pipeline first');
    process.exit(2);
  }
  return {
    ids: new Set((reg.resources ?? []).map((r) => r.id)),
    slugs: new Set((reg.resources ?? []).map((r) => r.slug)),
    catIds: new Set((taxonomy.categories ?? []).map((c) => c.id)),
    licenseIds: new Set((meta.licenses ?? []).map((l) => l.spdx)),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? null : (args[i + 1] ?? true);
  };
  const draftArg = flag('draft');
  const apply = args.includes('--apply');
  if (!draftArg) { console.error('usage: node pipelines/promote.mjs --draft <file> [--apply]'); process.exit(2); }
  const draftPath = resolve(ROOT, String(draftArg));
  if (relative(ROOT, draftPath).startsWith('..')) { console.error('draft must live under the repo root'); process.exit(2); }
  if (!existsSync(draftPath)) { console.error(`draft not found: ${draftArg}`); process.exit(2); }

  const doc = parse(readFileSync(draftPath, 'utf8'));
  const record = Array.isArray(doc) ? doc[0] : doc;
  if (!record || typeof record !== 'object') { console.error('draft is empty or invalid YAML'); process.exit(2); }

  const verdict = checkPromotion(record, loadContext());
  for (const e of verdict.errors) console.log(`  error [${e.code}] ${e.detail}`);
  for (const w of verdict.warnings) console.log(`  warning [${w.code}] ${w.detail}`);
  if (!verdict.ok) {
    console.log(`not promotable: ${verdict.errors.length} error(s)`);
    process.exit(1);
  }
  const target = join(ROOT, 'data', 'curated', DIR_FOR[record.type] ?? 'references', basename(draftPath));
  console.log(`ready to promote → ${target.replace(ROOT, '').replace(/^[\\/]/, '')}`);
  if (!apply) {
    console.log('(dry run — rerun with --apply to move the file)');
    process.exit(0);
  }
  if (existsSync(target)) { console.error(`refusing to overwrite ${target}`); process.exit(1); }
  renameSync(draftPath, target);
  console.log(`moved. next: node pipelines/run.mjs --check, then npm run build`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
