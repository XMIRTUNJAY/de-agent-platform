import type { APIRoute } from 'astro';
export const prerender = false;

// NOTE: votes-db is lazy-imported inside the handler (never top-level):
// database clients must not initialize during static prerender (`astro build`).

export const GET: APIRoute = async ({ request }) => {
  try {
    const { getUserInstalls } = await import('@/lib/votes-db.mjs');
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

    const { attempts, total } = await getUserInstalls(userId, page, perPage);

    return new Response(JSON.stringify({
      ok: true,
      attempts,
      pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      total,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[User Installs] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};