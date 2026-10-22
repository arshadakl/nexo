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

import type { LeadStatus, ServiceVertical, ResidencyIntent, LocationContext, ContactMethodPreference } from './crm.types';

export interface AIQualificationResult {
  intent: 'residency' | 'business_setup' | 'both' | 'general_enquiry' | 'human_request' | 'support_status' | 'outside_scope_request' | 'outside_scope_spam' | 'unknown';
  language: string; // 'en' | 'ml' etc.
  toneMirroring?: string | null; // e.g. 'casual_bro' | 'polite_formal'
  replyText: string | null;
  rationale?: string | null;
  extractedFields: {
    fullName?: string | undefined;
    phoneOrEmail?: string | undefined;
    serviceVertical?: ServiceVertical | undefined;
    residencyIntent?: ResidencyIntent | undefined;
    workBusinessActivity?: string | undefined;
    uaeLocationContext?: LocationContext | undefined;
    targetEmirate?: string | undefined;
    timeline?: string | undefined;
    contactMethodPreference?: ContactMethodPreference | undefined;
    contactPermission?: boolean | undefined;
    externalSharingPermission?: boolean | undefined;
    
    currentLocation?: string | undefined;
    nationality?: string | undefined;
    profession?: string | undefined;
    whatsappNumber?: string | undefined;
    whatsappSameAsPhone?: boolean | undefined;
    whatsappContactPermission?: boolean | undefined;

    // Legacy fallback compatibility
    phoneNumber?: string | undefined;
  };
  fieldConfidence?: Record<string, number>;
  missingFields: string[];
  questionsAnswered?: string[];
  unansweredQuestions?: string[];
  confusions?: string[];
  leadStatus: LeadStatus;
  statusReason: string;
  expertMatchCriteria?: {
    sector?: string | null;
    language?: string | null;
    location?: string | null;
  };
  humanReviewRequired: boolean;
  humanReviewReason?: string | undefined;
  safetyFlags: string[];
}

