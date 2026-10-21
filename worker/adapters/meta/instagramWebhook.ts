import type { NormalizedInboundMessageEvent } from '@shared/types/meta.types';

export class InstagramWebhookAdapter {
  /**
   * Normalizes raw Meta Instagram webhook payloads into standardized events.
   * CPU: < 0.3 ms.
   */
  normalizeWebhookPayload(rawPayload: any): NormalizedInboundMessageEvent[] {
    const events: NormalizedInboundMessageEvent[] = [];

    if (rawPayload?.object !== 'instagram' || !Array.isArray(rawPayload?.entry)) {
      return events;
    }

    for (const entry of rawPayload.entry) {
      const recipientId = String(entry.id || '');
      const messagingList = Array.isArray(entry.messaging) ? entry.messaging : [];

      for (const item of messagingList) {
        // Only process customer-initiated inbound text/media messages that contain text
        if (item.message && !item.message.is_echo && item.message.text && String(item.message.text).trim().length > 0) {
          const providerMessageId = String(item.message.mid || `mid_${Date.now()}_${Math.random()}`);
          const senderId = String(item.sender?.id || '');
          const messageText = String(item.message.text).trim();
          const timestamp = Number(item.timestamp || Date.now());

          events.push({
            eventKey: `ig_msg_${recipientId}_${providerMessageId}`,
            provider: 'instagram',
            externalAccountId: recipientId,
            providerConvoId: `ig_convo_${senderId}_${recipientId}`,
            providerMessageId,
            senderId,
            messageText,
            timestamp,
          });
        }
      }
    }

    return events;
  }
}

export const instagramWebhookAdapter = new InstagramWebhookAdapter();
