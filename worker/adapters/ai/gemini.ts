import type { PromptMessage } from './adapter.interface';
import type { AIQualificationResult, DecryptedAIProviderConfig } from '@shared/types/ai.types';
import { AIProviderError, OpenAICompatibleAdapter, parseStructuredQualification } from './openAiCompatible';
import { logger } from '../../lib/logger';
import { relayFetch } from './relay';

/**
 * Google Gemini adapter using the native REST `generateContent` API
 * (POST {baseUrl}/models/{model}:generateContent with an x-goog-api-key header).
 *
 * - System messages become `systemInstruction`; assistant turns use the `model` role.
 * - JSON output is requested with responseMimeType; the shared parser validates it fail-closed.
 * - Gemini 3 models get a low thinking level so reasoning does not consume the reply budget.
 * - Google Search grounding is intentionally not enabled: replies must use approved info only.
 * - If the chosen model is overloaded (503) or times out, one retry uses FALLBACK_MODEL.
 * - Calls go through the region-pinned AIRelay when configured (Google refuses some edge locations).
 */

export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash';
const REQUEST_TIMEOUT_MS = 25_000;

/** Native Gemini endpoints live on generativelanguage.googleapis.com; its /openai path is OpenAI-compatible. */
export function isGeminiNativeBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return url.hostname === 'generativelanguage.googleapis.com' && !url.pathname.includes('/openai');
  } catch {
    return false;
  }
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/** Converts chat messages to Gemini's format, merging consecutive turns from the same side. */
export function toGeminiRequest(messages: PromptMessage[]) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const role = m.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: m.content });
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  // A conversation must open with a user turn.
  if (contents[0]?.role === 'model') contents.unshift({ role: 'user', parts: [{ text: '(conversation started)' }] });
  if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: '(no message)' }] });
  return { systemInstruction: system ? { parts: [{ text: system }] } : undefined, contents };
}

export class GeminiAdapter extends OpenAICompatibleAdapter {
  override async generateQualification(
    config: DecryptedAIProviderConfig,
    messages: PromptMessage[]
  ): Promise<AIQualificationResult> {
    try {
      return await this.callModel(config, config.defaultModel, messages);
    } catch (err) {
      const overloaded =
        err instanceof AIProviderError && (err.code === 'TIMEOUT' || err.status === 503 || err.status === 500);
      if (overloaded && config.defaultModel !== GEMINI_FALLBACK_MODEL) {
        logger.warn('Gemini model unavailable; retrying with fallback model', {
          model: config.defaultModel,
          fallback: GEMINI_FALLBACK_MODEL,
        });
        return this.callModel(config, GEMINI_FALLBACK_MODEL, messages);
      }
      throw err;
    }
  }

  private async callModel(
    config: DecryptedAIProviderConfig,
    model: string,
    messages: PromptMessage[]
  ): Promise<AIQualificationResult> {
    const base = (config.baseUrl || GEMINI_DEFAULT_BASE_URL).replace(/\/+$/, '');
    const endpoint = `${base}/models/${encodeURIComponent(model.replace(/^models\//, ''))}:generateContent`;
    const { systemInstruction, contents } = toGeminiRequest(messages);

    const generationConfig: Record<string, unknown> = {
      responseMimeType: 'application/json',
      temperature: config.temperature,
      maxOutputTokens: Math.max(config.maxTokens || 600, 1500),
    };
    if (/^gemini-3/.test(model.replace(/^models\//, ''))) {
      generationConfig.thinkingConfig = { thinkingLevel: 'low' };
    }

    let response: Response;
    try {
      response = await relayFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
          'User-Agent': 'Nexo-CRM-Worker/1.0',
          ...(config.customHeaders || {}),
        },
        body: JSON.stringify({ ...(systemInstruction ? { systemInstruction } : {}), contents, generationConfig }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new AIProviderError(`Gemini request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, 'TIMEOUT', 504);
      }
      throw new AIProviderError(
        `Failed to reach Gemini: ${err instanceof Error ? err.message : String(err)}`,
        'PROVIDER_ERROR'
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        throw new AIProviderError('Gemini authentication failed. Please verify the API key.', 'AUTH_FAILED', response.status, errorText);
      }
      if (response.status === 429) {
        throw new AIProviderError('AI provider rate limit reached.', 'RATE_LIMITED', 429, errorText);
      }
      if (response.status === 503) {
        // Overloaded models are temporary; treat as rate limiting so the queue retries later.
        throw new AIProviderError('Gemini model is temporarily overloaded.', 'RATE_LIMITED', 503, errorText);
      }
      throw new AIProviderError(
        `Gemini returned error (${response.status}): ${errorText.substring(0, 300)}`,
        'PROVIDER_ERROR',
        response.status,
        errorText
      );
    }

    const rawJson = (await response.json()) as any;
    const candidate = rawJson?.candidates?.[0];
    const text = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
          .filter((p: any) => !p?.thought && typeof p?.text === 'string')
          .map((p: any) => p.text)
          .join('')
      : '';

    if (!text) {
      throw new AIProviderError(
        `Gemini returned no text (finishReason: ${candidate?.finishReason || rawJson?.promptFeedback?.blockReason || 'unknown'})`,
        'SCHEMA_MISMATCH',
        200,
        rawJson
      );
    }

    return parseStructuredQualification(text, { name: config.name, defaultModel: model }, rawJson);
  }
}

export const geminiAdapter = new GeminiAdapter();
