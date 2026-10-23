/**
 * Sends AI provider requests through the region-pinned AIRelay Durable Object when the binding is
 * configured, otherwise directly. Configured once per invocation from the Worker entry point.
 */

// Western Europe: Gemini serves this region; some Cloudflare edge locations (e.g. HKG) are refused.
const RELAY_LOCATION: DurableObjectLocationHint = 'weur';
const RELAY_NAME = 'gemini-relay-weur';

let relayNamespace: DurableObjectNamespace | null = null;

export function configureAiRelay(namespace: DurableObjectNamespace | undefined | null) {
  relayNamespace = namespace ?? null;
}

export async function relayFetch(url: string, init: RequestInit): Promise<Response> {
  if (!relayNamespace) return fetch(url, init);
  const stub = relayNamespace.get(relayNamespace.idFromName(RELAY_NAME), { locationHint: RELAY_LOCATION });
  const headers = new Headers(init.headers);
  headers.set('x-relay-target', url);
  return stub.fetch('https://ai-relay.internal/', {
    method: init.method || 'POST',
    headers,
    body: init.body ?? null,
    ...(init.signal ? { signal: init.signal } : {}),
  });
}
