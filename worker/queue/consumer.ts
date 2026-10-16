import { openAiCompatibleAdapter } from '../adapters/ai/openAiCompatible';
import { instagramSendApiAdapter } from '../adapters/meta/instagramSendApi';
import { aiProviderRepository } from '../repositories/aiProviderRepository';
import { connectionRepository } from '../repositories/connectionRepository';
import { logger } from '../lib/logger';
import type { WorkerEnv } from '../env';
import type { NormalizedInboundMessageEvent } from '@shared/types/meta.types';
import type { PromptMessage } from '../adapters/ai/adapter.interface';

export async function processQueueBatch(
  batch: MessageBatch<any>,
  env: WorkerEnv
): Promise<void> {
  const masterKey = env.META_TOKEN_ENCRYPTION_KEY || 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

  for (const message of batch.messages) {
    const payload = message.body;
    const eventId = payload?.eventId;

    if (!eventId) {
      message.ack();
      continue;
    }

    try {
      // 1. Authoritative event lookup from D1
      const eventRecord = await env.DB
        .prepare('SELECT id, tenant_id, connection_id, payload_json, status FROM webhook_events WHERE id = ?')
        .bind(eventId)
        .first<any>();

      if (!eventRecord) {
        message.ack();
        continue;
      }

      const event: NormalizedInboundMessageEvent = JSON.parse(eventRecord.payload_json);
      const tenantId = eventRecord.tenant_id;
      const connectionId = eventRecord.connection_id;

      if (!tenantId || !connectionId) {
        logger.warn('Webhook event missing tenant or connection mapping', { eventId });
        message.ack();
        continue;
      }

      const now = Date.now();

      // 2. Find or create conversation in D1
      let conversation = await env.DB
        .prepare(
          'SELECT id, ai_mode, human_takeover, unread_count FROM conversations WHERE connection_id = ? AND provider_convo_id = ?'
        )
        .bind(connectionId, event.providerConvoId)
        .first<any>();

      let conversationId: string;

      if (!conversation) {
        conversationId = crypto.randomUUID();
        await env.DB
          .prepare(
            `INSERT INTO conversations (
              id, tenant_id, connection_id, channel, provider_convo_id,
              customer_id, customer_name, ai_mode, human_takeover,
              unread_count, last_message_at, created_at, updated_at
            ) VALUES (?, ?, ?, 'instagram', ?, ?, ?, 'INHERIT', 0, 1, ?, ?, ?)`
          )
          .bind(
            conversationId,
            tenantId,
            connectionId,
            event.providerConvoId,
            event.senderId,
            event.senderName || 'Instagram User',
            now,
            now,
            now
          )
          .run();
        conversation = { id: conversationId, ai_mode: 'INHERIT', human_takeover: 0, unread_count: 1 };
      } else {
        conversationId = conversation.id;
        await env.DB
          .prepare('UPDATE conversations SET last_message_at = ?, unread_count = unread_count + 1, updated_at = ? WHERE id = ?')
          .bind(now, now, conversationId)
          .run();
      }

      // 3. Persist inbound message into messages table
      const inboundMsgId = crypto.randomUUID();
      await env.DB
        .prepare(
          `INSERT INTO messages (
            id, tenant_id, conversation_id, provider_message_id, direction,
            sender_type, sender_id, message_text, message_type, delivery_status, created_at
          ) VALUES (?, ?, ?, ?, 'inbound', 'applicant', ?, ?, 'text', 'delivered', ?)
          ON CONFLICT(provider_message_id) DO NOTHING`
        )
        .bind(
          inboundMsgId,
          tenantId,
          conversationId,
          event.providerMessageId,
          event.senderId,
          event.messageText,
          now
        )
        .run();

      // 4. Pre-send Check: Human takeover or AI disabled
      if (conversation.human_takeover === 1 || conversation.ai_mode === 'OFF') {
        logger.info('AI reply skipped due to staff takeover or AI mode OFF', {
          conversationId,
          humanTakeover: conversation.human_takeover,
          aiMode: conversation.ai_mode,
        });
        await env.DB.prepare("UPDATE webhook_events SET status = 'completed' WHERE id = ?").bind(eventId).run();
        message.ack();
        continue;
      }

      // 5. Retrieve active default AI provider
      const aiConfig = await aiProviderRepository.getDefaultDecrypted(env.DB, tenantId, masterKey);
      if (!aiConfig) {
        logger.warn('No active default AI provider configured for tenant', { tenantId });
        await env.DB.prepare("UPDATE webhook_events SET status = 'completed' WHERE id = ?").bind(eventId).run();
        message.ack();
        continue;
      }

      // 6. Build prompt context (last 5 messages)
      const recentMessagesRows = await env.DB
        .prepare('SELECT sender_type, message_text FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 5')
        .bind(conversationId)
        .all<any>();

      const promptMessages: PromptMessage[] = [
        {
          role: 'system',
          content:
            'You are an AI visa qualification consultant for a reputable visa consultancy. Be polite, concise, and helpful. Extract target country, education, work experience, and intent. If unsure, ask one clear clarifying question. Always return valid structured JSON adhering to the specified format.',
        },
      ];

      for (const m of recentMessagesRows.results || []) {
        promptMessages.push({
          role: m.sender_type === 'applicant' ? 'user' : 'assistant',
          content: m.message_text,
        });
      }

      // 7. Execute AI qualification (< 1.0 ms CPU, ~300ms wall wait)
      const qualification = await openAiCompatibleAdapter.generateQualification(aiConfig, promptMessages);

      // 8. Upsert/Update Lead profile in D1
      const leadId = crypto.randomUUID();
      await env.DB
        .prepare(
          `INSERT INTO leads (
            id, tenant_id, full_name, residence_country, destination_country,
            visa_category, education, work_experience, timeline, budget_range,
            lead_score, lead_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`
        )
        .bind(
          leadId,
          tenantId,
          qualification.extractedFields.fullName || event.senderName || 'Applicant',
          qualification.extractedFields.residenceCountry || null,
          qualification.extractedFields.destinationCountry || null,
          qualification.extractedFields.visaCategory || null,
          qualification.extractedFields.education || null,
          qualification.extractedFields.workExperience || null,
          qualification.extractedFields.timeline || null,
          qualification.extractedFields.budgetRange || null,
          qualification.leadScore,
          qualification.leadStatus,
          now,
          now
        )
        .run();

      // 9. Dispatch outbound reply if replyText is generated and safe
      if (qualification.replyText) {
        const outboundMsgId = crypto.randomUUID();
        await env.DB
          .prepare(
            `INSERT INTO messages (
              id, tenant_id, conversation_id, direction, sender_type,
              message_text, message_type, delivery_status, created_at
            ) VALUES (?, ?, ?, 'outbound', 'ai', ?, 'text', 'pending', ?)`
          )
          .bind(outboundMsgId, tenantId, conversationId, qualification.replyText, now)
          .run();

        // Retrieve decrypted connection access token
        const connection = await connectionRepository.getByExternalIdDecrypted(
          env.DB,
          'instagram',
          event.externalAccountId,
          masterKey
        );

        if (connection && connection.accessToken) {
          const sendResult = await instagramSendApiAdapter.sendMessage({
            accessToken: connection.accessToken,
            recipientId: event.senderId,
            text: qualification.replyText,
          });

          await env.DB
            .prepare("UPDATE messages SET provider_message_id = ?, delivery_status = 'delivered' WHERE id = ?")
            .bind(sendResult.messageId, outboundMsgId)
            .run();
        }
      }

      // 10. Mark webhook event completed
      await env.DB
        .prepare("UPDATE webhook_events SET status = 'completed', processed_at = ? WHERE id = ?")
        .bind(now, eventId)
        .run();

      message.ack();
    } catch (err) {
      logger.error('Error processing queue message for event', err, { eventId });
      message.retry();
    }
  }
}
