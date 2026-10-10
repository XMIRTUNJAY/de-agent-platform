/**
 * GITHUB — normalize GitHub API responses into feed-like items.
 * Two shapes: search API ({ items: [...] }) and org repo list ([...]).
 */

export function githubSearchItems(json) {
  const repos = json?.items ?? [];
  return repos.map(repoToItem).filter((i) => i.title && i.url);
}

export function githubOrgItems(json) {
  const repos = Array.isArray(json) ? json : [];
  return repos.map(repoToItem).filter((i) => i.title && i.url);
}

function repoToItem(r) {
  return {
    title: r.full_name ?? r.name,
    url: r.html_url,
    published: r.pushed_at ?? r.updated_at,
    summary: r.description ?? '',
  };
}
