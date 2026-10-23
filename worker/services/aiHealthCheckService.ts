import type { AIProviderPreset, AIHealthCheckResult } from '@shared/types/ai.types';
import { aiProviderRepository } from '../repositories/aiProviderRepository';
import { aiClientFor } from '../adapters/ai';
import { GEMINI_DEFAULT_BASE_URL, GEMINI_FALLBACK_MODEL } from '../adapters/ai/gemini';
import { logger } from '../lib/logger';

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: 'groq',
    name: 'Groq (Ultra-Fast Inference)',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    recommendedModels: [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ],
    placeholderApiKey: 'gsk_...',
    description: 'Ultra-low latency (~200ms) with full structured JSON output support.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: GEMINI_DEFAULT_BASE_URL,
    defaultModel: GEMINI_FALLBACK_MODEL,
    recommendedModels: ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'],
    placeholderApiKey: 'AIza... or AQ...',
    description: 'Native Gemini API (generateContent) with JSON output. Falls back to gemini-3.5-flash when a model is overloaded.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (Multi-Model Gateway)',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat',
    recommendedModels: [
      'deepseek/deepseek-chat',
      'meta-llama/llama-3.3-70b-instruct',
      'anthropic/claude-3.5-haiku',
    ],
    placeholderApiKey: 'sk-or-v1-...',
    description: 'Access hundreds of frontier and open-weights models through one key.',
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT-4o Mini / Standard)',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    recommendedModels: ['gpt-4o-mini', 'gpt-4o'],
    placeholderApiKey: 'sk-proj-...',
    description: 'Official OpenAI API with native structured JSON schema mode.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Direct',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    recommendedModels: ['deepseek-chat'],
    placeholderApiKey: 'sk-...',
    description: 'Cost-effective frontier model with high structured extraction accuracy.',
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    recommendedModels: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    ],
    placeholderApiKey: '...',
    description: 'High-throughput open-weights hosting with OpenAI API compatibility.',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-Compatible (vLLM / Ollama / Self-hosted)',
    baseUrl: 'https://your-domain.com/v1',
    defaultModel: 'default',
    recommendedModels: ['default'],
    placeholderApiKey: '...',
    description: 'Any self-hosted or proprietary API adhering to POST /v1/chat/completions.',
  },
];

export class AIHealthCheckService {
  /**
   * Tests a saved provider by decrypting its key and executing a verification ping.
   * Updates D1 with the test outcome and round-trip latency.
   */
  async testProvider(
    db: D1Database,
    tenantId: string,
    providerId: string,
    masterKeyBase64: string
  ): Promise<AIHealthCheckResult> {
    const providerConfig = await aiProviderRepository.getByIdDecrypted(
      db,
      tenantId,
      providerId,
      masterKeyBase64
    );

    if (!providerConfig) {
      return {
        success: false,
        providerId,
        model: 'unknown',
        latencyMs: 0,
        healthStatus: 'error',
        message: 'Provider not found or does not belong to this tenant',
      };
    }

    logger.info('Running AI provider connection test', {
      providerId,
      providerName: providerConfig.name,
      model: providerConfig.defaultModel,
    });

    const testResult = await aiClientFor(providerConfig).testConnection(providerConfig);

    // Record health status in D1
    await aiProviderRepository.updateHealthStatus(
      db,
      tenantId,
      providerId,
      testResult.healthStatus,
      testResult.latencyMs
    );

    return testResult;
  }
}

export const aiHealthCheckService = new AIHealthCheckService();
