import type { NormalizedWhatsAppMessage } from '@shared/types/whatsapp.types';
import type { InboundAttachment } from '@shared/types/meta.types';
import { classifyAttachments, placeholderText } from '../../lib/inboundContent';

export class WhatsAppWebhookAdapter {
  /**
   * Normalizes raw Meta WhatsApp Cloud API webhook payload into standardized events.
   * Filters out statuses (sent/delivered/read receipts) and returns actionable messages.
   * CPU: < 0.4 ms.
   */
  normalizeWebhookPayload(rawPayload: any): NormalizedWhatsAppMessage[] {
    const events: NormalizedWhatsAppMessage[] = [];

    if (rawPayload?.object !== 'whatsapp_business_account' || !Array.isArray(rawPayload?.entry)) {
      return events;
    }

    for (const entry of rawPayload.entry) {
      const wabaId = String(entry.id || '');
      const changes = Array.isArray(entry.changes) ? entry.changes : [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        if (!value) continue;

        const phoneNumberId = String(value.metadata?.phone_number_id || '');
        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        const contactMap = new Map<string, string>();

        for (const c of contacts) {
          if (c.wa_id && c.profile?.name) {
            contactMap.set(c.wa_id, c.profile.name);
          }
        }

        const messages = Array.isArray(value.messages) ? value.messages : [];

        for (const msg of messages) {
          const providerMessageId = String(msg.id || `wamid_${Date.now()}_${Math.random()}`);
          const senderPhone = String(msg.from || '');
          const senderName = contactMap.get(senderPhone) || undefined;
          const timestamp = Number(msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now());

          let messageText = '';
          if (msg.type === 'text' && msg.text?.body) {
            messageText = String(msg.text.body);
          } else if (msg.type === 'interactive') {
            if (msg.interactive?.button_reply?.title) {
              messageText = String(msg.interactive.button_reply.title);
            } else if (msg.interactive?.list_reply?.title) {
              messageText = String(msg.interactive.list_reply.title);
            }
          } else if (msg.type === 'button' && msg.button?.text) {
            messageText = String(msg.button.text);
          }

          const attachments: InboundAttachment[] = [];
          if (['audio', 'voice', 'image', 'video', 'sticker', 'document'].includes(msg.type)) {
            attachments.push({ type: msg.type });
            const caption = msg[msg.type]?.caption;
            if (typeof caption === 'string') messageText = caption.trim();
          } else if (!messageText && msg.type && msg.type !== 'text' && msg.type !== 'reaction') {
            attachments.push({ type: 'unsupported' });
          }
          const messageType = classifyAttachments(attachments);
          if (!messageText) messageText = placeholderText(messageType);

          if (messageText && senderPhone) {
            events.push({
              eventKey: `wa_msg_${phoneNumberId}_${providerMessageId}`,
              provider: 'whatsapp',
              phoneNumberId,
              wabaId,
              providerConvoId: `wa_convo_${senderPhone}_${phoneNumberId}`,
              providerMessageId,
              senderPhone,
              senderName,
              messageText,
              messageType,
              attachments,
              timestamp,
            });
          }
        }
      }
    }

    return events;
  }
}

export const whatsappWebhookAdapter = new WhatsAppWebhookAdapter();
