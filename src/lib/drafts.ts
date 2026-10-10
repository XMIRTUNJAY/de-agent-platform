/**
 * Build-time reader for data/drafts/ — powers the /admin/queue review page.
 * Drafts are never part of the registry; this only renders a review snapshot.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export interface Draft {
  id: string;
  slug: string;
  title: string;
  type: string;
  url: string;
  publisher: string;
  category: string | null;
  curation_state: string;
  confidence: string;
  suggested_categories: string[];
  source: string;
  published: string | null;
  file: string;
}

const DRAFTS = join(process.cwd(), 'data', 'drafts');

export function loadDrafts(): Draft[] {
  if (!existsSync(DRAFTS)) return [];
  const out: Draft[] = [];
  for (const sourceDir of readdirSync(DRAFTS, { withFileTypes: true })) {
    if (!sourceDir.isDirectory()) continue;
    const dir = join(DRAFTS, sourceDir.name);
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
      try {
        const items = parse(readFileSync(join(dir, f), 'utf8'));
        const first = Array.isArray(items) ? items[0] : items;
        if (!first?.id) continue;
        out.push({
          id: first.id,
          slug: first.slug,
          title: first.title,
          type: first.type ?? 'reference',
          url: first.source_url ?? first.url,
          publisher: first.publisher ?? sourceDir.name,
          category: first.category ?? null,
          curation_state: first.curation_state ?? 'draft',
          confidence: first.classification?.confidence ?? 'low',
          suggested_categories: first.classification?.suggested_categories ?? [],
          source: sourceDir.name,
          published: first.discovered_from?.published ?? null,
          file: `data/drafts/${sourceDir.name}/${f}`,
        });
      } catch {
        // unreadable draft — skip it, queue is informational
      }
    }
  }
  return out.sort((a, b) => String(b.published).localeCompare(String(a.published)));
}

export function groupByConfidence(drafts: Draft[]) {
  return {
    high: drafts.filter((d) => d.confidence === 'high'),
    medium: drafts.filter((d) => d.confidence === 'medium'),
    low: drafts.filter((d) => d.confidence === 'low'),
  };
}
