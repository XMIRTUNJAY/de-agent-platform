/**
 * CONTENT-DEPTH — pure functions for measuring resource content depth and
 * synthesizing category overviews. Grounding rule: every string produced by
 * synthesis is derived from real registry fields and counts — the generator
 * never invents capabilities, metrics, or resources.
 */

const HAS = (v) => v !== undefined && v !== null && String(v).trim().length > 0;

/**
 * Depth flags for one resource. Thin = missing the fields that make a detail
 * page actionable (why/when/prereqs/objectives) or too short to scan.
 */
export function depthFlags(r) {
  const flags = [];
  if (!HAS(r.description) || r.description.trim().length < 90) flags.push('short_description');
  if (!HAS(r.tagline) || r.tagline.trim().length < 40) flags.push('short_tagline');
  if (!HAS(r.purpose)) flags.push('no_purpose');
  if (!HAS(r.problem)) flags.push('no_problem');
  if (!r.prerequisites?.length) flags.push('no_prerequisites');
  if (!r.learning_objectives?.length) flags.push('no_learning_objectives');
  return flags;
}

/**
 * Depth score 0–100. Weights favour the fields that make a page useful for
 * real engineering work: why it exists, when to use it, what you need first.
 */
export function depthScore(r) {
  let score = 0;
  if (HAS(r.description) && r.description.trim().length >= 90) score += 30;
  else if (HAS(r.description)) score += 12;
  if (HAS(r.tagline) && r.tagline.trim().length >= 40) score += 15;
  else if (HAS(r.tagline)) score += 6;
  if (HAS(r.purpose)) score += 15;
  if (HAS(r.problem)) score += 15;
  if (r.prerequisites?.length) score += 10;
  if (r.learning_objectives?.length) score += 10;
  if (r.technologies?.length) score += 5;
  return score;
}

export const THIN_SCORE = 55;

export function thinResources(resources) {
  return resources
    .map((r) => ({ slug: r.slug, url: r.url, title: r.title, type: r.type, flags: depthFlags(r), score: depthScore(r) }))
    .filter((x) => x.score < THIN_SCORE)
    .sort((a, b) => a.score - b.score);
}

export function categoriesWithCounts(registry) {
  const byCat = {};
  for (const r of registry.resources) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
  return registry.taxonomy.categories.map((c) => ({ ...c, n: byCat[c.id] ?? 0 }));
}

/**
 * Composite score accessor — the registry's real ranking signal. Returns null
 * when absent (never fabricates a number for sorting).
 */
export function compositeOf(r) {
  return r.marketplace?.composite_score ?? r.scores?.composite ?? null;
}

/**
 * Grounded category overview. Every count, title, and URL comes from the
 * registry — the synthesis only phrases what is already true.
 */
export function synthesizeCategoryOverview(cat, resources, taxonomy) {
  const n = resources.length;
  const byType = {};
  for (const r of resources) byType[r.typeLabel] = (byType[r.typeLabel] ?? 0) + 1;
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const techNames = new Map((taxonomy.technologies ?? []).map((t) => [t.id, t.name]));
  const techs = [...new Set(resources.flatMap((r) => r.technologies ?? []))].map((id) => techNames.get(id) ?? null).filter(Boolean);
  const stageIds = [...new Set(resources.map((r) => r.stage).filter(Boolean))];
  const stageTitles = stageIds
    .map((id) => (taxonomy.stages ?? []).find((s) => s.id === id)?.title)
    .filter(Boolean);
  const byVerification = {};
  for (const r of resources) byVerification[r.verification] = (byVerification[r.verification] ?? 0) + 1;

  const typePhrase = types
    .slice(0, 3)
    .map(([label, count]) => `${count} ${label.toLowerCase()}${count === 1 ? '' : 's'}`)
    .join(', ');
  const typeSentence = n > 0 && types.length
    ? `It currently holds ${n} resource${n === 1 ? '' : 's'}: ${typePhrase}.`
    : '';

  const techSentence = techs.length
    ? `Technologies covered: ${techs.slice(0, 6).join(', ')}${techs.length > 6 ? ` and ${techs.length - 6} more` : ''}.`
    : '';

  const stageSentence = stageTitles.length
    ? `Mapped to roadmap stage${stageTitles.length === 1 ? '' : 's'}: ${stageTitles.slice(0, 3).join(', ')}.`
    : '';

  const verificationSentence = n > 0
    ? `Verification mix: ${Object.entries(byVerification).map(([v, c]) => `${c} ${v}`).join(', ')} — check each entry's evidence before adopting.`
    : '';

  const scored = resources
    .filter((r) => (r.page_eligibility?.state ?? 'eligible') !== 'internal_only')
    .map((r) => ({ title: r.title, url: r.url, composite: compositeOf(r) }))
    .filter((x) => typeof x.composite === 'number')
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 3);

  return {
    slug: cat.slug,
    generated_from: 'registry',
    counts: { resources: n, types: types.length, technologies: techs.length },
    intro: [typeSentence, techSentence, stageSentence, verificationSentence].filter(Boolean).join(' '),
    startHere: scored,
  };
}

/**
 * Honest empty-category notice: no fake inventory. Points to real adjacent
 * categories in the same roadmap stage that DO have resources.
 */
export function emptyCategoryAlternatives(cat, registry) {
  const withCounts = categoriesWithCounts(registry);
  const siblings = withCounts.filter((c) => c.stage === cat.stage && c.id !== cat.id && c.n > 0);
  return siblings
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map((c) => ({ title: c.title, slug: c.slug, n: c.n }));
}

/** Draft worksheet for a thin resource — real fields quoted, gaps marked TODO. */
export function renderDraftWorksheet(r, flags) {
  const lines = [];
  lines.push(`# Enrichment draft: ${r.title}`);
  lines.push('');
  lines.push(`- url: ${r.url}`);
  lines.push(`- type: ${r.typeLabel ?? r.type}`);
  lines.push(`- category: ${r.categoryTitle ?? r.category}`);
  if (r.difficulty) lines.push(`- difficulty: ${r.difficulty}`);
  if (r.technologies?.length) lines.push(`- technologies: ${r.technologies.join(', ')}`);
  if (r.source_url) lines.push(`- source: ${r.source_url}`);
  lines.push('');
  lines.push('## Current registry copy');
  if (HAS(r.tagline)) lines.push(`> tagline: ${r.tagline}`);
  if (HAS(r.description)) lines.push(`> description: ${r.description}`);
  lines.push('');
  lines.push('## Gaps to fill (edit the curated YAML, not this file)');
  for (const f of flags) {
    const field = {
      short_description: 'description',
      short_tagline: 'tagline',
      no_purpose: 'purpose (When/why to use it)',
      no_problem: 'problem (What failure or pain it prevents)',
      no_prerequisites: 'prerequisites',
      no_learning_objectives: 'learning_objectives',
    }[f] ?? f;
    lines.push(`- TODO ${field}`);
  }
  lines.push('');
  lines.push('Grounding rule: only state what the source repository and this registry actually support.');
  return lines.join('\n') + '\n';
}
