import type { APIRoute } from 'astro';
import registry from '@/data/generated/registry.json';
import { computePopularity } from '../../../../pipelines/lib/popularity.mjs';

// NOTE: votes-db is lazy-imported inside the handler (never top-level):
// database clients must not initialize during static prerender (`astro build`).

// Get marketplace stats for a resource
// Server-rendered on demand: without this flag, static-output dev treats the
// request as prerendered and astro strips the query string (request.js
// `url.search = ''`), so resource_id never reaches the handler.
export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
  try {
    const { getInstallAttempts, getResourceInstallStats } = await import('@/lib/votes-db.mjs');
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
    const installStats = await getResourceInstallStats(resourceId);
    const { attempts: recentInstalls } = await getInstallAttempts(resourceId, 1, 5);

    // Live overlay: durable votes + engagement (Turso/file). If the votes DB
    // is unreachable (cold start, static copy), fall back to build snapshot.
    let live = null;
    try {
      const { getRatingStats, getEngagementTotals } = await import('@/lib/votes-db.mjs');
      const rating = await getRatingStats(resourceId);
      const eng = await getEngagementTotals(resourceId);
      const community =
        mp?.popularity_inputs?.github_community ?? mp?.quality_scores?.community ?? 0;
      live = {
        rating_average: rating.average,
        rating_count: rating.count,
        rating_distribution: rating.distribution,
        engagement: eng,
        popularity: computePopularity({
          community,
          ratingAvg: rating.average,
          ratingCount: rating.count,
          installs: eng.installs,
          copies: eng.copies,
          views: eng.views,
        }),
      };
    } catch (err) {
      console.warn('[Marketplace Stats] votes DB unreachable, using snapshot:', err);
    }

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
        install_count: installStats.install_count,
        install_success_rate: installStats.install_success_rate,
        last_installed_at: installStats.last_installed_at ?? mp.last_installed_at ?? null,
        rating_average: live?.rating_average ?? mp.rating_average ?? 0,
        rating_count: live?.rating_count ?? mp.rating_count ?? 0,
        rating_distribution: live?.rating_distribution ?? mp.rating_distribution ?? {},
        engagement: live?.engagement ?? { installs: 0, copies: 0, views: 0 },
        popularity: live?.popularity ?? mp.popularity_base ?? null,
        popularity_base: mp.popularity_base ?? null,
        roadmap_stages: mp.roadmap_stages ?? [],
        roadmap_phase: mp.roadmap_phase ?? null,
        is_featured: mp.is_featured ?? false,
        is_official: mp.is_official ?? false,
        publisher_tier: mp.publisher_tier ?? 'community',
        has_install_manifest: !!mp.install_manifest,
        recent_installs: recentInstalls.map((a: { id: string; backend: string | null; success: number; duration_ms: number | null; requested_at: string }) => ({
          id: a.id,
          backend: a.backend,
          success: a.success,
          duration_ms: a.duration_ms,
          requested_at: a.requested_at,
        })),
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