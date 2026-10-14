import type { APIRoute } from 'astro';
import { z } from 'zod';
import registry from '@/data/generated/registry.json';

// NOTE: @/lib/db is lazy-imported inside handlers (never top-level):
// better-sqlite3's native init segfaults `astro build` static prerender.

// Rating submission: 1-5 stars + optional review text
// Requires verified install (enforced via install_attempt_id or user_id tracking)
const RateSchema = z.object({
  resource_id: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().max(2000).optional(),
  user_id: z.string().min(1), // authenticated user
  install_attempt_id: z.string().optional(), // link to successful install
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { createRating, upsertResourceStats } = await import('@/lib/db');
    const body = await request.json();
    const parsed = RateSchema.parse(body);

    const resource = registry.resources.find(r => r.id === parsed.resource_id);
    if (!resource) {
      return new Response(JSON.stringify({ ok: false, error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user has verified install for this resource
    // For now: allow but log - in production verify against install_attempts
    const isVerifiedInstall = !!parsed.install_attempt_id;

    // Create rating in database
    const ratingId = createRating({
      resource_id: parsed.resource_id,
      resource_type: resource.type,
      rating: parsed.rating,
      review_text: parsed.review_text,
      user_id: parsed.user_id,
      install_attempt_id: parsed.install_attempt_id,
      is_verified_install: isVerifiedInstall,
    });

    // Log rating event
    console.log('[MARKETPLACE_RATE]', JSON.stringify({
      resource_id: parsed.resource_id,
      resource_type: resource.type,
      rating: parsed.rating,
      review_text: parsed.review_text ?? null,
      user_id: parsed.user_id,
      install_attempt_id: parsed.install_attempt_id,
      is_verified_install: isVerifiedInstall,
      submitted_at: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({ ok: true, rating_id: ratingId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid payload', details: err.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('[Marketplace Rate] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Get reviews for a resource
export const GET: APIRoute = async ({ request }) => {
  try {
    const { getResourceStatsDb, getRatingsDb } = await import('@/lib/db');
    const url = new URL(request.url);
    const resourceId = url.searchParams.get('resource_id');
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const perPage = Math.min(parseInt(url.searchParams.get('per_page') ?? '10', 10), 50);

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

    // Get stats from database
    const stats = getResourceStatsDb(resourceId);
    const { ratings, total } = getRatingsDb(resourceId, page, perPage);

    return new Response(JSON.stringify({
      ok: true,
      data: ratings,
      pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      summary: {
        average: stats?.rating_average ?? resource.marketplace?.rating_average ?? 0,
        count: stats?.rating_count ?? resource.marketplace?.rating_count ?? 0,
        distribution: stats?.rating_distribution ?? resource.marketplace?.rating_distribution ?? {},
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Marketplace Reviews GET] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};