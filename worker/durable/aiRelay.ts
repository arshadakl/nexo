/**
 * Region-pinned relay for AI provider calls.
 *
 * Workers run in whichever Cloudflare data centre handles the request. Google rejects Gemini API
 * calls from some of them (e.g. Hong Kong: "User location is not supported"). Requests sent through
 * this Durable Object egress from the region it was created in (location hint, see relay.ts).
 *
 * Only reachable through the AI_RELAY binding (never routed publicly), and only forwards HTTPS
 * requests to allow-listed provider hosts.
 */
const ALLOWED_HOSTS = new Set(['generativelanguage.googleapis.com']);

export class AIRelay {
  constructor(_state: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    let target: URL;
    try {
      target = new URL(request.headers.get('x-relay-target') || '');
    } catch {
      return new Response('Missing or invalid relay target', { status: 400 });
    }
    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
      return new Response('Relay target not allowed', { status: 403 });
    }

    const headers = new Headers(request.headers);
    headers.delete('x-relay-target');
    headers.delete('host');
    return fetch(target.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer(),
    });
  }
}
