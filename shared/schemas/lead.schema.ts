import { z } from 'zod';

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
  leadStatus: z.enum([
    'new',
    'collecting_information',
    'qualified',
    'consultation_booked',
    'converted',
    'unqualified',
    'spam_irrelevant',
    'needs_human_review',
    'closed_lost',
  ]).optional(),
  ownerId: z.string().nullable().optional(),
});

export type UpdateLeadSchemaType = z.infer<typeof UpdateLeadSchema>;
