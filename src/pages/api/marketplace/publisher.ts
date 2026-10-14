import type { APIRoute } from 'astro';
import { z } from 'zod';
import registry from '@/data/generated/registry.json';

// NOTE: @/lib/db is lazy-imported inside handlers (never top-level):
// better-sqlite3's native init segfaults `astro build` static prerender.

// Publisher claim a resource
const ClaimSchema = z.object({
  resource_id: z.string().min(1),
  user_id: z.string().min(1),
  evidence: z.record(z.unknown()).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { createPublisherClaim, getPublisherClaimByResource } = await import('@/lib/db');
    const body = await request.json();
    const parsed = ClaimSchema.parse(body);

    const resource = registry.resources.find(r => r.id === parsed.resource_id);
    if (!resource) {
      return new Response(JSON.stringify({ ok: false, error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if already claimed
    const existing = getPublisherClaimByResource(parsed.resource_id);
    if (existing) {
      return new Response(JSON.stringify({ ok: false, error: 'Resource already claimed', claim: existing }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const claimId = createPublisherClaim(parsed.resource_id, parsed.user_id, parsed.evidence);

    return new Response(JSON.stringify({ 
      ok: true, 
      claim: { id: claimId, resource_id: parsed.resource_id, user_id: parsed.user_id, status: 'pending' }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid payload', details: err.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('[Publisher Claim] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Get publisher claims for a user
export const GET: APIRoute = async ({ request }) => {
  try {
    const { getPublisherClaimByResource, getPublisherClaimsByUser } = await import('@/lib/db');
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const resourceId = url.searchParams.get('resource_id');

    if (resourceId) {
      const claim = getPublisherClaimByResource(resourceId);
      return new Response(JSON.stringify({ ok: true, claim }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: 'user_id or resource_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const claims = getPublisherClaimsByUser(userId);
    return new Response(JSON.stringify({ ok: true, claims }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Publisher Claims GET] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Verify/reject a publisher claim (admin only)
const VerifyClaimSchema = z.object({
  claim_id: z.string().min(1),
  verified: z.boolean(),
});

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const { verifyPublisherClaim, createResourceVersion, getResourceVersionsDb } = await import('@/lib/db');
    const body = await request.json();
    const parsed = VerifyClaimSchema.parse(body);

    verifyPublisherClaim(parsed.claim_id, parsed.verified);

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
    console.error('[Publisher Claim Verify] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};