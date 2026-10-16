import type {
  AIQualificationResult,
  DecryptedAIProviderConfig,
  AIHealthCheckResult,
} from '@shared/types/ai.types';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProviderClient {
  generateQualification(
    config: DecryptedAIProviderConfig,
    messages: PromptMessage[]
  ): Promise<AIQualificationResult>;

  testConnection(
    config: DecryptedAIProviderConfig
  ): Promise<AIHealthCheckResult>;
}
