/**
 * DRAFTS — write discovered items as draft YAML records.
 *
 * ISOLATION CONTRACT: drafts live in data/drafts/ — load.mjs only ever reads
 * data/curated/, so an unreviewed draft physically cannot appear in the
 * published registry. Promotion = a human moves the record into data/curated/
 * (usually via the batch PR), bumps verification, deletes the draft.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { ROOT, readYaml } from './load.mjs';
import { normalizeUrl } from './identity.mjs';

export const DRAFTS = join(ROOT, 'data', 'drafts');
const SEEN_PATH = join(DRAFTS, '.seen.json');

export function loadSeen() {
  if (!existsSync(SEEN_PATH)) return { urls: {}, ids: {} };
  try {
    return JSON.parse(readFileSync(SEEN_PATH, 'utf8'));
  } catch {
    return { urls: {}, ids: {} };
  }
}

export function saveSeen(seen) {
  ensureDir(DRAFTS);
  writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 1) + '\n', 'utf8');
}

export function loadSources() {
  const doc = readYaml(join(ROOT, 'data', 'curated', 'sources.yaml')) ?? {};
  return doc.sources ?? [];
}

export function slugify(title) {
  const base = (title || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return base || 'item';
}

export function draftExists(seen, url) {
  const key = normalizeUrl(url);
  return !!seen.urls[key];
}

export function writeDraft(seen, { source, item, classification }) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(item.title);
  const id = `ref-${slug}`;

  // id collision → suffix deterministically
  let finalId = id;
  let n = 2;
  while (seen.ids[finalId]) finalId = `${id}-${n++}`;

  const record = {
    id: finalId,
    slug: finalId.replace(/^ref-/, ''),
    type: classification.type,
    title: item.title,
    description: item.summary
      ? item.summary.slice(0, 280)
      : `Summary pending review — see the source.`,
    category: classification.category,
    tags: [],
    url: item.url,
    publisher: source.name,
    kind: 'blog',
    why: null, // curator fills during review
    source_url: item.url,
    license: 'Proprietary',
    verification: 'community',
    curation_state: 'draft',
    discovered_from: { source: source.id, extracted_at: new Date().toISOString(), published: item.published ?? null },
    classification: {
      backend: 'rules',
      confidence: classification.confidence,
      suggested_categories: classification.suggested_categories,
      suggested_type: classification.suggested_type ?? null,
    },
  };

  const dir = join(DRAFTS, source.id);
  ensureDir(dir);
  const file = join(dir, `${date}-${record.slug}.yaml`);
  writeFileSync(file, '# DRAFT — not published. Review, then move to data/curated/references/.\n' + stringify([record]), 'utf8');

  seen.urls[normalizeUrl(item.url)] = { id: finalId, at: date };
  seen.ids[finalId] = file;
  return { id: finalId, file };
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}
