import { z } from 'zod';

export const ConnectWhatsAppSchema = z.object({
  phoneNumberId: z.string().min(5, 'Valid Phone Number ID is required'),
  wabaId: z.string().min(5, 'Valid WhatsApp Business Account (WABA) ID is required'),
  accessToken: z.string().min(20, 'System User Access Token is required'),
  displayName: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export type ConnectWhatsAppSchemaType = z.infer<typeof ConnectWhatsAppSchema>;

export const SendWhatsAppTextSchema = z.object({
  recipientPhone: z.string().min(8, 'Valid recipient phone number is required'),
  text: z.string().min(1, 'Message text is required').max(4096, 'Text exceeds 4096 characters'),
});

export type SendWhatsAppTextSchemaType = z.infer<typeof SendWhatsAppTextSchema>;
