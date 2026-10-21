import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OpenAICompatibleAdapter,
  AIProviderError,
} from '../worker/adapters/ai/openAiCompatible';
import type { DecryptedAIProviderConfig } from '../shared/types/ai.types';

describe('OpenAICompatibleAdapter', () => {
  const adapter = new OpenAICompatibleAdapter();

  const mockConfig: DecryptedAIProviderConfig = {
    id: 'test-p1',
    tenantId: 'tenant-1',
    name: 'Groq Test',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: 'gsk_test12345678',
    defaultModel: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    maxTokens: 500,
  };

  const sampleValidStructuredOutput = {
    intent: 'residency',
    language: 'en',
    replyText: 'Hey! Are you looking for residency only, or a permit with residency?',
    rationale: 'Clarifying permit requirement',
    extractedFields: {
      serviceVertical: 'residency',
      residencyIntent: 'understanding_options',
      uaeLocationContext: 'inside_uae',
    },
    fieldConfidence: {
      serviceVertical: 0.95,
    },
    missingFields: ['timeline'],
    questionsAnswered: ['uaeLocationContext'],
    leadStatus: 'exploring',
    statusReason: 'Lead asked about residency options from within UAE',
    humanReviewRequired: false,
    safetyFlags: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully generates structured qualification on 200 OK', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(sampleValidStructuredOutput),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await adapter.generateQualification(mockConfig, [
      { role: 'user', content: 'I need UAE residency options' },
    ]);

    expect(result.intent).toBe('residency');
    expect(result.extractedFields.serviceVertical).toBe('residency');
    expect(result.leadStatus).toBe('exploring');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer gsk_test12345678');
  });

  it('throws AIProviderError on 401 unauthorized', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid API Key',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      adapter.generateQualification(mockConfig, [{ role: 'user', content: 'test' }])
    ).rejects.toThrowError(AIProviderError);
  });

  it('throws AIProviderError on 429 rate limit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      await adapter.generateQualification(mockConfig, [{ role: 'user', content: 'test' }]);
    } catch (err) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).code).toBe('RATE_LIMITED');
    }
  });

  it('throws SCHEMA_MISMATCH error on non-JSON content', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'I am a free-form model that did not return JSON',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      adapter.generateQualification(mockConfig, [{ role: 'user', content: 'test' }])
    ).rejects.toThrowError(AIProviderError);
  });

  it('testConnection measures latency and returns structured health check', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(sampleValidStructuredOutput),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const check = await adapter.testConnection(mockConfig);
    expect(check.success).toBe(true);
    expect(check.healthStatus).toBe('healthy');
    expect(check.model).toBe('llama-3.3-70b-versatile');
    expect(check.latencyMs).toBeGreaterThanOrEqual(0);
    expect(check.sampleStructuredOutput).toBeDefined();
  });

  it('correctly parses JSON wrapped in markdown code blocks (```json ... ```)', async () => {
    const wrappedContent = `\`\`\`json\n${JSON.stringify(sampleValidStructuredOutput, null, 2)}\n\`\`\``;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: wrappedContent,
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await adapter.generateQualification(mockConfig, [
      { role: 'user', content: 'I want to study in Germany' },
    ]);

    expect(result.intent).toBe('residency');
    expect(result.extractedFields.serviceVertical).toBe('residency');
    expect(result.leadStatus).toBe('exploring');
  });
});
