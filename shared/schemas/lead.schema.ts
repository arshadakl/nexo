import { z } from 'zod';

export const LeadStatusEnum = z.enum([
  'new',
  'collecting_information',
  'qualified',
  'consultation_booked',
  'converted',
  'unqualified',
  'spam_irrelevant',
  'needs_human_review',
  'closed_lost',
]);

export const UpdateLeadSchema = z.object({
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
  leadScore: z.number().min(0).max(100).optional(),
  leadStatus: LeadStatusEnum.optional(),
  ownerId: z.string().nullable().optional(),
});

export type UpdateLeadSchemaType = z.infer<typeof UpdateLeadSchema>;

export const CreateLeadSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  destinationCountry: z.string().optional(),
  visaCategory: z.string().optional(),
  residenceCountry: z.string().optional(),
  education: z.string().optional(),
  workExperience: z.string().optional(),
  timeline: z.string().optional(),
  budgetRange: z.string().optional(),
  phoneOrEmail: z.string().optional(),
  leadScore: z.number().min(0).max(100).default(0),
  leadStatus: LeadStatusEnum.default('new'),
});

export type CreateLeadSchemaType = z.infer<typeof CreateLeadSchema>;
