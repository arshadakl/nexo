import { z } from 'zod';

export const AIQualificationResultSchema = z.object({
  intent: z.enum(['study', 'work', 'visitor', 'permanent_residency', 'family', 'other', 'unknown']),
  language: z.string().default('en'),
  replyText: z.string().nullable(),
  extractedFields: z.object({
    fullName: z.string().optional(),
    residenceCountry: z.string().optional(),
    destinationCountry: z.string().optional(),
    visaCategory: z.string().optional(),
    education: z.string().optional(),
    workExperience: z.string().optional(),
    languageTest: z.string().optional(),
    timeline: z.string().optional(),
    budgetRange: z.string().optional(),
    phoneOrEmail: z.string().optional(),
  }).default({}),
  fieldConfidence: z.record(z.number().min(0).max(1)).default({}),
  missingFields: z.array(z.string()).default([]),
  nextQuestion: z.string().nullable().default(null),
  leadScore: z.number().min(0).max(100).default(0),
  scoreComponents: z.object({
    intentScore: z.number().min(0).max(25).default(0),
    completenessScore: z.number().min(0).max(25).default(0),
    readinessScore: z.number().min(0).max(20).default(0),
    timelineFitScore: z.number().min(0).max(15).default(0),
    engagementScore: z.number().min(0).max(15).default(0),
  }).default({}),
  leadStatus: z.enum([
    'collecting_information',
    'qualified',
    'needs_human_review',
    'unqualified',
    'spam_irrelevant',
  ]).default('collecting_information'),
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
