import { z } from 'zod';

export const SendMessageSchema = z.object({
  messageText: z.string().min(1, 'Message text is required').max(2000, 'Message cannot exceed 2000 characters'),
});

export type SendMessageSchemaType = z.infer<typeof SendMessageSchema>;

export const TakeoverSchema = z.object({
  takeover: z.boolean(),
});

export type TakeoverSchemaType = z.infer<typeof TakeoverSchema>;

export const SetAIModeSchema = z.object({
  aiMode: z.enum(['INHERIT', 'ON', 'OFF']),
});

export type SetAIModeSchemaType = z.infer<typeof SetAIModeSchema>;

export const CreateNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(5000, 'Note cannot exceed 5000 characters'),
});

export type CreateNoteSchemaType = z.infer<typeof CreateNoteSchema>;
