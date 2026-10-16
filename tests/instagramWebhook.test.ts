import { describe, it, expect } from 'vitest';
import { instagramWebhookAdapter } from '../worker/adapters/meta/instagramWebhook';

describe('InstagramWebhookAdapter', () => {
  it('ignores non-instagram or invalid payloads', () => {
    expect(instagramWebhookAdapter.normalizeWebhookPayload(null)).toEqual([]);
    expect(instagramWebhookAdapter.normalizeWebhookPayload({})).toEqual([]);
    expect(instagramWebhookAdapter.normalizeWebhookPayload({ object: 'page', entry: [] })).toEqual([]);
  });

  it('filters out echoes and extracts legitimate customer messages', () => {
    const rawPayload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig_biz_account_123',
          time: 1713000000000,
          messaging: [
            // Echo message from business (should be skipped)
            {
              sender: { id: 'ig_biz_account_123' },
              recipient: { id: 'customer_user_456' },
              timestamp: 1713000001000,
              message: {
                is_echo: true,
                mid: 'echo_msg_001',
                text: 'Hello, thank you for reaching out!',
              },
            },
            // Customer inbound inquiry
            {
              sender: { id: 'customer_user_456' },
              recipient: { id: 'ig_biz_account_123' },
              timestamp: 1713000002000,
              message: {
                is_echo: false,
                mid: 'cust_msg_002',
                text: 'Hi! I need help with a German Opportunity Card visa. I have 5 years experience.',
              },
            },
          ],
        },
      ],
    };

    const events = instagramWebhookAdapter.normalizeWebhookPayload(rawPayload);
    expect(events).toHaveLength(1);

    const event = events[0]!;
    expect(event).toBeDefined();
    expect(event.eventKey).toBe('ig_msg_ig_biz_account_123_cust_msg_002');
    expect(event.provider).toBe('instagram');
    expect(event.externalAccountId).toBe('ig_biz_account_123');
    expect(event.providerConvoId).toBe('ig_convo_customer_user_456_ig_biz_account_123');
    expect(event.providerMessageId).toBe('cust_msg_002');
    expect(event.senderId).toBe('customer_user_456');
    expect(event.messageText).toBe('Hi! I need help with a German Opportunity Card visa. I have 5 years experience.');
    expect(event.timestamp).toBe(1713000002000);
  });
});
