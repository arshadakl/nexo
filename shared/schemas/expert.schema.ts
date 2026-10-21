import { z } from 'zod';

export const CreateExpertSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  organizationName: z.string().min(1, 'Organization name is required'),
  sectors: z.array(z.string()).min(1, 'At least one sector is required'),
  languages: z.array(z.string()).default(['en']),
  emirates: z.array(z.string()).default(['all']),
  servicesOffered: z.array(z.string()).default([]),
  isVerified: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
});

export type CreateExpertSchemaType = z.infer<typeof CreateExpertSchema>;

export const UpdateExpertSchema = z.object({
  fullName: z.string().optional(),
  organizationName: z.string().optional(),
  sectors: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  emirates: z.array(z.string()).optional(),
  servicesOffered: z.array(z.string()).optional(),
  isVerified: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  contactPhone: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
});

export type UpdateExpertSchemaType = z.infer<typeof UpdateExpertSchema>;

export const ExpertMatchCriteriaSchema = z.object({
  sector: z.string().optional(),
  language: z.string().optional(),
  emirate: z.string().optional(),
  serviceNeeded: z.string().optional(),
});

export type ExpertMatchCriteriaSchemaType = z.infer<typeof ExpertMatchCriteriaSchema>;
