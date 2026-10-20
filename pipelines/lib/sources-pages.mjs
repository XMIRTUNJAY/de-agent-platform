/**
 * SOURCES-PAGES — provenance pages for the discovery sources.
 * Every field from data/curated/sources.yaml + draft-contribution counts
 * derived from data/drafts/**. Missing health data is stated, never faked.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

// Astro builds run with cwd = project root (local + CI + Vercel), so repo
// paths resolve from cwd — import.meta.url breaks once bundled into dist/.
export const SOURCES_YAML = join(process.cwd(), 'data', 'curated', 'sources.yaml');
export const DRAFTS_DIR = join(process.cwd(), 'data', 'drafts');

const KIND_EXPLAIN = {
  rss: 'an RSS 2.0 feed — the publisher pushes new posts; we poll on cadence',
  atom: 'an Atom feed — same push model as RSS',
  'github-search': 'a GitHub repository search — new matching repos are classified as they appear',
  'github-org': "a GitHub organization's repo list — every new public repo is considered",
};

export function loadSources(path = SOURCES_YAML) {
  const doc = parseYaml(readFileSync(path, 'utf8')) ?? {};
  return doc.sources ?? [];
}

/** Count drafts per source id from data/drafts/**. */
export function draftCounts(dir = DRAFTS_DIR) {
  const counts = {};
  if (!existsSync(dir)) return counts;
  for (const group of readdirSync(dir)) {
    const d = join(dir, group);
    let files;
    try { files = readdirSync(d).filter((f) => f.endsWith('.yaml')); } catch { continue; }
    for (const f of files) {
      try {
        const doc = parseYaml(readFileSync(join(d, f), 'utf8'));
        const sid = doc?.provenance?.source ?? doc?.source ?? null;
        if (sid) counts[sid] = (counts[sid] ?? 0) + 1;
      } catch { /* skip malformed draft */ }
    }
  }
  return counts;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
const link = (url, text) => `<a href="${esc(url)}">${esc(text)}</a>`;

/** taxonomy category id -> route slug (cat-streaming -> streaming). Taxonomy
 *  and sources.yaml both load from data/curated, same cwd pattern. */
let CATEGORY_SLUGS = null;
function categorySlug(id) {
  if (!CATEGORY_SLUGS) {
    CATEGORY_SLUGS = new Map();
    try {
      const taxonomy = parseYaml(readFileSync(join(process.cwd(), 'data', 'curated', 'taxonomy.yaml'), 'utf8'));
      for (const c of taxonomy?.categories ?? []) if (c.id && c.slug) CATEGORY_SLUGS.set(c.id, c.slug);
    } catch { /* taxonomy unavailable — ids never become links */ }
  }
  return CATEGORY_SLUGS.get(String(id)) ?? null;
}

export function buildSourcePage(source, counts) {
  const drafts = counts[source.id] ?? 0;
  const sections = [];

  sections.push({
    id: 'identity',
    title: 'What this source is',
    html: `<p><strong>${esc(source.name)}</strong> enters the discovery pipeline as ${KIND_EXPLAIN[source.kind] ?? esc(source.kind)}. ` +
      `Content lands in <a href="/docs/ingestion">the ingestion pipeline</a>, where it is classified against the taxonomy and written to a human-reviewed draft queue — nothing auto-publishes.</p>`,
  });
  sections.push({
    id: 'cadence',
    title: 'Cadence, authority and routing',
    html: `<p>Fetched <strong>${esc(source.cadence ?? 'weekly')}</strong>. Authority weight <strong>${esc(String(source.authority ?? '—'))}/5</strong> feeds the source-quality score, so content from vetted publishers ranks higher before any human review. ` +
      (source.default_category
        ? (categorySlug(source.default_category)
          ? `Discovered items default to the <a href="/categories/${esc(categorySlug(source.default_category))}">${esc(source.default_category)}</a> category.</p>`
          : `Discovered items default to the <code>${esc(source.default_category)}</code> category (route pending).</p>`)
        : 'Discovered items are not yet routed to a default category.</p>'),
  });
  sections.push({
    id: 'contribution',
    title: 'Contribution to the registry',
    html: drafts > 0
      ? `<p><strong>${drafts}</strong> draft${drafts === 1 ? '' : 's'} discovered so far. Drafts become registry resources only after curator review — the count moves as the weekly discovery run finds new material.</p>`
      : `<p>No drafts recorded yet. New sources enter the rotation and produce drafts on their first successful fetches — absence here means <em>not yet crawled into a draft</em>, not absence of content.</p>`,
  });
  sections.push({
    id: 'verify',
    title: 'Verify against the source',
    html: `<p>Every registry claim should be checkable at its origin: <a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.url)}</a>. ` +
      `If this source ever becomes unreachable, it is skipped with a warning — the pipeline records the failure and the rest of the run continues.</p>`,
  });
  sections.push({
    id: 'pipeline',
    title: 'How discovery works',
    html: `<p><strong>FETCH → EXTRACT → CLASSIFY → DRAFT.</strong> A weekly GitHub Action runs the discovery loop, opens one PR per batch, and a human curator accepts, edits or rejects each item. Scores are computed, never hand-written — see <a href="/docs/scoring">the scoring model</a> and <a href="/docs/verification">verification levels</a>.</p>`,
  });

  return {
    slug: source.id,
    title: source.name,
    kind: source.kind,
    drafts,
    lede: `${source.kind} source · ${source.cadence ?? 'weekly'} cadence · ${drafts} draft${drafts === 1 ? '' : 's'} contributed`,
    sections,
  };
}
