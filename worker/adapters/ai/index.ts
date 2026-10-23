import type { AIProviderClient } from './adapter.interface';
import type { DecryptedAIProviderConfig } from '@shared/types/ai.types';
import { openAiCompatibleAdapter } from './openAiCompatible';
import { geminiAdapter, isGeminiNativeBaseUrl } from './gemini';

/** Picks the client for a configured provider: native Gemini by base URL, otherwise OpenAI-compatible. */
export function aiClientFor(config: Pick<DecryptedAIProviderConfig, 'baseUrl'>): AIProviderClient {
  return isGeminiNativeBaseUrl(config.baseUrl) ? geminiAdapter : openAiCompatibleAdapter;
}
