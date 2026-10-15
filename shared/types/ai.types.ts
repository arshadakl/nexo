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
  customHeaders?: Record<string, string>;
  lastHealthCheckAt?: number;
  lastHealthStatus: AIHealthStatus;
  lastHealthLatencyMs?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAIProviderInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  temperature?: number;
  maxTokens?: number;
  isActive?: boolean;
  isDefault?: boolean;
  customHeaders?: Record<string, string>;
}

export interface UpdateAIProviderInput {
  name?: string;
  baseUrl?: string;
  apiKey?: string; // Optional: only update if provided
  defaultModel?: string;
  temperature?: number;
  maxTokens?: number;
  isActive?: boolean;
  isDefault?: boolean;
  customHeaders?: Record<string, string>;
}

export interface AIProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  recommendedModels: string[];
  placeholderApiKey: string;
  description: string;
  customHeaders?: Record<string, string>;
}

export interface AIQualificationResult {
  intent: 'study' | 'work' | 'visitor' | 'permanent_residency' | 'family' | 'other' | 'unknown';
  language: string;
  replyText: string | null;
  extractedFields: {
    fullName?: string;
    residenceCountry?: string;
    destinationCountry?: string;
    visaCategory?: string;
    education?: string;
    workExperience?: string;
    languageTest?: string;
    timeline?: string;
    budgetRange?: string;
    phoneOrEmail?: string;
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
  humanReviewReason?: string;
  safetyFlags: string[];
}
