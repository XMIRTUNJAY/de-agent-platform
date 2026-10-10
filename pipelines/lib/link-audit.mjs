/**
 * LINK-AUDIT — offline integrity of the built site's own links.
 * Pure functions over dist HTML: internal hrefs must resolve to built
 * files, and the sitemap must cover exactly the eligible detail pages.
 * External links are never fetched here (no network in audits of the build).
 */
export function extractInternalLinks(html) {
  const out = [];
  const re = /href="([^"#]+?)"/g;
  let m;
  while ((m = re.exec(String(html ?? '')))) {
    const h = m[1];
    if (!h.startsWith('/')) continue;
    out.push(h.split('?')[0]);
  }
  return [...new Set(out)];
}

export function auditLinks(pages, known) {
  const broken = [];
  for (const p of pages) {
    for (const to of p.links) {
      const hit = known.has(to) || known.has(to.replace(/\/+$/, '') + '/') || known.has(to.replace(/\/+$/, ''));
      if (!hit) broken.push({ from: p.url, to });
    }
  }
  return { broken: broken.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)) };
}

const DETAIL_SEGMENTS = new Set(['skills', 'mcp', 'plugins', 'agents', 'hooks', 'templates', 'projects', 'runbooks', 'patterns', 'references', 'tutorials']);

export function sitemapCoverage(sitemapUrls, eligibleDetailUrls) {
  const norm = (u) => '/' + String(u).replace(/^\/+|\/+$/g, '') + '/';
  const sm = new Set(sitemapUrls.map(norm));
  const eligible = eligibleDetailUrls.map(norm);
  const uncovered = eligible.filter((u) => !sm.has(u)).sort();
  const eset = new Set(eligible);
  const extra = [...sm].filter((u) => {
    const segs = u.split('/').filter(Boolean);
    return segs.length >= 2 && DETAIL_SEGMENTS.has(segs[0]) && !eset.has(u);
  }).sort();
  return { uncovered, extra };
}
