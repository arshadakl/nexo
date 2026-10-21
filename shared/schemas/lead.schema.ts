import { z } from 'zod';

export const LeadStatusEnum = z.enum([
  'needs_clarification',
  'exploring',
  'ready_for_team',
  'handover_requested',
  'handed_over',
  'support_enquiry',
  'outside_scope_spam',
]);

export const ServiceVerticalEnum = z.enum([
  'residency',
  'business_setup',
  'both',
  'unspecified',
]);

export const ResidencyIntentEnum = z.enum([
  'permit_with_residency',
  'residency_only',
  'understanding_options',
  'unspecified',
]);

export const LocationContextEnum = z.enum([
  'inside_uae',
  'outside_uae',
  'undecided',
  'unknown',
]);

export const ContactMethodPreferenceEnum = z.enum([
  'whatsapp',
  'phone_call',
  'instagram_dm',
]);

export const UpdateLeadSchema = z.object({
  fullName: z.string().optional(),
  phoneOrEmail: z.string().optional(),
  serviceVertical: ServiceVerticalEnum.optional(),
  residencyIntent: ResidencyIntentEnum.optional(),
  workBusinessActivity: z.string().optional(),
  uaeLocationContext: LocationContextEnum.optional(),
  targetEmirate: z.string().optional(),
  timeline: z.string().optional(),
  detectedLanguage: z.string().optional(),
  contactMethodPreference: ContactMethodPreferenceEnum.nullable().optional(),
  contactPermission: z.boolean().optional(),
  externalSharingPermission: z.boolean().optional(),
  leadStatus: LeadStatusEnum.optional(),
  statusReason: z.string().optional(),
  missingDetails: z.array(z.string()).optional(),
  questionsAnswered: z.array(z.string()).optional(),
  assignedExpertId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  nextAction: z.string().nullable().optional(),
  nextActionOwner: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),

  // Compatibility optional fields
  phoneNumber: z.string().optional(),
  leadScore: z.number().min(0).max(100).optional(),
});

export type UpdateLeadSchemaType = z.infer<typeof UpdateLeadSchema>;

export const CreateLeadSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phoneOrEmail: z.string().optional(),
  serviceVertical: ServiceVerticalEnum.default('unspecified'),
  residencyIntent: ResidencyIntentEnum.default('unspecified'),
  workBusinessActivity: z.string().optional(),
  uaeLocationContext: LocationContextEnum.default('unknown'),
  targetEmirate: z.string().optional(),
  timeline: z.string().optional(),
  detectedLanguage: z.string().default('en'),
  contactMethodPreference: ContactMethodPreferenceEnum.optional(),
  contactPermission: z.boolean().default(false),
  externalSharingPermission: z.boolean().default(false),
  leadStatus: LeadStatusEnum.default('needs_clarification'),
  statusReason: z.string().optional(),
  missingDetails: z.array(z.string()).default([]),
  questionsAnswered: z.array(z.string()).default([]),
  assignedExpertId: z.string().optional(),
  ownerId: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionOwner: z.string().optional(),
  summary: z.string().optional(),

  // Compatibility optional fields
  phoneNumber: z.string().optional(),
  leadScore: z.number().min(0).max(100).optional(),
});

export type CreateLeadSchemaType = z.infer<typeof CreateLeadSchema>;
