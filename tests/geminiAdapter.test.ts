import { afterEach, describe, expect, it, vi } from 'vitest';
import { geminiAdapter, isGeminiNativeBaseUrl, toGeminiRequest } from '../worker/adapters/ai/gemini';
import { aiClientFor } from '../worker/adapters/ai';
import { openAiCompatibleAdapter } from '../worker/adapters/ai/openAiCompatible';
import type { DecryptedAIProviderConfig } from '../shared/types/ai.types';

const config: DecryptedAIProviderConfig = {
  id: 'p',
  tenantId: 't',
  name: 'Google Gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  apiKey: 'test-key',
  defaultModel: 'gemini-3.8-flash',
  temperature: 0.3,
  maxTokens: 1000,
};

const ok = (text: string) =>
  new Response(
    JSON.stringify({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'thinking…', thought: true }, { text }] } }],
    }),
    { status: 200 }
  );

afterEach(() => vi.unstubAllGlobals());

describe('Gemini adapter', () => {
  it('routes native Gemini URLs to the Gemini adapter and keeps Groq/OpenAI on the compatible one', () => {
    expect(isGeminiNativeBaseUrl('https://generativelanguage.googleapis.com/v1beta')).toBe(true);
    expect(isGeminiNativeBaseUrl('https://generativelanguage.googleapis.com/v1beta/openai')).toBe(false);
    expect(aiClientFor(config)).toBe(geminiAdapter);
    expect(aiClientFor({ baseUrl: 'https://api.groq.com/openai/v1' })).toBe(openAiCompatibleAdapter);
  });

  it('maps system/assistant messages to systemInstruction and model turns', () => {
    const req = toGeminiRequest([
      { role: 'system', content: 'rules' },
      { role: 'user', content: 'hi' },
      { role: 'user', content: 'my name is Adinan' },
      { role: 'assistant', content: 'Hey!' },
    ]);
    expect(req.systemInstruction).toEqual({ parts: [{ text: 'rules' }] });
    expect(req.contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }, { text: 'my name is Adinan' }] },
      { role: 'model', parts: [{ text: 'Hey!' }] },
    ]);
  });

  it('sends a native generateContent request with JSON output, low thinking and the API key header', async () => {
    const fetchMock = vi.fn(async () => ok('{"replyText":"Hey! 👋 What can we help you with?","leadStatus":"exploring"}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await geminiAdapter.generateQualification(config, [
      { role: 'system', content: 'rules' },
      { role: 'user', content: 'hi' },
    ]);

    expect(result.replyText).toBe('Hey! 👋 What can we help you with?');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } });
    expect(body.tools).toBeUndefined(); // no web search grounding
  });

  it('falls back to gemini-3.5-flash when the chosen model is overloaded', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":{"code":503,"status":"UNAVAILABLE"}}', { status: 503 }))
      .mockResolvedValueOnce(ok('{"replyText":"Hello","leadStatus":"exploring"}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await geminiAdapter.generateQualification(config, [{ role: 'user', content: 'hi' }]);
    expect(result.replyText).toBe('Hello');
    expect(String(fetchMock.mock.calls[1]![0])).toContain('/models/gemini-3.5-flash:generateContent');
  });

  it('reports rate limits so the queue retries later, and fails closed on invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    await expect(geminiAdapter.generateQualification(config, [{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });

    vi.stubGlobal('fetch', vi.fn(async () => ok('not json at all')));
    await expect(geminiAdapter.generateQualification(config, [{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      code: 'SCHEMA_MISMATCH',
    });
  });
});
