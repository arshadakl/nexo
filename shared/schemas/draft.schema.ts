import { z } from 'zod';

export const DraftStatusEnum = z.enum([
  'pending_review',
  'sending',
  'send_failed',
  'approved_sent',
  'modified_sent',
  'rejected',
  'superseded',
]);

export const ApproveDraftSchema = z.object({
  // The reviewer has seen customer messages that arrived after the draft and still wants to send it.
  acknowledgeNewMessages: z.boolean().optional(),
});

export const ModifyDraftSchema = ApproveDraftSchema.extend({
  modifiedText: z.string().trim().min(1, 'modifiedText is required').max(2000),
});

export const RejectDraftSchema = z.object({
  nextAction: z.enum(['take_over', 'resume_ai']).default('take_over'),
});

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
