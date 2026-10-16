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

/**
 * Extract draft: lane-2 output for permissively-licensed repos. Carries the
 * installable surface (commands, files, skill doc excerpt, repo stats) so
 * auto-gates and curators review substance, not just a link. Promotion path:
 * auto-gates pass → promote-eligible moves it to data/curated/<type>/.
 */
export function writeExtractDraft(seen, { source, item, classification, extraction }, outDir = DRAFTS) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(item.title);
  const id = `${classification.type === 'reference' ? 'ref-' : 'ext-'}${slug}`;

  let finalId = id;
  let n = 2;
  while (seen.ids[finalId]) finalId = `${id}-${n++}`;

  const installLine = (extraction.installCandidates ?? [])[0] ?? null;
  const record = {
    id: finalId,
    slug: finalId.replace(/^(ref|ext)-/, ''),
    type: classification.type,
    title: item.title,
    description: [
      extraction.description,
      extraction.installSection ? `Install (from source README):\n${extraction.installSection.slice(0, 600)}` : '',
    ].filter(Boolean).join('\n\n').slice(0, 1500) || `See the source repository.`,
    category: classification.category,
    tags: [...(extraction.topics ?? [])].slice(0, 8),
    url: item.url,
    publisher: source.name,
    source_url: item.url,
    github_url: item.url,
    license: extraction.license,
    install_command: installLine,
    install_candidates: extraction.installCandidates ?? [],
    skill_files: extraction.skillFiles ?? [],
    executables: extraction.executables ?? true,
    verification: 'community',
    curation_state: 'draft',
    draft_kind: 'extract',
    discovered_from: { source: source.id, extracted_at: new Date().toISOString(), lane: 'extract' },
  };

  const dir = join(outDir, source.id);
  ensureDir(dir);
  const file = join(dir, `${date}-${record.slug}.yaml`);
  writeFileSync(file, '# DRAFT extract — not published. Auto-gates or a curator promotes it.\n' + stringify([record]), 'utf8');

  seen.urls[normalizeUrl(item.url)] = { id: finalId, at: date };
  seen.ids[finalId] = file;
  return { id: finalId, file };
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
    draft_kind: 'brief', // agent upgrades to tutorial|guide|skill|reference|comparison when writing the body
    body: '', // agent-written content; empty until an agent fills it per agents/draft-writer/
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
