import { describe, it, expect } from 'vitest';
import { whatsappWebhookAdapter } from '../worker/adapters/meta/whatsappWebhook';

describe('WhatsAppWebhookAdapter', () => {
  it('ignores non-whatsapp or invalid payloads', () => {
    expect(whatsappWebhookAdapter.normalizeWebhookPayload(null)).toEqual([]);
    expect(whatsappWebhookAdapter.normalizeWebhookPayload({})).toEqual([]);
    expect(whatsappWebhookAdapter.normalizeWebhookPayload({ object: 'instagram', entry: [] })).toEqual([]);
  });

  it('filters status receipts and extracts customer inbound text messages', () => {
    const rawPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_id_999888',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550234567',
                  phone_number_id: '100234567890',
                },
                contacts: [
                  {
                    profile: { name: 'Amira Hassan' },
                    wa_id: '15559876543',
                  },
                ],
                messages: [
                  {
                    from: '15559876543',
                    id: 'wamid.HBgLMTU1NTk4NzY1NDM=',
                    timestamp: '1713000500',
                    type: 'text',
                    text: {
                      body: 'Hello, what are the requirements for Germany Opportunity Card?',
                    },
                  },
                ],
                statuses: [
                  {
                    id: 'wamid.old_msg_123',
                    status: 'delivered',
                    timestamp: '1713000400',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const events = whatsappWebhookAdapter.normalizeWebhookPayload(rawPayload);
    expect(events).toHaveLength(1);

    const event = events[0]!;
    expect(event.provider).toBe('whatsapp');
    expect(event.phoneNumberId).toBe('100234567890');
    expect(event.wabaId).toBe('waba_id_999888');
    expect(event.senderPhone).toBe('15559876543');
    expect(event.senderName).toBe('Amira Hassan');
    expect(event.messageText).toBe('Hello, what are the requirements for Germany Opportunity Card?');
    expect(event.eventKey).toBe('wa_msg_100234567890_wamid.HBgLMTU1NTk4NzY1NDM=');
  });

  it('extracts interactive button replies correctly', () => {
    const interactivePayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_id_999888',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: '100234567890',
                },
                messages: [
                  {
                    from: '15559876543',
                    id: 'wamid.button_click_001',
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: {
                        id: 'btn_book_consultation',
                        title: 'Book Consultation',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const events = whatsappWebhookAdapter.normalizeWebhookPayload(interactivePayload);
    expect(events).toHaveLength(1);
    expect(events[0]!.messageText).toBe('Book Consultation');
  });
});
