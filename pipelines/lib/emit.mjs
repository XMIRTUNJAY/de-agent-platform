/**
 * PUBLISH — write the generated registry, the search index and the knowledge
 * graph. Everything the site reads is produced here; nothing is hand-edited.
 */
import { writeFileSync, existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { GENERATED, ROOT } from './load.mjs';
import { buildSkillMd } from './skill-md.mjs';
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

  // Roadmap gaps ("upcoming" cards): stages without a tutorial, and stages
  // needing an original first. Read from committed briefs, not the registry —
  // gaps are intentions, and intentions must never become indexed pages.
  stats.roadmapGaps = buildRoadmapGaps(enriched, roadmap);

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
  atomicWrite(join(publicGenerated, 'search-index.json'), JSON.stringify(searchIndex, null, 0) + '\n', 'utf8');

  // Agent Skills files: one SKILL.md per installable skill, served statically
  // so every CLI installer (and the emanisha.in copy) can fetch them.
  // Content is assembled verbatim from record fields — see skill-md.mjs.
  const skillsDir = join(ROOT, 'public', 'skills');
  let skillsEmitted = 0;
  for (const r of enriched) {
    if (r.type !== 'skill' || !(r.install_command || (r.files ?? []).length > 0)) continue;
    const dir = join(skillsDir, r.slug);
    ensure(dir);
    atomicWrite(join(dir, 'SKILL.md'), buildSkillMd(r), 'utf8');
    skillsEmitted++;
  }

  return { generated_at, stats, skillsEmitted };
}

function ensure(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function buildRoadmapGaps(resources, roadmap) {
  const mainPath = roadmap?.roadmap?.main_path ?? roadmap?.main_path ?? [];
  const tutorialStages = new Set(
    resources.filter((r) => r.type === 'tutorial' && r.stage).map((r) => r.stage),
  );
  const originals = {};
  try {
    const dir = join(ROOT, 'data', 'drafts', 'creation');
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const text = readFileSync(join(dir, f), 'utf8');
      const stage = text.match(/^# stage: (\S+)/m)?.[1];
      const type = text.match(/^suggested_type: (\S+)/m)?.[1];
      if (stage) originals[stage] = type ?? 'skill';
    }
  } catch { /* no creation briefs yet — no gaps claimed */ }
  return mainPath
    .filter((stage) => !tutorialStages.has(stage))
    .map((stage) => ({ stage, needsOriginal: originals[stage] ?? null }));
}
/**
 * Crash-safe write: content lands at `<file>.tmp` first, then atomically
 * renames onto the final path. A mid-write crash can no longer leave a
 * truncated registry.json/search-index.json for the Astro build to consume.
 */
export function atomicWrite(file, data) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, data, 'utf8');
  renameSync(tmp, file);
}

function write(name, data) {
  atomicWrite(join(GENERATED, name), JSON.stringify(data, null, 0) + '\n', 'utf8');
}

function buildStats(resources, taxonomy) {
  const byType = {};
  const byDifficulty = {};
  const byVerification = {};
  const byStage = {};
  const byStageReading = {};
  const byCategory = {};
  let secure = 0;
  const SUBSTANCE_TYPES = new Set(['skill', 'mcp', 'plugin', 'agent', 'hook', 'template', 'starter', 'runbook', 'architecture', 'tutorial', 'policy', 'rule_pack', 'config_template', 'governance_pack']);
  for (const r of resources) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    if (r.difficulty) byDifficulty[r.difficulty] = (byDifficulty[r.difficulty] ?? 0) + 1;
    if (r.verification) byVerification[r.verification] = (byVerification[r.verification] ?? 0) + 1;
    if (r.stage) {
      if (SUBSTANCE_TYPES.has(r.type)) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
      else byStageReading[r.stage] = (byStageReading[r.stage] ?? 0) + 1;
    }
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
    byStageReading,
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
export function buildSearchIndex(resources, taxonomy) {
  return resources.map((r) => {
    // Long-tail search fields (objectives, symptoms, causes, when-to-use,
    // tech, tags) as a TRUNCATED keywords string. The old `text` blob
    // duplicated title/description/tags already present on the entry and
    // cost ~half the payload of search-index.json on every page view.
    const keywords = [
      ...(r.tags ?? []), ...(r.technologies ?? []).map(prettyTech),
      ...(r.learning_objectives ?? []), ...(r.symptoms ?? []),
      ...(r.possible_causes ?? []), ...(r.when_to_use ?? []),
    ].filter(Boolean).join(' ').slice(0, 200);
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
      keywords,
      url: r.url,
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
