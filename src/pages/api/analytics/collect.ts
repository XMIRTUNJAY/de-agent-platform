import type { APIRoute } from 'astro';
import { AllEventSchemas, type AnalyticsEvent, validateEvent } from '@de-agent/analytics/events';
import { z } from 'zod';

const CollectRequestSchema = z.object({
  events: z.array(AllEventSchemas).min(1).max(100),
  version: z.string().optional(),
});

// clientAddress needs a server-rendered route, even in dev.
export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!import.meta.env.PUBLIC_ANALYTICS_ENABLED === 'true') {
    return new Response(JSON.stringify({ ok: false, error: 'Analytics disabled' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const parsed = CollectRequestSchema.parse(body);

    const validatedEvents: AnalyticsEvent[] = [];
    for (const event of parsed.events) {
      try {
        validatedEvents.push(validateEvent(event));
      } catch (err) {
        console.warn('[Analytics] Invalid event:', err);
      }
    }

    if (validatedEvents.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'No valid events' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Enrich with server-side context
    const enriched = validatedEvents.map(e => ({
      ...e,
      server_context: {
        ip_hash: clientAddress ? hashIP(clientAddress) : undefined,
        received_at: new Date().toISOString(),
      },
    }));

    // Log to console (in production, write to file/DB/analytics service)
    for (const event of enriched) {
      logEvent(event);
    }

    return new Response(JSON.stringify({ ok: true, received: enriched.length }), {
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
    console.error('[Analytics] Collect error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function logEvent(event: AnalyticsEvent & { server_context?: any }): void {
  const line = JSON.stringify({
    event: event.event,
    timestamp: event.timestamp,
    session_id: event.session_id,
    user_id: event.user_id,
    workspace_id: event.workspace_id,
    anonymous_id: event.anonymous_id,
    properties: event.properties,
    context: event.context,
    server_context: event.server_context,
  });
  console.log(`[ANALYTICS] ${line}`);
}

function hashIP(ip: string): string {
  // Simple hash for privacy - not cryptographically secure but prevents raw IP storage
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i);
    hash |= 0;
  }
  return `ip_${Math.abs(hash).toString(36)}`;
}