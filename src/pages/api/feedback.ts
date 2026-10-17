import type { APIRoute } from 'astro';
import { z } from 'zod';
export const prerender = false;

// Server-rendered on demand: without this flag, static-output dev treats the
// request as prerendered and astro strips the query string.

const FeedbackSchema = z.object({
  resource_id: z.string().min(1),
  helpful: z.enum(['yes', 'partial', 'no']),
  comment: z.string().max(2000).optional(),
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json();
    const parsed = FeedbackSchema.parse(body);

    // In production: write to database, GitHub Issues, or feedback service
    // For now: log structured JSON
    console.log('[FEEDBACK]', JSON.stringify({
      ...parsed,
      ip_hash: clientAddress ? hashIP(clientAddress) : undefined,
      user_agent: request.headers.get('user-agent'),
      received_at: new Date().toISOString(),
    }));

    // Optionally: create GitHub Issue if configured
    // await createGitHubIssue(parsed);

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
    console.error('[Feedback] Error:', err);
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