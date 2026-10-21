import { z } from 'zod';
import {
  LeadStatusEnum,
  ServiceVerticalEnum,
  ResidencyIntentEnum,
  LocationContextEnum,
  ContactMethodPreferenceEnum,
} from './lead.schema';

export const AIQualificationResultSchema = z.object({
  intent: z
    .enum([
      'residency',
      'business_setup',
      'both',
      'general_enquiry',
      'human_request',
      'support_status',
      'outside_scope_spam',
      'unknown',
    ])
    .default('unknown'),
  language: z.string().default('en'),
  toneMirroring: z.string().nullable().optional(),
  replyText: z.string().nullable(),
  rationale: z.string().nullable().optional(),
  extractedFields: z
    .object({
      fullName: z.string().optional(),
      phoneOrEmail: z.string().optional(),
      serviceVertical: ServiceVerticalEnum.optional(),
      residencyIntent: ResidencyIntentEnum.optional(),
      workBusinessActivity: z.string().optional(),
      uaeLocationContext: LocationContextEnum.optional(),
      targetEmirate: z.string().optional(),
      timeline: z.string().optional(),
      contactMethodPreference: ContactMethodPreferenceEnum.optional(),
      contactPermission: z.boolean().optional(),
      externalSharingPermission: z.boolean().optional(),

      // Compatibility fallback
      phoneNumber: z.string().optional(),
    })
    .default({}),
  fieldConfidence: z.record(z.number().min(0).max(1)).default({}),
  missingFields: z.array(z.string()).default([]),
  questionsAnswered: z.array(z.string()).default([]),
  leadStatus: LeadStatusEnum.default('needs_clarification'),
  statusReason: z.string().default(''),
  expertMatchCriteria: z
    .object({
      sector: z.string().nullable().optional(),
      language: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
    })
    .optional(),
  humanReviewRequired: z.boolean().default(false),
  humanReviewReason: z.string().optional(),
  safetyFlags: z.array(z.string()).default([]),
});

export type AIQualificationResultSchemaType = z.infer<typeof AIQualificationResultSchema>;

export const CreateAIProviderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  baseUrl: z.string().url('Must be a valid URL (e.g. https://api.openai.com/v1)'),
  apiKey: z.string().min(1, 'API key is required'),
  defaultModel: z.string().min(1, 'Model name is required'),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().min(50).max(4096).default(600),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  customHeaders: z.record(z.string()).optional(),
});

export const UpdateAIProviderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  defaultModel: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(50).max(4096).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  customHeaders: z.record(z.string()).optional(),
});
