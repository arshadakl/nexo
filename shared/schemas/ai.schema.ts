import { z } from 'zod';
import {
  LeadStatusEnum,
  ServiceVerticalEnum,
  ResidencyIntentEnum,
  LocationContextEnum,
  ContactMethodPreferenceEnum,
  LeadQualificationEnum,
} from './lead.schema';

const lowerSnake = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s/-]+/g, '_') : value;

// Optional enrichment fields degrade to null instead of failing the whole (fail-closed) parse.
const DraftReviewKindEnum = z.enum([
  'business_confirmation',
  'human_requested',
  'policy_block',
  'model_fallback',
  'ai_review',
]);

export const AIQualificationResultSchema = z.object({
  intent: z
    .enum([
      'residency',
      'business_setup',
      'both',
      'general_enquiry',
      'human_request',
      'support_status',
      'outside_scope_request',
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
      fullName: z.string().nullable().optional(),
      phoneOrEmail: z.string().nullable().optional(),
      serviceVertical: ServiceVerticalEnum.nullable().optional(),
      residencyIntent: ResidencyIntentEnum.nullable().optional(),
      workBusinessActivity: z.string().nullable().optional(),
      uaeLocationContext: LocationContextEnum.nullable().optional(),
      targetEmirate: z.string().nullable().optional(),
      timeline: z.string().nullable().optional(),
      contactMethodPreference: ContactMethodPreferenceEnum.nullable().optional(),
      contactPermission: z.boolean().nullable().optional(),
      externalSharingPermission: z.boolean().nullable().optional(),
      currentLocation: z.string().nullable().optional(),
      nationality: z.string().nullable().optional(),
      profession: z.string().nullable().optional(),
      whatsappNumber: z.string().nullable().optional(),
      whatsappSameAsPhone: z.boolean().nullable().optional(),
      whatsappContactPermission: z.boolean().nullable().optional(),
      currentCountry: z.string().nullable().optional(),
      currentCity: z.string().nullable().optional(),
      visaStatus: z.string().nullable().optional(),
      contactPending: z.boolean().nullable().optional(),

      // Compatibility fallback
      phoneNumber: z.string().nullable().optional(),
    })
    .default({}),
  fieldConfidence: z.record(z.number().min(0).max(1)).default({}),
  missingFields: z.array(z.string()).default([]),
  questionsAnswered: z.array(z.string()).default([]),
  unansweredQuestions: z.array(z.string()).default([]),
  confusions: z.array(z.string()).default([]),
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
  humanReviewReason: z.string().nullable().optional(),
  safetyFlags: z.array(z.string()).default([]),
  qualification: z.preprocess(lowerSnake, LeadQualificationEnum).nullable().optional().catch(null),
  qualificationReason: z.string().nullable().optional().catch(null),
  needSummary: z.string().nullable().optional().catch(null),
  nextAction: z.string().nullable().optional().catch(null),
  reviewKind: z.preprocess(lowerSnake, DraftReviewKindEnum).nullable().optional().catch(null),
  reviewerMustConfirm: z.string().nullable().optional().catch(null),
  customerQuestion: z.string().nullable().optional().catch(null),
  ambiguousStatements: z.array(z.string()).default([]).catch([]),
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
