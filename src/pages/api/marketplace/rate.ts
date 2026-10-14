import type { APIRoute } from 'astro';
import { z } from 'zod';
import registry from '@/data/generated/registry.json';

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
    const body = await request.json();
    const parsed = RateSchema.parse(body);

    const resource = registry.resources.find(r => r.id === parsed.resource_id);
    if (!resource) {
      return new Response(JSON.stringify({ ok: false, error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // In production: check if user has verified install for this resource
    // For now: allow but log

    // Log rating event
    console.log('[MARKETPLACE_RATE]', JSON.stringify({
      resource_id: parsed.resource_id,
      resource_type: resource.type,
      rating: parsed.rating,
      review_text: parsed.review_text ?? null,
      user_id: parsed.user_id,
      install_attempt_id: parsed.install_attempt_id,
      submitted_at: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({ ok: true }), {
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

    // In production: query database for reviews
    // For now: return empty with metadata
    return new Response(JSON.stringify({
      ok: true,
      data: [],
      pagination: { page, per_page: perPage, total: 0, total_pages: 0 },
      summary: {
        average: resource.marketplace?.rating_average ?? 0,
        count: resource.marketplace?.rating_count ?? 0,
        distribution: resource.marketplace?.rating_distribution ?? {},
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