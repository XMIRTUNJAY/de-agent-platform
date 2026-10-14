import type { APIRoute } from 'astro';

// NOTE: @/lib/db is lazy-imported inside the handler (never top-level):
// better-sqlite3's native init segfaults `astro build` static prerender.

export const GET: APIRoute = async ({ request }) => {
  try {
    const { getUserRatingsDb } = await import('@/lib/db');
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const perPage = Math.min(parseInt(url.searchParams.get('per_page') ?? '20', 10), 100);

    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: 'user_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { ratings, total } = getUserRatingsDb(userId, page, perPage);
    
    // Calculate unique resources rated
    const uniqueResources = new Set(ratings.map(r => r.resource_id)).size;

    return new Response(JSON.stringify({
      ok: true,
      ratings,
      pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      total,
      uniqueResources,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[User Ratings] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};