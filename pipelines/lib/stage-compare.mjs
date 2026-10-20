/**
 * STAGE+COMPARE — synthesis for /stages/[stage] and /compare/[category].
 * Same grounding contract as learn-topics: every section from real registry
 * fields; sections ship only with real content.
 */
const esc = (s) => String(s ?? '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
const link = (url, text) => `<a href="${esc(url)}">${esc(text)}</a>`;
import { compositeOf } from './content-depth.mjs';

function ranked(resources) {
  return resources
    .map((r) => ({ r, composite: compositeOf(r) }))
    .sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));
}

function typeCounts(resources) {
  const byType = {};
  for (const r of resources) byType[r.typeLabel] = (byType[r.typeLabel] ?? 0) + 1;
  return Object.entries(byType).sort((a, b) => b[1] - a[1]);
}

function table(ranked, { withDiff = true } = {}) {
  const head = `<thead><tr><th>Resource</th><th>Type</th>${withDiff ? '<th>Difficulty</th>' : ''}<th>Verification</th><th>Score</th></tr></thead>`;
  const rows = ranked.map(({ r, composite }) =>
    `<tr><td>${link(r.url, r.title)}</td><td>${esc(r.typeLabel)}</td>${withDiff ? `<td>${esc(r.difficulty ?? '—')}</td>` : ''}<td>${esc(r.verification)}</td><td class="font-mono">${composite ?? '—'}</td></tr>`);
  return `<div class="table-wrap"><table class="table">${head}<tbody>${rows.join('')}</tbody></table></div>`;
}

/** /stages/[stage] — deep roadmap stage page. */
export function buildStagePage(stageId, registry) {
  const stageData = registry.roadmap?.roadmap?.stages?.[stageId];
  const stage = (registry.taxonomy.stages ?? []).find((s) => s.id === stageId);
  if (!stageData || !stage) return null;
  const resources = registry.resources.filter((r) => r.stage === stageId);
  const cats = (registry.taxonomy.categories ?? []).filter((c) => c.stage === stageId);
  const withResources = cats.filter((c) => resources.some((r) => r.category === c.id));
  const typeCounts_ = typeCounts(resources);
  const order = stage.order ?? 0;
  const next = (registry.taxonomy.stages ?? []).filter((s) => (s.order ?? 0) > order).sort((a, b) => a.order - b.order)[0] ?? null;
  const prev = (registry.taxonomy.stages ?? []).filter((s) => (s.order ?? 0) < order).sort((a, b) => b.order - a.order)[0] ?? null;

  const sections = [];
  sections.push({
    id: 'overview',
    title: 'What this stage is',
    html: `<p><strong>${esc(stage.title)}</strong> is stage ${order} of 13 in the DE//AGENT roadmap. It currently holds <strong>${resources.length}</strong> resource${resources.length === 1 ? '' : 's'}` +
      `${typeCounts_.length ? `: ${typeCounts_.slice(0, 3).map(([t, c]) => `${c} ${esc(t.toLowerCase())}${c === 1 ? '' : 's'}`).join(', ')}` : ''} across ${withResources.length} categor${withResources.length === 1 ? 'y' : 'ies'}.</p>`,
  });
  if (stageData.teaches) {
    sections.push({ id: 'teaches', title: 'What it teaches', html: `<p>${esc(stageData.teaches)}</p>` });
  }
  if (stageData.can_do?.length) {
    sections.push({
      id: 'can-do',
      title: 'What you can do after this stage',
      html: `<ul>${stageData.can_do.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>`,
    });
  }
  if (stageData.gate) {
    sections.push({
      id: 'gate',
      title: 'Exit gate',
      html: `<p><strong>Gate:</strong> ${esc(stageData.gate)}${stageData.artifact ? ` The stage deliverable: ${registry.resources.some((r) => r.url === `/${stageData.artifact.replace(/^(.*?)-/, '$1/')}`) ? link(`/${stageData.artifact}`, stageData.artifact) : esc(stageData.artifact)}.` : ''}</p>` +
        `<p class="text-dim text-sm">Gates are self-assessed — the roadmap does not track your progress; it tells you what to be able to do before moving on.</p>`,
    });
  }
  if (withResources.length) {
    sections.push({
      id: 'categories',
      title: 'Categories in this stage',
      html: `<p>${withResources.map((c) => `${link(`/categories/${c.slug}`, c.title)} <span class="text-dim text-xs">(${resources.filter((r) => r.category === c.id).length})</span>`).join(', ')}</p>`,
    });
  }
  if (resources.length) {
    const rk = ranked(resources);
    sections.push({
      id: 'resources',
      title: 'Registry resources for this stage',
      html: `<p>Sorted by composite score — provenance, completeness and trust, per <a href="/docs/scoring">the scoring model</a>:</p>${table(rk)}`,
    });
    const objectives = [];
    const seen = new Set();
    for (const { r } of rk) for (const o of r.learning_objectives ?? []) {
      if (!seen.has(o.toLowerCase())) { seen.add(o.toLowerCase()); objectives.push(o); }
    }
    if (objectives.length) {
      sections.push({
        id: 'objectives',
        title: 'Documented learning objectives',
        html: `<ul>${objectives.slice(0, 8).map((o) => `<li>${esc(o)}</li>`).join('')}</ul>`,
      });
    }
  }
  const nav = [];
  if (prev) nav.push(`${link(`/stages/${prev.id}`, `← ${esc(prev.title)}`)}`);
  if (next) nav.push(`${link(`/stages/${next.id}`, `${esc(next.title)} →`)}`);
  if (nav.length) sections.push({ id: 'next', title: 'Continue the progression', html: `<p>${nav.join(' · ')}</p>` });

  return { slug: stageId, title: stage.title, order, n: resources.length, lede: `Stage ${order} of 13 · ${resources.length} resources · ${withResources.length} categories`, sections };
}

/** /learn-path/[category] — guided progression through a category. */
export function buildLearnPath(catSlugOrId, registry) {
  const cat = (registry.taxonomy.categories ?? []).find((c) => c.slug === catSlugOrId || c.id === catSlugOrId);
  if (!cat) return null;
  const resources = registry.resources.filter((r) => r.category === cat.id);
  if (!resources.length) return null;
  const rk = ranked(resources);
  const stages = (registry.taxonomy.stages ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const inStage = stages
    .map((s) => ({ s, rs: rk.filter(({ r }) => r.stage === s.id) }))
    .filter(({ rs }) => rs.length);
  const phase = inStage[0]?.s ? `Phase ${(inStage[0].s.order ?? 0) <= 4 ? 1 : inStage[0].s.order <= 7 ? 2 : inStage[0].s.order <= 10 ? 3 : 4}` : null;

  const sections = [];
  sections.push({
    id: 'path',
    title: 'The guided path',
    html: `<p>${esc(cat.summary ?? '')} This path sequences the category's <strong>${resources.length}</strong> resource${resources.length === 1 ? '' : 's'} by roadmap stage and composite score — work top-down inside each step.</p>` +
      inStage.map(({ s, rs }) => `<h3 style="margin-top:1.2rem;font-size:1.05rem;font-weight:600">${esc(s.title)}</h3><ol>${rs.slice(0, 6).map(({ r, composite }) =>
        `<li>${link(r.url, r.title)} <span class="font-mono text-dim text-xs">${composite ?? '—'}</span> — ${esc(r.tagline ?? r.title)}</li>`).join('')}</ol>` +
        (rs.length > 6 ? `<p class="text-dim text-sm">${rs.length - 6} more on the <a href="/categories/${esc(cat.slug)}">category page</a>.</p>` : '')).join(''),
  });
  const prereqs = [];
  const seenP = new Set();
  for (const { r } of rk) for (const p of r.prerequisites ?? []) {
    if (!seenP.has(p.toLowerCase())) { seenP.add(p.toLowerCase()); prereqs.push(p); }
  }
  if (prereqs.length) {
    sections.push({ id: 'prerequisites', title: 'Prerequisites across the path', html: `<p>Documented prerequisites, deduplicated: ${prereqs.slice(0, 8).map((p) => `<code class="icode">${esc(p)}</code>`).join(', ')}.</p>` });
  }
  const objectives = [];
  const seenO = new Set();
  for (const { r } of rk) for (const o of r.learning_objectives ?? []) {
    if (!seenO.has(o.toLowerCase())) { seenO.add(o.toLowerCase()); objectives.push(o); }
  }
  if (objectives.length) {
    sections.push({ id: 'objectives', title: 'What you will be able to do', html: `<ul>${objectives.slice(0, 8).map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` });
  }
  const flagged = rk.filter(({ r }) => (r.security_flags ?? 0) > 0);
  sections.push({
    id: 'cautions',
    title: 'Before you start',
    html: `<p>${flagged.length ? `<strong>Security-flagged:</strong> ${flagged.map(({ r }) => link(r.url, r.title)).join(', ')} — review the security posture first. ` : ''}Verification on these records: ${Object.entries(rk.reduce((m, { r }) => ({ ...m, [r.verification]: (m[r.verification] ?? 0) + 1 }), {})).map(([v, c]) => `${c} ${esc(v)}`).join(', ')}. Nothing here is independently audited — the <a href="/docs/trust-rules">trust scan</a> and your own review are the controls.</p>`,
  });
  const stagePage = inStage[0] ? link(`/stages/${inStage[0].s.id}`, inStage[0].s.title) : null;
  sections.push({
    id: 'context',
    title: 'Where this sits',
    html: `<p>${phase ? `${phase} of the roadmap. ` : ''}Stage context: ${stagePage ?? 'see the roadmap'} · ${link(`/compare/${cat.slug}`, 'side-by-side comparison')} · ${link('/learn', 'all learning topics')}</p>`,
  });

  return { slug: cat.slug, title: cat.title, n: resources.length, lede: `Guided path · ${inStage.length} stage${inStage.length === 1 ? '' : 's'} · ${resources.length} resources`, sections };
}
export function buildComparePage(catSlugOrId, registry) {
  const cat = (registry.taxonomy.categories ?? []).find((c) => c.slug === catSlugOrId || c.id === catSlugOrId);
  if (!cat) return null;
  const resources = registry.resources.filter((r) => r.category === cat.id && (r.page_eligibility?.state ?? 'eligible') !== 'internal_only');
  if (resources.length < 3) return null;
  const rk = ranked(resources);
  const typeCounts_ = typeCounts(resources);
  const verif = {};
  for (const r of resources) verif[r.verification] = (verif[r.verification] ?? 0) + 1;
  const flagged = rk.filter(({ r }) => (r.security_flags ?? 0) > 0);
  const gaps = rk.filter(({ r }) => (r.evidence_summary?.gap ?? 0) > 0);

  const sections = [];
  sections.push({
    id: 'overview',
    title: `Comparing ${resources.length} options`,
    html: `<p><strong>${esc(cat.title)}</strong> — ${cat.summary ?? ''} The registry currently holds <strong>${resources.length}</strong> resource${resources.length === 1 ? '' : 's'}${typeCounts_.length ? `: ${typeCounts_.map(([t, c]) => `${c} ${esc(t.toLowerCase())}${c === 1 ? '' : 's'}`).join(', ')}` : ''}.</p>`,
  });
  sections.push({
    id: 'table',
    title: 'Side by side',
    html: `<p>Every field below comes from the curated record — nothing is sponsored or ranked by payment:</p>${table(rk)}`,
  });
  sections.push({
    id: 'trust',
    title: 'Trust breakdown',
    html: `<p>Verification mix: ${Object.entries(verif).map(([v, c]) => `${c} ${esc(v)}`).join(', ')}. ` +
      `${gaps.length ? `${gaps.length} entr${gaps.length === 1 ? 'y' : 'ies'} claim more than the evidence on file supports — the gap is printed on each detail page.` : 'No evidence gaps: every claim on file matches the record.'} ` +
      `Read <a href="/docs/verification">how verification works</a> — nothing here is independently audited yet, and the site says so everywhere it matters.</p>`,
  });
  if (flagged.length) {
    sections.push({
      id: 'security',
      title: 'Security posture',
      html: `<p><strong>Flagged entr${flagged.length === 1 ? 'y' : 'ies'}:</strong> ${flagged.map(({ r }) => `${link(r.url, r.title)} (${r.security_flags})`).join(', ')}. Flags record declared capabilities (credentials, write access, network calls) — they are facts to review, not verdicts. Every entry also passes <a href="/docs/trust-rules">the 30-rule static trust scan</a>; findings print on each detail page.</p>`,
    });
  }
  const beginner = rk.filter(({ r }) => r.difficulty === 'beginner');
  const advanced = rk.filter(({ r }) => r.difficulty === 'advanced');
  let choose = `<p><strong>How to choose:</strong> `;
  if (beginner.length) choose += `start with ${beginner.slice(0, 2).map(({ r }) => link(r.url, r.title)).join(', ')} for the gentlest on-ramp; `;
  if (advanced.length) choose += `defer ${advanced.slice(0, 2).map(({ r }) => link(r.url, r.title)).join(', ')} until you have production context. `;
  choose += `Weight verification and evidence over score when two entries are close, and check the last-verified date on each page — the registry re-checks every 180 days.</p>`;
  sections.push({ id: 'choose', title: 'How to choose', html: choose });
  sections.push({
    id: 'related',
    title: 'Related',
    html: `<p>${link('/marketplace', 'Browse the full registry')} · ${link(`/categories/${cat.slug}`, `${cat.title} with filters`)} · ${link('/learn', 'All learning topics')}</p>`,
  });

  return { slug: cat.slug, title: cat.title, n: resources.length, lede: `${resources.length} options compared · ${typeCounts_.map(([t, c]) => `${c} ${t.toLowerCase()}`).join(', ')}`, sections };
}
