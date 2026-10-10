/**
 * PAGE-CENSUS — reconcile built pages against the registry.
 * Pure: given dist detail URLs and registry resource URLs, report
 * duplicates (same slug under two routes), orphans (built but unknown),
 * and missing (registered but unbuilt). Publishing decisions live in
 * eligibility.mjs; this module only reports facts.
 */
export function slugOf(url) {
  return String(url ?? '').replace(/\/+$/, '').split('/').pop() ?? '';
}

export function census(distDetailUrls, resourceUrls) {
  const norm = (u) => '/' + String(u ?? '').replace(/^\/+|\/+$/g, '') + '/';
  const dist = distDetailUrls.map(norm);
  const expected = new Set(resourceUrls.map(norm));
  const bySlug = new Map();
  for (const u of dist) {
    const s = slugOf(u);
    if (!bySlug.has(s)) bySlug.set(s, []);
    bySlug.get(s).push(u);
  }
  const duplicates = [...bySlug.entries()]
    .filter(([, urls]) => new Set(urls).size > 1)
    .map(([slug, urls]) => ({ slug, urls: [...new Set(urls)].sort() }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const orphans = dist.filter((u) => !expected.has(u)).sort();
  const missing = [...expected].filter((u) => !dist.includes(u)).sort();
  return { total: dist.length, duplicates, orphans, missing };
}
