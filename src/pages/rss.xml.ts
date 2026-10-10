import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import registry from '@/data/generated/registry.json';
import { SITE } from '@/site.config';

export function GET(context: APIContext) {
  const fallbackDate = new Date((registry as any).generated_at ?? new Date().toISOString());
  const items = [...registry.resources]
    .sort((a, b) => String(b.last_verified ?? '').localeCompare(String(a.last_verified ?? '')))
    .map((r: any) => ({
      title: r.title,
      description: r.description ?? r.summary ?? r.tagline ?? '',
      link: r.url.startsWith('http') ? undefined : r.url,
      pubDate: r.last_verified ? new Date(r.last_verified) : fallbackDate,
    }))
    .filter((i) => i.link);
  return rss({
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    site: context.site!,
    items,
  });
}
