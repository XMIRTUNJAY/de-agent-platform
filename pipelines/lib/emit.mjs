/**
 * PUBLISH — write the generated registry, the search index and the knowledge
 * graph. Everything the site reads is produced here; nothing is hand-edited.
 */
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GENERATED, ROOT } from './load.mjs';
import { isStale, stalenessDays } from './score.mjs';

export const ROUTE = {
  skill: 'skills', mcp: 'mcp', plugin: 'plugins', agent: 'agents', hook: 'hooks',
  template: 'templates', starter: 'projects', runbook: 'runbooks', architecture: 'patterns',
  reference: 'references', tutorial: 'tutorials', tool: 'tools', checklist: 'checklists',
};

export function routeFor(r) {
  return `/${ROUTE[r.type] ?? 'resources'}/${r.slug}`;
}

export function emit(ctx) {
  ensure(GENERATED);
  const { resources, taxonomy, roadmap, meta } = ctx;
  const now = new Date();
  const generated_at = now.toISOString();

  const enriched = resources.map((r) => ({
    ...r,
    url: routeFor(r),
    stale: isStale(r.last_verified, now),
    stale_days: stalenessDays(r.last_verified, now),
  }));

  const stats = buildStats(enriched, taxonomy);

  write('registry.json', {
    generated_at,
    counts: stats.counts,
    taxonomy,
    roadmap,
    meta,
    resources: enriched,
  });

  const searchIndex = { generated_at, entries: buildSearchIndex(enriched, taxonomy) };

  write('search-index.json', searchIndex);
  write('graph.json', buildGraph(enriched, taxonomy));
  write('stats.json', { generated_at, ...stats });

  // The command palette fetches the search index at runtime, so it must also be
  // served as a static asset — Astro only publishes public/.
  const publicGenerated = join(ROOT, 'public', 'data', 'generated');
  ensure(publicGenerated);
  writeFileSync(join(publicGenerated, 'search-index.json'), JSON.stringify(searchIndex, null, 0) + '\n', 'utf8');

  return { generated_at, stats };
}

function ensure(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
function write(name, data) {
  writeFileSync(join(GENERATED, name), JSON.stringify(data, null, 0) + '\n', 'utf8');
}

function buildStats(resources, taxonomy) {
  const byType = {};
  const byDifficulty = {};
  const byVerification = {};
  const byStage = {};
  const byCategory = {};
  let secure = 0;
  for (const r of resources) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    if (r.difficulty) byDifficulty[r.difficulty] = (byDifficulty[r.difficulty] ?? 0) + 1;
    byVerification[r.verification] = (byVerification[r.verification] ?? 0) + 1;
    if (r.stage) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
    if (r.category) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    if (!r.security_flags) secure++;
  }
  const verification_earned = {};
  let over_claims = 0;
  for (const r of resources) {
    const s = r.evidence_summary;
    if (!s) continue;
    verification_earned[s.earned] = (verification_earned[s.earned] ?? 0) + 1;
    if (s.gap > 0) over_claims++;
  }
  const eligibility = {};
  for (const r of resources) {
    const st = r.page_eligibility?.state ?? 'needs_review';
    eligibility[st] = (eligibility[st] ?? 0) + 1;
  }
  const freshness = { upstream_changed: 0, archived: 0, stale: 0 };
  for (const r of resources) {
    const f = r.freshness;
    if (!f) continue;
    if (f.upstream_changed) freshness.upstream_changed++;
    if (f.archived) freshness.archived++;
    if (f.stale) freshness.stale++;
  }
  const depth = { deep: 0, adequate: 0, thin: 0 };
  for (const r of resources) {
    if (r.depth) depth[r.depth.level] = (depth[r.depth.level] ?? 0) + 1;
  }
  return {
    counts: {
      total: resources.length,
      byType,
      byDifficulty,
      byVerification,
      categories: taxonomy.categories.length,
      technologies: taxonomy.technologies.length,
      stages: taxonomy.stages.length,
    },
    verification_earned,
    over_claims,
    eligibility,
    freshness,
    depth,
    byStage,
    byCategory,
    readability: {
      read_only: resources.filter((r) => !r.security_flags).length,
      touches_code: resources.filter((r) => r.security?.runs_code).length,
      needs_credentials: resources.filter((r) => r.security?.credentials).length,
      network: resources.filter((r) => r.security?.network_access).length,
    },
  };
}

/** A flat, self-contained index. Small enough to ship, rich enough to be useful. */
function buildSearchIndex(resources, taxonomy) {
  return resources.map((r) => {
    const text = [
      r.title, r.tagline, r.description, r.summary,
      ...(r.tags ?? []), ...(r.learning_objectives ?? []),
      ...(r.symptoms ?? []), ...(r.possible_causes ?? []),
      ...(r.when_to_use ?? []), r.categoryTitle,
      ...(r.technologies ?? []).map(prettyTech),
    ].filter(Boolean).join(' ');
    return {
      id: r.id,
      slug: r.slug,
      type: r.type,
      typeLabel: r.typeLabel,
      title: r.title,
      tagline: r.tagline,
      description: (r.description ?? r.summary ?? '').slice(0, 240),
      category: r.category,
      categoryTitle: r.categoryTitle,
      stage: r.stage,
      difficulty: r.difficulty,
      verification: r.verification,
      earned: r.evidence_summary?.earned ?? 'community',
      eligibility: r.page_eligibility?.state ?? 'needs_review',
      security_flags: r.security_flags,
      tags: r.tags ?? [],
      technologies: (r.technologies ?? []).map(prettyTech),
      url: r.url,
      text,
    };
  });
}

/** Nodes = resources + categories + technologies. Edges = the relationship model. */
function buildGraph(resources, taxonomy) {
  const nodes = [];
  const edges = [];
  const seen = new Set();
  const pushNode = (n) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n); } };

  for (const c of taxonomy.categories) pushNode({ id: c.id, kind: 'category', label: c.title, slug: c.slug, stage: c.stage, url: `/categories/${c.slug}` });
  for (const t of taxonomy.technologies) pushNode({ id: t.id, kind: 'technology', label: t.name, slug: t.slug, url: `/technologies/${t.slug}` });
  for (const r of resources) pushNode({ id: r.id, kind: 'resource', type: r.type, label: r.title, slug: r.slug, url: r.url, difficulty: r.difficulty, verification: r.verification });

  const addEdge = (from, to, rel) => { if (from && to && seen.has(from) && seen.has(to)) edges.push({ from, to, rel }); };
  for (const r of resources) {
    addEdge(r.id, r.category, 'in_category');
    for (const t of r.technologies ?? []) addEdge(r.id, t, 'uses');
    for (const [rel, list] of Object.entries(r.relationships ?? {})) for (const x of list) addEdge(r.id, x, rel);
    for (const p of r.prerequisites ?? []) addEdge(p, r.id, 'prerequisite_of');
    for (const key of ['skills', 'hooks', 'mcp']) for (const x of r[key] ?? []) addEdge(r.id, x, key === 'mcp' ? 'uses_mcp' : `includes_${key}`);
    for (const x of r.agent_skills ?? []) addEdge(r.id, x, 'uses_skill');
  }
  return { nodes, edges, counts: { nodes: nodes.length, edges: edges.length } };
}

function prettyTech(id) {
  return String(id).replace(/^tech-/, '').replace(/-/g, ' ');
}

export { readdirSync };
