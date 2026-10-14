import type { APIRoute } from 'astro';
import { z } from 'zod';
import registry from '@/data/generated/registry.json';

// Install result: receive execution result from CLI/pipeline
const InstallResultSchema = z.object({
  resource_id: z.string().min(1),
  manifest_version: z.string(),
  backend: z.enum(['dry', 'local', 'docker']),
  success: z.boolean(),
  duration_ms: z.number().int().min(0),
  exit_code: z.number().int().nullable(),
  commands: z.array(z.object({
    name: z.string(),
    exit_code: z.number().int().nullable(),
    duration_ms: z.number().int().min(0),
    timed_out: z.boolean().optional(),
    output_bytes: z.number().int().min(0).optional(),
    sha256: z.string().optional(),
    failure: z.object({
      category: z.string(),
      detail: z.string(),
    }).optional(),
  })).default([]),
  log_sha256: z.string().optional(),
  user_id: z.string().optional(),
  error_category: z.string().optional(),
  error_message: z.string().optional(),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const parsed = InstallResultSchema.parse(body);

    const resource = registry.resources.find(r => r.id === parsed.resource_id);
    if (!resource) {
      return new Response(JSON.stringify({ ok: false, error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update marketplace stats (in production: database)
    // For now: log structured event
    console.log('[MARKETPLACE_INSTALL_RESULT]', JSON.stringify({
      resource_id: parsed.resource_id,
      resource_type: resource.type,
      manifest_version: parsed.manifest_version,
      backend: parsed.backend,
      success: parsed.success,
      duration_ms: parsed.duration_ms,
      exit_code: parsed.exit_code,
      command_count: parsed.commands.length,
      commands: parsed.commands.map(c => ({
        name: c.name,
        exit_code: c.exit_code,
        duration_ms: c.duration_ms,
        timed_out: c.timed_out,
        sha256: c.sha256,
        failure_category: c.failure?.category,
      })),
      log_sha256: parsed.log_sha256,
      user_id: parsed.user_id,
      error_category: parsed.error_category,
      error_message: parsed.error_message,
      received_at: new Date().toISOString(),
    }));

    // If successful and backend is local/docker, this could generate evidence
    // For now just acknowledge
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
    console.error('[Marketplace Install Result] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};