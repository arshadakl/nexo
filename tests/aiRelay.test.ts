import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIRelay } from '../worker/durable/aiRelay';
import { configureAiRelay, relayFetch } from '../worker/adapters/ai/relay';

afterEach(() => {
  configureAiRelay(null);
  vi.unstubAllGlobals();
});

describe('AIRelay Durable Object', () => {
  const relay = new AIRelay({} as DurableObjectState, {});

  it('only forwards HTTPS requests to allow-listed provider hosts', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const blocked = await relay.fetch(
      new Request('https://ai-relay.internal/', { method: 'POST', headers: { 'x-relay-target': 'https://evil.example/steal' }, body: '{}' })
    );
    expect(blocked.status).toBe(403);
    expect((await relay.fetch(new Request('https://ai-relay.internal/', { method: 'POST', body: '{}' }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards Gemini requests without the relay header', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);
    const target = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
    const res = await relay.fetch(
      new Request('https://ai-relay.internal/', {
        method: 'POST',
        headers: { 'x-relay-target': target, 'x-goog-api-key': 'k' },
        body: '{"a":1}',
      })
    );
    expect(await res.json()).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(target);
    const headers = new Headers(init.headers);
    expect(headers.get('x-relay-target')).toBeNull();
    expect(headers.get('x-goog-api-key')).toBe('k');
  });
});

describe('relayFetch', () => {
  it('sends through the Western Europe relay when configured', async () => {
    const stubFetch = vi.fn(async () => new Response('relayed'));
    const namespace = {
      idFromName: vi.fn(() => 'id'),
      get: vi.fn(() => ({ fetch: stubFetch })),
    } as unknown as DurableObjectNamespace;
    configureAiRelay(namespace);

    const res = await relayFetch('https://generativelanguage.googleapis.com/x', { method: 'POST', body: '{}' });
    expect(await res.text()).toBe('relayed');
    expect(namespace.get).toHaveBeenCalledWith('id', { locationHint: 'weur' });
    const init = (stubFetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get('x-relay-target')).toBe('https://generativelanguage.googleapis.com/x');
  });

  it('calls the provider directly when no relay is configured', async () => {
    const fetchMock = vi.fn(async () => new Response('direct'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await (await relayFetch('https://example.test/', { method: 'POST' })).text()).toBe('direct');
  });
});
