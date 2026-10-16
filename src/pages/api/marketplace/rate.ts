import type { APIRoute } from 'astro';
import { z } from 'zod';
import registry from '@/data/generated/registry.json';
import { computePopularity } from '../../../../pipelines/lib/popularity.mjs';

// NOTE: votes-db is lazy-imported inside handlers (never top-level):
// database clients must not initialize during static prerender (`astro build`).
export const prerender = false;
// Durable store = libsql (Turso in prod, local file in dev) — better-sqlite3
// cannot persist on serverless (ephemeral filesystem).

// Rating submission: 1-5 stars + optional review text.
// Identity = server-side hash of (salt, IP, resource): one vote per voter per
// resource (repeats update), 10 votes/hour per IP. No login required.
const RateSchema = z.object({
  resource_id: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().max(2000).optional(),
  install_attempt_id: z.string().optional(), // link to successful install (verified flag)
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const { submitVote, voterHash, ipHash, countRecentVotes, getEngagementTotals } =
      await import('@/lib/votes-db.mjs');
    const body = await request.json();
    const parsed = RateSchema.parse(body);

    const resource = (registry as any).resources.find((r: any) => r.id === parsed.resource_id);
    if (!resource) {
      return new Response(JSON.stringify({ ok: false, error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ip = clientAddress ?? 'unknown';
    const ip_hash = ipHash(ip);
    if (await countRecentVotes(ip_hash, 1) >= 10) {
      return new Response(JSON.stringify({ ok: false, error: 'Rate limit: 10 votes/hour' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stats = await submitVote({
      resource_id: parsed.resource_id,
      score: parsed.rating,
      voter_hash: voterHash(ip, parsed.resource_id),
      ip_hash,
      review_text: parsed.review_text ?? null,
      verified: !!parsed.install_attempt_id,
    });

    const eng = await getEngagementTotals(parsed.resource_id);
    const mp = resource.marketplace ?? {};
    const popularity = computePopularity({
      community: mp?.popularity_inputs?.github_community ?? mp?.quality_scores?.community ?? 0,
      ratingAvg: stats.average,
      ratingCount: stats.count,
      installs: eng.installs,
      copies: eng.copies,
      views: eng.views,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        rating_average: stats.average,
        rating_count: stats.count,
        popularity,
        popularity_base: mp.popularity_base ?? null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid payload', details: err.issues }), {
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
    const { getRatingStats, getReviews } = await import('@/lib/votes-db.mjs');
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

    const resource = (registry as any).resources.find((r: any) => r.id === resourceId);
    if (!resource) {
      return new Response(JSON.stringify({ ok: false, error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const summary = await getRatingStats(resourceId);
    const { reviews, total } = await getReviews(resourceId, page, perPage);

    return new Response(
      JSON.stringify({
        ok: true,
        data: reviews,
        pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
        summary: {
          average: summary.average,
          count: summary.count,
          distribution: summary.distribution,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[Marketplace Reviews GET] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
