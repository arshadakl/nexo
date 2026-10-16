export type AIProviderType = 'openai_compatible';

export type AIHealthStatus = 'unknown' | 'healthy' | 'error' | 'unauthorized';

export interface AIProvider {
  id: string;
  tenantId: string;
  name: string;
  providerType: AIProviderType;
  baseUrl: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  isDefault: boolean;
  customHeaders?: Record<string, string> | undefined;
  lastHealthCheckAt?: number | undefined;
  lastHealthStatus: AIHealthStatus;
  lastHealthLatencyMs?: number | undefined;
  createdAt: number;
  updatedAt: number;
}

export interface MaskedAIProvider extends AIProvider {
  maskedApiKey: string; // e.g. "gsk_••••••••••••3x9Q"
}

export interface DecryptedAIProviderConfig {
  id: string;
  tenantId: string;
  name: string;
  baseUrl: string;
  apiKey: string; // Plaintext decrypted key in memory only
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  customHeaders?: Record<string, string> | undefined;
}

export interface AIHealthCheckResult {
  success: boolean;
  providerId?: string | undefined;
  model: string;
  latencyMs: number;
  healthStatus: AIHealthStatus;
  message: string;
  sampleStructuredOutput?: Partial<AIQualificationResult> | undefined;
}

export interface CreateAIProviderInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  isActive?: boolean | undefined;
  isDefault?: boolean | undefined;
  customHeaders?: Record<string, string> | undefined;
}

export interface UpdateAIProviderInput {
  name?: string | undefined;
  baseUrl?: string | undefined;
  apiKey?: string | undefined; // Optional: only update if provided
  defaultModel?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  isActive?: boolean | undefined;
  isDefault?: boolean | undefined;
  customHeaders?: Record<string, string> | undefined;
}

export interface AIProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  recommendedModels: string[];
  placeholderApiKey: string;
  description: string;
  customHeaders?: Record<string, string> | undefined;
}

export interface AIQualificationResult {
  intent: 'study' | 'work' | 'visitor' | 'permanent_residency' | 'family' | 'other' | 'unknown';
  language: string;
  replyText: string | null;
  extractedFields: {
    fullName?: string | undefined;
    residenceCountry?: string | undefined;
    destinationCountry?: string | undefined;
    visaCategory?: string | undefined;
    education?: string | undefined;
    workExperience?: string | undefined;
    languageTest?: string | undefined;
    timeline?: string | undefined;
    budgetRange?: string | undefined;
    phoneOrEmail?: string | undefined;
  };
  fieldConfidence: Record<string, number>;
  missingFields: string[];
  nextQuestion: string | null;
  leadScore: number;
  scoreComponents: {
    intentScore: number;
    completenessScore: number;
    readinessScore: number;
    timelineFitScore: number;
    engagementScore: number;
  };
  leadStatus: 'collecting_information' | 'qualified' | 'needs_human_review' | 'unqualified' | 'spam_irrelevant';
  humanReviewRequired: boolean;
  humanReviewReason?: string | undefined;
  safetyFlags: string[];
}
