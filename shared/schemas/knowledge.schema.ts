import { z } from 'zod';

export const KnowledgeCategoryEnum = z.enum([
  'residency_package',
  'business_service',
  'policy',
  'faq',
]);

export const CreateKnowledgeItemSchema = z.object({
  category: KnowledgeCategoryEnum,
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  priceAed: z.number().positive().nullable().optional(),
  isApprovedByClient: z.boolean().default(false),
  approvalNotes: z.string().optional(),
});

export type CreateKnowledgeItemSchemaType = z.infer<typeof CreateKnowledgeItemSchema>;

export const UpdateKnowledgeItemSchema = z.object({
  category: KnowledgeCategoryEnum.optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  priceAed: z.number().positive().nullable().optional(),
  isApprovedByClient: z.boolean().optional(),
  approvalNotes: z.string().nullable().optional(),
});

export type UpdateKnowledgeItemSchemaType = z.infer<typeof UpdateKnowledgeItemSchema>;
