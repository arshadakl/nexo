import { openAiCompatibleAdapter } from '../adapters/ai/openAiCompatible';
import { instagramSendApiAdapter } from '../adapters/meta/instagramSendApi';
import { whatsappSendApiAdapter } from '../adapters/meta/whatsappSendApi';
import { aiProviderRepository } from '../repositories/aiProviderRepository';
import { connectionRepository } from '../repositories/connectionRepository';
import { logger } from '../lib/logger';
import type { WorkerEnv } from '../env';
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
      // 1. Atomic status lock: only process if status is currently 'enqueued'
      const lockResult = await env.DB
        .prepare("UPDATE webhook_events SET status = 'processing', attempts = attempts + 1 WHERE id = ? AND status = 'enqueued'")
        .bind(eventId)
        .run();

      if (lockResult.meta.changes === 0) {
        // Event was already processed or is currently being processed by another worker
        message.ack();
        continue;
      }

      // 2. Authoritative event lookup from D1
      const eventRecord = await env.DB
        .prepare('SELECT id, tenant_id, connection_id, provider, payload_json, status FROM webhook_events WHERE id = ?')
        .bind(eventId)
        .first<any>();

      if (!eventRecord) {
        message.ack();
        continue;
      }

      let tenantId = eventRecord.tenant_id;
      let connectionId = eventRecord.connection_id;
      const provider = (eventRecord.provider || 'instagram') as 'instagram' | 'whatsapp';

      if (!tenantId || !connectionId) {
        const fallbackConn = await env.DB
          .prepare('SELECT id, tenant_id FROM integration_connections WHERE provider = ? AND status = ? LIMIT 1')
          .bind(provider, 'connected')
          .first<{ id: string; tenant_id: string }>();

        if (fallbackConn) {
          tenantId = fallbackConn.tenant_id;
          connectionId = fallbackConn.id;
        } else {
          logger.warn('Webhook event missing tenant or connection mapping', { eventId });
          await env.DB.prepare("UPDATE webhook_events SET status = 'failed', error_message = 'Missing tenant mapping' WHERE id = ?").bind(eventId).run();
          message.ack();
          continue;
        }
      }

      const now = Date.now();
      const rawEvent = JSON.parse(eventRecord.payload_json);

      // Normalize channel properties
      const senderId = provider === 'whatsapp' ? rawEvent.senderPhone : rawEvent.senderId;
      const senderName = rawEvent.senderName || (provider === 'whatsapp' ? senderId : 'Instagram User');
      const providerConvoId = rawEvent.providerConvoId;
      const providerMessageId = rawEvent.providerMessageId;
      const messageText = rawEvent.messageText;

      // 2. Find or create conversation in D1
      let conversation = await env.DB
        .prepare(
          'SELECT id, ai_mode, human_takeover, unread_count FROM conversations WHERE connection_id = ? AND provider_convo_id = ?'
        )
        .bind(connectionId, providerConvoId)
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INHERIT', 0, 1, ?, ?, ?)`
          )
          .bind(
            conversationId,
            tenantId,
            connectionId,
            provider,
            providerConvoId,
            senderId,
            senderName,
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
          providerMessageId,
          senderId,
          messageText,
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

      // 6. Look up existing lead details for contextual conversational state
      const existingLeadLink = await env.DB
        .prepare(`
          SELECT l.id, l.full_name, l.phone_or_email, l.service_vertical, l.residency_intent, l.work_business_activity, l.uae_location_context
          FROM lead_conversation_links lcl
          JOIN leads l ON l.id = lcl.lead_id
          WHERE lcl.conversation_id = ?
          ORDER BY lcl.linked_at DESC LIMIT 1
        `)
        .bind(conversationId)
        .first<{
          id: string;
          full_name: string | null;
          phone_or_email: string | null;
          service_vertical: string | null;
          residency_intent: string | null;
          work_business_activity: string | null;
          uae_location_context: string | null;
        }>();

      const knownName = existingLeadLink?.full_name && existingLeadLink.full_name !== 'Applicant' && existingLeadLink.full_name !== 'Instagram User'
        ? existingLeadLink.full_name
        : (senderName && senderName !== 'Instagram User' && senderName !== 'Applicant' ? senderName : null);
      const knownPhone = existingLeadLink?.phone_or_email || null;
      const knownActivity = existingLeadLink?.work_business_activity || null;

      // Build prompt context (last 12 non-empty messages in chronological order)
      const recentMessagesRows = await env.DB
        .prepare(`
          SELECT sender_type, message_text 
          FROM (
            SELECT sender_type, message_text, created_at 
            FROM messages 
            WHERE conversation_id = ? AND TRIM(message_text) != ''
            ORDER BY created_at DESC 
            LIMIT 12
          ) 
          ORDER BY created_at ASC
        `)
        .bind(conversationId)
        .all<any>();

      const systemPrompt = `You are Sarah, a friendly and helpful residency advisor for Nexo in Dubai, UAE.
You assist clients via Instagram DMs and WhatsApp in simple, easy-to-understand English.

OUR SERVICES & PRICES:
1. Long-term Residency Package (Permit + Residency): AED 7,000–7,500
2. Freelance Permit / Residency Visa: Starting from AED 7,500
3. Standard Residency Visa: AED 15,000–20,000
We help freelancers, business owners, and property buyers get their UAE residency smoothly.

CURRENT CLIENT DETAILS:
- Name: ${knownName || 'Not given yet'}
- Contact: ${knownPhone || 'Not given yet'}
- Activity: ${knownActivity || 'Not shared yet'}

CONVERSATION RULES:
1. Speak in simple, friendly, natural English. Keep each message short (1 to 2 sentences).
2. Ask only ONE question at a time.
3. NEVER repeat a question that the client already answered or that was already asked in the chat history.

STEP-BY-STEP FLOW:
- STEP 1 (Name): If name is unknown:
  Greet warmly and ask for their name simply:
  "Hello! Welcome to Nexo. I'm happy to help you with Dubai residency. May I know your name, please?"

- STEP 2 (Package Choice): Once name is known, if they haven't chosen a package yet:
  "Nice to meet you, [Name]! Are you interested in our Freelance Permit (AED 7,500), Long-term Package (AED 7,000–7,500), or Residency Visa (AED 15,000–20,000)?"

- STEP 3 (Phone Number): Once package is chosen, if phone is unknown:
  "Great choice! What is your WhatsApp number? I'll send you the document checklist and official fee breakdown."

- STEP 4 (Lifestyle / Sport / Interest): Once phone is given, if sport/workout has NOT been asked yet:
  "Got it! By the way, while we prepare your file, do you have any favorite sport or workout like gym, padel, or running?"

- STEP 5 (Wrap-up & Consultation Booking): If they replied to the sport question (even if they say "no preference", "none", "gym", "football", or anything else):
  Do NOT ask about sports again! Say:
  "Thank you so much, [Name]! Our senior residency consultant will review your file and message you on WhatsApp shortly to set up your consultation. Have a great day!"

If the client asks any general question (e.g. "how long does it take?"), answer it simply and clearly in 1 sentence, then continue the flow.

OUTPUT FORMAT:
Reply ONLY with a valid JSON object matching this schema:
{
  "intent": "permanent_residency",
  "language": "en",
  "replyText": "your simple message here",
  "extractedFields": {
    "fullName": "extracted name or null",
    "phone": "extracted phone number or null",
    "favoriteSport": "extracted sport or if declined write 'None' or 'Gym' etc, or null",
    "servicePackage": "extracted package name or null",
    "destinationCountry": "UAE",
    "visaCategory": "UAE Residency Visa"
  },
  "fieldConfidence": {},
  "missingFields": [],
  "nextQuestion": null,
  "leadScore": 60,
  "scoreComponents": {"intentScore": 15, "completenessScore": 15, "readinessScore": 10, "timelineFitScore": 10, "engagementScore": 10},
  "leadStatus": "collecting_information",
  "humanReviewRequired": false,
  "safetyFlags": []
}`;

      const promptMessages: PromptMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
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
      let leadId: string;
      const applicantName = qualification.extractedFields.fullName || knownName || (senderName !== 'Instagram User' ? senderName : null);
      const applicantContact = qualification.extractedFields.phoneOrEmail || qualification.extractedFields.phoneNumber || knownPhone;
      const serviceVertical = qualification.extractedFields.serviceVertical || 'unspecified';
      const residencyIntent = qualification.extractedFields.residencyIntent || 'unspecified';
      const workActivity = qualification.extractedFields.workBusinessActivity || knownActivity;
      const locationContext = qualification.extractedFields.uaeLocationContext || 'unknown';

      if (existingLeadLink) {
        leadId = existingLeadLink.id;
        // Update existing lead record with newly extracted information
        await env.DB
          .prepare(
            `UPDATE leads SET
              full_name = COALESCE(?, full_name),
              phone_or_email = COALESCE(?, phone_or_email),
              service_vertical = CASE WHEN ? != 'unspecified' THEN ? ELSE service_vertical END,
              residency_intent = CASE WHEN ? != 'unspecified' THEN ? ELSE residency_intent END,
              work_business_activity = COALESCE(?, work_business_activity),
              uae_location_context = CASE WHEN ? != 'unknown' THEN ? ELSE uae_location_context END,
              lead_status = ?,
              status_reason = COALESCE(?, status_reason),
              missing_details_json = ?,
              updated_at = ?
            WHERE id = ?`
          )
          .bind(
            applicantName,
            applicantContact,
            serviceVertical, serviceVertical,
            residencyIntent, residencyIntent,
            workActivity,
            locationContext, locationContext,
            qualification.leadStatus,
            qualification.statusReason,
            JSON.stringify(qualification.missingFields || []),
            now,
            leadId
          )
          .run();
      } else {
        leadId = crypto.randomUUID();
        await env.DB
          .prepare(
            `INSERT INTO leads (
              id, tenant_id, full_name, phone_or_email, service_vertical, residency_intent,
              work_business_activity, uae_location_context, timeline, detected_language,
              lead_status, status_reason, missing_details_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING`
          )
          .bind(
            leadId,
            tenantId,
            applicantName || 'Applicant',
            applicantContact,
            serviceVertical,
            residencyIntent,
            workActivity,
            locationContext,
            qualification.extractedFields.timeline || null,
            qualification.language || 'en',
            qualification.leadStatus,
            qualification.statusReason,
            JSON.stringify(qualification.missingFields || []),
            now,
            now
          )
          .run();

        // Link conversation to lead
        await env.DB
          .prepare(
            `INSERT INTO lead_conversation_links (id, tenant_id, lead_id, conversation_id, link_method, confidence, linked_at)
             VALUES (?, ?, ?, ?, 'auto_customer_id', 1.0, ?)
             ON CONFLICT(lead_id, conversation_id) DO NOTHING`
          )
          .bind(crypto.randomUUID(), tenantId, leadId, conversationId, now)
          .run();
      }

      // If applicant name is extracted, also update conversation customer_name
      if (applicantName && applicantName !== 'Applicant' && applicantName !== 'Instagram User') {
        await env.DB
          .prepare('UPDATE conversations SET customer_name = ?, updated_at = ? WHERE id = ?')
          .bind(applicantName, now, conversationId)
          .run();
      }

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

        // Update conversation last_message_at and last_outbound_at
        await env.DB
          .prepare('UPDATE conversations SET last_message_at = ?, last_outbound_at = ?, updated_at = ? WHERE id = ?')
          .bind(now, now, now, conversationId)
          .run();

        const connection = await connectionRepository.getByIdDecrypted(
          env.DB,
          connectionId,
          masterKey
        );

        if (connection && connection.accessToken) {
          let dispatchedMessageId = `msg_${Date.now()}`;

          if (provider === 'whatsapp') {
            const sendResult = await whatsappSendApiAdapter.sendMessage({
              phoneNumberId: connection.phoneNumberId || connection.externalAccountId,
              accessToken: connection.accessToken,
              recipientPhone: senderId,
              text: qualification.replyText,
            });
            dispatchedMessageId = sendResult.messageId;
          } else {
            const sendResult = await instagramSendApiAdapter.sendMessage({
              accessToken: connection.accessToken,
              recipientId: senderId,
              text: qualification.replyText,
            });
            dispatchedMessageId = sendResult.messageId;
          }

          await env.DB
            .prepare("UPDATE messages SET provider_message_id = ?, delivery_status = 'delivered' WHERE id = ?")
            .bind(dispatchedMessageId, outboundMsgId)
            .run();
        }
      }

      // 10. Mark webhook event completed
      await env.DB
        .prepare("UPDATE webhook_events SET status = 'completed', processed_at = ? WHERE id = ?")
        .bind(now, eventId)
        .run();

      message.ack();
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : String(err);
      logger.error('Error processing queue message for event', err, { eventId });
      try {
        await env.DB
          .prepare("UPDATE webhook_events SET error_message = ?, attempts = attempts + 1 WHERE id = ?")
          .bind(errText, eventId)
          .run();
      } catch {}
      message.retry();
    }
  }
}
