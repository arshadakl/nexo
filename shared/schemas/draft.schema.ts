import { z } from 'zod';

export const DraftStatusEnum = z.enum([
  'pending_review',
  'approved_sent',
  'rejected',
  'modified_sent',
]);

export const CreateDraftSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  leadId: z.string().optional(),
  suggestedText: z.string().min(1, 'Suggested text is required'),
  rationale: z.string().optional(),
});

export type CreateDraftSchemaType = z.infer<typeof CreateDraftSchema>;

export const ResolveDraftSchema = z.object({
  status: z.enum(['approved_sent', 'rejected', 'modified_sent']),
  modifiedText: z.string().optional(),
  reviewedBy: z.string().optional(),
});

export type ResolveDraftSchemaType = z.infer<typeof ResolveDraftSchema>;
