import type { APIRoute } from 'astro';
import { z } from 'zod';
import registry from '@/data/generated/registry.json';

// NOTE: votes-db is lazy-imported inside the handler (never top-level):
// database clients must not initialize during static prerender (`astro build`).
export const prerender = false;

// Install request: record an install attempt, return the manifest
const InstallRequestSchema = z.object({
  resource_id: z.string().min(1),
  manifest_version: z.string().optional(),
  backend: z.enum(['dry', 'local', 'docker']).default('dry'),
  user_id: z.string().optional(), // if authenticated
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { createInstallAttempt, completeInstallAttempt, addInstallCommands } = await import('@/lib/votes-db.mjs');
    const body = await request.json();
    const parsed = InstallRequestSchema.parse(body);

    const resource = registry.resources.find(r => r.id === parsed.resource_id);
    if (!resource) {
      return new Response(JSON.stringify({ ok: false, error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!resource.marketplace?.install_manifest) {
      return new Response(JSON.stringify({ ok: false, error: 'No install manifest available for this resource' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create install attempt record
    const attemptId = await createInstallAttempt({
      resource_id: parsed.resource_id,
      resource_type: resource.type,
      manifest_version: parsed.manifest_version ?? resource.marketplace.install_manifest.version,
      backend: parsed.backend,
      user_id: parsed.user_id,
      ip_hash: request.headers.get('x-forwarded-for') ? hashIP(request.headers.get('x-forwarded-for')!) : undefined,
      user_agent: request.headers.get('user-agent'),
      requested_at: new Date().toISOString(),
    });

    // Return the install manifest with attempt ID
    return new Response(JSON.stringify({
      ok: true,
      attempt_id: attemptId,
      manifest: resource.marketplace.install_manifest,
      resource: {
        id: resource.id,
        title: resource.title,
        type: resource.type,
        verification: resource.verification,
      },
    }), {
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
    console.error('[Marketplace Install] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i);
    hash |= 0;
  }
  return `ip_${Math.abs(hash).toString(36)}`;
}