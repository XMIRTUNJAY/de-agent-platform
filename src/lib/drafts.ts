/**
 * Build-time reader for data/drafts/ — powers the /admin/queue review page.
 * Drafts are never part of the registry; this only renders a review snapshot.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { reviewDraft, CHECKS } from '../../pipelines/lib/review-checks.mjs';

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
  extracted_at: string | null;
  age_days: number | null;
  has_body: boolean;
  body_words: number | null;
  review: { pass: number; warn: number; fail: number } | null;
}

const DRAFTS = join(process.cwd(), 'data', 'drafts');

const REGISTRY_JSON = join(process.cwd(), 'src', 'data', 'generated', 'registry.json');
const registryIds: Set<string> = new Set(
  existsSync(REGISTRY_JSON) ? (JSON.parse(readFileSync(REGISTRY_JSON, 'utf8')).resources ?? []).map((r: any) => r.id) : []
);
export const CHECK_TOTAL = CHECKS.length;

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
        const extracted_at = first.discovered_from?.extracted_at ?? null;
        const fileDate = f.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
        const anchor = extracted_at ?? fileDate;
        const parsed = anchor ? Date.parse(anchor) : NaN;
        const bodyText = String(first.body ?? '').trim();
        const draftKind = first.draft_kind ?? first.kind ?? first.type ?? 'brief';
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
          extracted_at,
          age_days: Number.isNaN(parsed) ? null : Math.floor((Date.now() - parsed) / 86400000),
          has_body: bodyText.length > 0,
          body_words: bodyText.length > 0 ? bodyText.split(/\s+/).length : null,
          review: (() => {
            try {
              const s = reviewDraft({ ...first, draft_kind: draftKind, body: first.body ?? '', related: first.related ?? [], description: first.description ?? '' }, { ids: registryIds });
              return { pass: s.score.pass, warn: s.score.warn, fail: s.score.fail };
            } catch {
              return null;
            }
          })(),
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
