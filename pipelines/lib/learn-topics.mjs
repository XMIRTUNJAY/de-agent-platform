/**
 * LEARN-TOPICS — synthesis engine behind /learn topic pages.
 *
 * Turns registry aggregations (technologies, tags) into deep, grounded
 * learning pages: every section is derived from real registry fields —
 * counts, objectives, stage mapping, comparison tables, install commands,
 * security cautions. Editorial glue phrases what the data already says;
 * nothing is invented. Sections ship only when they have real content.
 */
import { compositeOf } from './content-depth.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');

/** Slug for a topic: technologies use their taxonomy slug, tags slugify as-is. */
export function topicSlug(kind, key, technologies = []) {
  if (kind === 'technology') {
    return technologies.find((t) => t.id === key)?.slug ?? key.replace(/^tech-/, '');
  }
  return String(key).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Select topics worth a page: every technology used by ≥1 resource, plus
 * tags carried by ≥2 resources. Returns { slug, kind, key, title } with
 * technologies winning slug collisions.
 */
export function selectTopics(registry) {
  const techUse = {};
  for (const r of registry.resources) for (const t of r.technologies ?? []) techUse[t] = (techUse[t] ?? 0) + 1;
  const tagUse = {};
  for (const r of registry.resources) for (const t of r.tags ?? []) tagUse[t] = (tagUse[t] ?? 0) + 1;

  const topics = [];
  const bySlug = new Set();
  for (const t of registry.taxonomy.technologies ?? []) {
    if (!techUse[t.id]) continue;
    const slug = topicSlug('technology', t.id, registry.taxonomy.technologies);
    topics.push({ slug, kind: 'technology', key: t.id, title: t.name });
    bySlug.add(slug);
  }
  for (const [tag, n] of Object.entries(tagUse).sort((a, b) => b[1] - a[1])) {
    if (n < 2) continue;
    const slug = topicSlug('tag', tag);
    if (bySlug.has(slug)) continue;
    topics.push({ slug, kind: 'tag', key: tag, title: tag });
    bySlug.add(slug);
  }
  return topics;
}

export function resourcesForTopic(topic, registry) {
  if (topic.kind === 'technology') {
    return registry.resources.filter((r) => (r.technologies ?? []).includes(topic.key));
  }
  return registry.resources.filter((r) => (r.tags ?? []).includes(topic.key));
}

function typeCounts(resources) {
  const byType = {};
  for (const r of resources) byType[r.typeLabel] = (byType[r.typeLabel] ?? 0) + 1;
  return Object.entries(byType).sort((a, b) => b[1] - a[1]);
}

function stageMix(resources, taxonomy) {
  const stageIds = [...new Set(resources.map((r) => r.stage).filter(Boolean))];
  return stageIds
    .map((id) => {
      const s = (taxonomy.stages ?? []).find((x) => x.id === id);
      return s ? { id: s.id, title: s.title, n: resources.filter((r) => r.stage === s.id).length } : null;
    })
    .filter(Boolean);
}

function link(url, text) {
  return `<a href="${esc(url)}">${esc(text)}</a>`;
}

function chipRisk(resource) {
  const critFlags = resource.security_flags ?? 0;
  return critFlags > 0;
}

/**
 * Build the full topic page: title, lede, and 10 grounded sections.
 * Sections: overview, learn, roadmap, compare, start, fits, cautions,
 * use-cases, install, further.
 */
export function buildTopicPage(topic, registry) {
  const resources = resourcesForTopic(topic, registry);
  const n = resources.length;
  if (!n) return null;
  const stages = stageMix(resources, registry.taxonomy);
  const types = typeCounts(resources);
  const ranked = resources
    .map((r) => ({ r, composite: compositeOf(r) }))
    .sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));

  const sections = [];

  // 1 — overview
  const typePhrase = types.slice(0, 3).map(([t, c]) => `${c} ${t.toLowerCase()}${c === 1 ? '' : 's'}`).join(', ');
  sections.push({
    id: 'overview',
    title: `What this topic covers`,
    html: `<p>DE//AGENT currently lists <strong>${n}</strong> resource${n === 1 ? '' : 's'} under <strong>${esc(topic.title)}</strong>: ${typePhrase}. ` +
      `Everything below is derived from the live registry — counts, capabilities, verification state and security posture come from the curated records, never from marketing copy.</p>` +
      (types.length > 3 ? `<p class="text-dim text-sm">Also present: ${types.slice(3).map(([t, c]) => `${c} ${esc(t.toLowerCase())}${c === 1 ? '' : 's'}`).join(', ')}.</p>` : ''),
  });

  // 2 — what you'll learn
  const objectives = [];
  const seenObj = new Set();
  for (const { r } of ranked) {
    for (const o of r.learning_objectives ?? []) {
      const key = o.toLowerCase();
      if (!seenObj.has(key)) { seenObj.add(key); objectives.push({ text: o, from: r }); }
    }
  }
  if (objectives.length) {
    sections.push({
      id: 'learn',
      title: `What you can learn here`,
      html: `<p>Documented learning objectives across these resources:</p><ul>${objectives.slice(0, 8).map((o) =>
        `<li>${esc(o.text)} ${o.from ? `<span class="text-dim text-xs">— via ${link(o.from.url, o.from.title)}</span>` : ''}</li>`).join('')}</ul>` +
        (objectives.length > 8 ? `<p class="text-dim text-sm">${objectives.length - 8} more objectives live on the individual resource pages.</p>` : ''),
    });
  } else {
    sections.push({
      id: 'learn',
      title: `What you can learn here`,
      html: `<p>Learning objectives are not yet documented for these records — curation adds them evidence-first. What the entries cover today, from their own summaries:</p><ul>${ranked.slice(0, 5).map(({ r }) => `<li>${esc(r.tagline ?? r.summary ?? r.title)} ${link(r.url, r.title)}</li>`).join('')}</ul>`,
    });
  }

  // 3 — roadmap fit
  if (stages.length) {
    sections.push({
      id: 'roadmap',
      title: `Where this fits in the learning roadmap`,
      html: `<p>These resources map to ${stages.length === 1 ? 'stage' : 'stages'}: ${stages.map((s) => `${link(`/roadmap#${s.id}`, s.title)} (${s.n})`).join(', ')}. ` +
        `Follow the <a href="/roadmap">four-phase roadmap</a> to place this topic inside a progression instead of learning it in isolation.</p>`,
    });
  }

  // 4 — comparison table
  const rows = ranked.slice(0, 12).map(({ r, composite }) => {
    return `<tr><td>${link(r.url, r.title)}</td><td>${esc(r.typeLabel)}</td><td>${esc(r.difficulty ?? '—')}</td><td>${esc(r.verification)}${chipRisk(r) ? ' <span class="chip chip-warn" style="font-size:0.7em">flags</span>' : ''}</td><td class="font-mono">${composite ?? '—'}</td></tr>`;
  });
  sections.push({
    id: 'compare',
    title: `Compare the registry's options`,
    html: `<p>Every entry, its shape and its trust state — sorted by the registry's composite score. This table is the honest version of a marketing comparison: no sponsored placements, no unverifiable claims.</p>` +
      `<div class="table-wrap"><table class="table"><thead><tr><th>Resource</th><th>Type</th><th>Difficulty</th><th>Verification</th><th>Score</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` +
      (n > 12 ? `<p class="text-dim text-sm">${n - 12} more in the full list below.</p>` : '') +
      `<p class="text-dim text-sm">How scores are computed: <a href="/docs/scoring">source quality score</a>.</p>`,
  });

  // 5 — where to start
  const startable = ranked.filter(({ r, composite }) => composite !== null).slice(0, 3);
  if (startable.length) {
    sections.push({
      id: 'start',
      title: `Where to start`,
      html: `<p>Highest composite score first:</p><ol>${startable.map(({ r, composite }) =>
        `<li>${link(r.url, r.title)} <span class="font-mono text-dim text-xs">score ${composite}</span> — ${esc(r.difficulty ?? 'difficulty not documented')}</li>`).join('')}</ol>` +
        `<p class="text-dim text-sm">Scores rank provenance, completeness and trust — read <a href="/docs/verification">how verification works</a> before adopting anything.</p>`,
    });
  }

  // 6 — good fits
  const beginners = ranked.filter(({ r }) => r.difficulty === 'beginner').slice(0, 4);
  const advanced = ranked.filter(({ r }) => r.difficulty === 'advanced').slice(0, 3);
  let fits = '';
  if (beginners.length) fits += `<p><strong>Start here if you're new:</strong> ${beginners.map(({ r }) => link(r.url, r.title)).join(', ')}.</p>`;
  if (advanced.length) fits += `<p><strong>Reach for these with production experience:</strong> ${advanced.map(({ r }) => link(r.url, r.title)).join(', ')}.</p>`;
  if (fits) sections.push({ id: 'fits', title: `Good fits`, html: fits });

  // 7 — cautions
  const flagged = ranked.filter(({ r }) => chipRisk(r));
  const gaps = ranked.filter(({ r }) => (r.evidence_summary?.gap ?? 0) > 0);
  const whenNot = ranked.find(({ r }) => r.when_not)?.r;
  let cautions = '';
  if (flagged.length) {
    cautions += `<p><strong>Security-flagged entries:</strong> ${flagged.map(({ r }) => `${link(r.url, r.title)} (${r.security_flags} flag${r.security_flags === 1 ? '' : 's'})`).join(', ')}. Flags mean the record declares capabilities like credential use or write access — read the security posture on each page before connecting.</p>`;
  }
  if (gaps.length) {
    cautions += `<p><strong>Evidence gaps:</strong> ${gaps.length} of ${n} entries claim more than the evidence on file supports. The gap is printed on each detail page — treat unverified claims as the author's own.</p>`;
  }
  if (whenNot?.when_not) {
    cautions += `<p><strong>Known limits:</strong> ${esc(whenNot.when_not)} <span class="text-dim text-xs">(${esc(whenNot.title)})</span></p>`;
  }
  if (cautions) sections.push({ id: 'cautions', title: `Cautions and limitations`, html: cautions });

  // 8 — production use cases
  const cases = ranked
    .filter(({ r }) => (r.description && r.description.length > 90) || r.purpose)
    .slice(0, 4);
  if (cases.length) {
    sections.push({
      id: 'use-cases',
      title: `Production use cases`,
      html: `<ul>${cases.map(({ r }) => `<li><strong>${esc(r.title)}</strong> — ${esc(r.purpose ?? r.description.slice(0, 180) + (r.description.length > 180 ? '…' : ''))} ${link(r.url, 'details')}</li>`).join('')}</ul>`,
    });
  }

  // 9 — install & inspect
  const installable = ranked.filter(({ r }) => r.install_command && !(r.install_command ?? '').startsWith('#')).slice(0, 4);
  if (installable.length) {
    sections.push({
      id: 'install',
      title: `Install and inspect`,
      html: `<p>Real install commands from the registry — read the source before running any of them:</p>` +
        installable.map(({ r }) => `<div class="codeblock" style="margin-top:0.6rem"><pre><code>${esc(r.install_command)}</code></pre></div>` +
          `<p class="text-dim text-xs" style="margin-top:0.2rem">${esc(r.title)} — ${link(r.url, 'review first')}</p>`).join(''),
    });
  }

  // 10 — further study
  const tech = topic.kind === 'technology' ? (registry.taxonomy.technologies ?? []).find((t) => t.id === topic.key) : null;
  const related = selectTopics(registry)
    .filter((t) => t.slug !== topic.slug)
    .map((t) => ({ t, shared: resourcesForTopic(t, registry).filter((r) => resources.some((x) => x.url === r.url)).length }))
    .filter(({ shared }) => shared >= 2)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 6);
  let further = '';
  if (tech?.homepage) {
    further += `<p><strong>Official source:</strong> <a href="${esc(tech.homepage)}" target="_blank" rel="noopener">${esc(tech.name)}</a>${tech.license ? ` <span class="text-dim text-xs">(license: ${esc(tech.license)})</span>` : ''} — start there for the canonical documentation, then come back for the vetted registry entries.</p>`;
  }
  if (related.length) {
    further += `<p><strong>Adjacent topics:</strong> ${related.map(({ t, shared }) => `${link(`/learn/${t.slug}`, t.title)} <span class="text-dim text-xs">(${shared} shared)</span>`).join(', ')}.</p>`;
  }
  further += `<p><strong>Study path:</strong> ${link('/roadmap', 'the roadmap')} places this topic in a progression · ${link('/docs/scoring', 'the scoring model')} explains the numbers · ${link('/docs/trust-rules', 'the trust rule catalog')} shows every security check these entries passed through.</p>`;
  sections.push({ id: 'further', title: `Further study`, html: further });

  return {
    slug: topic.slug,
    kind: topic.kind,
    title: topic.title,
    n,
    lede: `${n} registry resource${n === 1 ? '' : 's'} · ${types.slice(0, 2).map(([t, c]) => `${c} ${t.toLowerCase()}${c === 1 ? '' : 's'}`).join(', ')}${stages.length ? ` · roadmap: ${stages.map((s) => s.title).join(', ')}` : ''}`,
    resources: ranked.slice(0, 12).map(({ r, composite }) => ({ title: r.title, url: r.url, type: r.typeLabel, composite })),
    sections,
  };
}
