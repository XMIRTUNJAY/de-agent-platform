import type { APIRoute } from 'astro';
import registry from '@/data/generated/registry.json';

// Get marketplace stats for a resource
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const resourceId = url.searchParams.get('resource_id');

    if (!resourceId) {
      return new Response(JSON.stringify({ ok: false, error: 'resource_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resource = registry.resources.find(r => r.id === resourceId);
    if (!resource) {
      return new Response(JSON.stringify({ ok: false, error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mp = resource.marketplace ?? {};

    return new Response(JSON.stringify({
      ok: true,
      data: {
        resource_id: resource.id,
        resource_title: resource.title,
        resource_type: resource.type,
        verification: resource.verification,
        composite_score: mp.composite_score ?? 0,
        composite_label: mp.composite_label ?? 'unproven',
        quality_scores: mp.quality_scores ?? {},
        install_count: mp.install_count ?? 0,
        install_success_rate: mp.install_success_rate ?? 0,
        last_installed_at: mp.last_installed_at ?? null,
        rating_average: mp.rating_average ?? 0,
        rating_count: mp.rating_count ?? 0,
        rating_distribution: mp.rating_distribution ?? {},
        roadmap_stages: mp.roadmap_stages ?? [],
        roadmap_phase: mp.roadmap_phase ?? null,
        is_featured: mp.is_featured ?? false,
        is_official: mp.is_official ?? false,
        publisher_tier: mp.publisher_tier ?? 'community',
        has_install_manifest: !!mp.install_manifest,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Marketplace Stats] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};