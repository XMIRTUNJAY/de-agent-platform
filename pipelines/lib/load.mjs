/**
 * Loading layer for the registry pipeline.
 * Reads the curated YAML sources of truth. The public registry is *derived* —
 * nothing here is written by hand into the generated output.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CURATED = join(ROOT, 'data', 'curated');
export const GENERATED = join(ROOT, 'src', 'data', 'generated');
export const CACHE = join(CURATED, '.cache');

/** Sub-directory -> resource type produced by files inside it. */
export const TYPED_DIRS = {
  skills: 'skill',
  mcp: 'mcp',
  agents: 'agent',
  hooks: 'hook',
  plugins: 'plugin',
  templates: 'template',
  projects: 'starter',
  patterns: 'architecture',
  runbooks: 'runbook',
  references: 'reference',
  tutorials: 'tutorial',
  policies: 'policy',
  'rule-packs': 'rule_pack',
  'config-templates': 'config_template',
  'governance-packs': 'governance_pack',
};

export function readFileText(p) {
  return readFileSync(p, 'utf8');
}

export function readYaml(p) {
  const doc = parse(readFileText(p));
  return doc ?? null;
}

export function listYaml(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .filter((f) => statSync(join(dir, f)).isFile())
    .sort()
    .map((f) => join(dir, f));
}

/** Load every YAML file in a directory; each file is expected to be a list. */
export function readYamlList(dir) {
  const out = [];
  for (const f of listYaml(dir)) {
    const doc = readYaml(f);
    const items = Array.isArray(doc) ? doc : doc && typeof doc === 'object' ? Object.values(doc)[0] : [];
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      if (it && typeof it === 'object') out.push({ ...it, __source_file: f.replace(ROOT + '\\', '').replace(ROOT + '/', '') });
    }
  }
  return out;
}

export function loadAll() {
  const taxonomy = readYaml(join(CURATED, 'taxonomy.yaml')) ?? {};
  const roadmap = readYaml(join(CURATED, 'roadmap.yaml')) ?? {};
  const meta = readYaml(join(CURATED, 'registry-meta.yaml')) ?? {};

  const collections = {};
  const raw = [];
  for (const [dir, type] of Object.entries(TYPED_DIRS)) {
    const items = readYamlList(join(CURATED, dir)).map((it) => ({ ...it, type: it.type ?? type }));
    collections[dir] = items;
    raw.push(...items);
  }

  const provenance = existsSync(join(CACHE, 'provenance.json'))
    ? readYaml(join(CACHE, 'provenance.json'))
    : {};

  return { taxonomy, roadmap, meta, collections, raw, provenance };
}

export function ensureDir(p) {
  if (!existsSync(p)) readdirSync(dirname(p)); // touch parent read to fail loudly
  return p;
}

export { basename };
