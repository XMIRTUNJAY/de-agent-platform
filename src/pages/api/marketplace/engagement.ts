import type { APIRoute } from 'astro';
import { z } from 'zod';
import registry from '@/data/generated/registry.json';

// NOTE: votes-db is lazy-imported inside the handler (never top-level):
// database clients must not initialize during static prerender (`astro build`).

// First-party engagement counters (install clicks, copy clicks, detail views).
// Feeds the engagement slice of popularity. Day-bucketed, capped per IP in
// votes-db, so counter spam cannot move popularity far.
const EngagementSchema = z.object({
  resource_id: z.string().min(1),
  kind: z.enum(['install_click', 'install_copy', 'resource_view']),
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const { recordEngagement, ipHash } = await import('@/lib/votes-db.mjs');
    const parsed = EngagementSchema.parse(await request.json());

    const resource = (registry as any).resources.find((r: any) => r.id === parsed.resource_id);
    if (!resource) {
      return new Response(JSON.stringify({ ok: false, error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await recordEngagement({
      resource_id: parsed.resource_id,
      kind: parsed.kind,
      ip_hash: ipHash(clientAddress ?? 'unknown'),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid payload', details: err.issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('[Marketplace Engagement] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
