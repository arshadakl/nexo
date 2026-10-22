import { openAiCompatibleAdapter } from '../adapters/ai/openAiCompatible';
import { instagramSendApiAdapter } from '../adapters/meta/instagramSendApi';
import { whatsappSendApiAdapter } from '../adapters/meta/whatsappSendApi';
import { aiProviderRepository } from '../repositories/aiProviderRepository';
import { connectionRepository } from '../repositories/connectionRepository';
import { knowledgeRepository } from '../repositories/knowledgeRepository';
import { draftRepository } from '../repositories/draftRepository';
import { buildResiderSystemPrompt } from '../lib/residerPrompt';
import { evaluateReplyPolicy } from '../lib/policyEngine';
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ON', 0, 1, ?, ?, ?)`
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
        conversation = { id: conversationId, ai_mode: 'ON', human_takeover: 0, unread_count: 1 };
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
          SELECT l.id, l.full_name, l.phone_or_email, l.service_vertical, l.residency_intent,
                 l.work_business_activity, l.uae_location_context, l.target_emirate,
                 l.timeline, l.lead_status, l.missing_details_json, l.questions_answered_json,
                 l.current_location, l.nationality, l.profession, l.whatsapp_number,
                 l.unanswered_questions_json, l.confusions_json
          FROM lead_conversation_links lcl
          JOIN leads l ON l.id = lcl.lead_id
          WHERE lcl.conversation_id = ?
          ORDER BY lcl.linked_at DESC LIMIT 1
        `)
        .bind(conversationId)
        .first<any>();

      const knownName = existingLeadLink?.full_name && existingLeadLink.full_name !== 'Applicant' && existingLeadLink.full_name !== 'Instagram User'
        ? existingLeadLink.full_name
        : (senderName && senderName !== 'Instagram User' && senderName !== 'Applicant' ? senderName : null);
      const knownPhone = existingLeadLink?.phone_or_email || null;
      const knownProfession = existingLeadLink?.profession || null;
      const knownBusinessActivity = existingLeadLink?.work_business_activity || null;
      const knownCurrentLocation = existingLeadLink?.current_location || null;
      const knownUaeLocationContext = existingLeadLink?.uae_location_context || null;
      const knownNationality = existingLeadLink?.nationality || null;
      const knownWhatsapp = existingLeadLink?.whatsapp_number || null;

      // Retrieve approved business knowledge (Filter by relevance if specific inquiry keyword detected)
      const isBusinessInquiry = (messageText || '').toLowerCase().includes('business') || (messageText || '').toLowerCase().includes('company') || (messageText || '').toLowerCase().includes('license');
      const isResidencyInquiry = (messageText || '').toLowerCase().includes('visa') || (messageText || '').toLowerCase().includes('freelance') || (messageText || '').toLowerCase().includes('residency');

      let approvedKnowledge = await knowledgeRepository.listApprovedKnowledge(env.DB, tenantId);
      if (isBusinessInquiry && !isResidencyInquiry) {
        approvedKnowledge = approvedKnowledge.filter((k) => k.category === 'business_service' || k.category === 'policy' || k.category === 'faq');
      } else if (isResidencyInquiry && !isBusinessInquiry) {
        approvedKnowledge = approvedKnowledge.filter((k) => k.category === 'residency_package' || k.category === 'policy' || k.category === 'faq');
      }

      let missingDetailsArray: string[] = [];
      try {
        if (existingLeadLink?.missing_details_json) {
          missingDetailsArray = JSON.parse(existingLeadLink.missing_details_json);
        }
      } catch {}

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

      const systemPrompt = buildResiderSystemPrompt({
        lead: existingLeadLink
          ? {
              fullName: knownName,
              phoneOrEmail: knownPhone,
              whatsappNumber: knownWhatsapp,
              currentLocation: knownCurrentLocation,
              nationality: knownNationality,
              profession: knownProfession,
              workBusinessActivity: knownBusinessActivity,
              serviceVertical: existingLeadLink.service_vertical,
              residencyIntent: existingLeadLink.residency_intent,
              uaeLocationContext: knownUaeLocationContext,
              targetEmirate: existingLeadLink.target_emirate,
              timeline: existingLeadLink.timeline,
              contactMethodPreference: existingLeadLink.contact_method_preference,
              contactPermission: existingLeadLink.contact_permission === 1,
              whatsappContactPermission: existingLeadLink.whatsapp_contact_permission === 1,
              externalSharingPermission: existingLeadLink.external_sharing_permission === 1,
              leadStatus: existingLeadLink.lead_status,
              missingDetails: missingDetailsArray,
            }
          : null,
        customerName: senderName,
        channel: provider,
        approvedKnowledge,
      });

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
      const workActivity = qualification.extractedFields.workBusinessActivity || knownBusinessActivity || null;
      const profession = qualification.extractedFields.profession || knownProfession || null;
      const locationContext = qualification.extractedFields.uaeLocationContext || 'unknown';
      const currentLocation = qualification.extractedFields.currentLocation || knownCurrentLocation || null;
      const nationality = qualification.extractedFields.nationality || knownNationality || null;
      const targetEmirate = qualification.extractedFields.targetEmirate || null;
      const timeline = qualification.extractedFields.timeline || null;
      const whatsappNumber = qualification.extractedFields.whatsappNumber || (qualification.extractedFields.whatsappSameAsPhone ? applicantContact : null);
      const whatsappSameAsPhone = qualification.extractedFields.whatsappSameAsPhone ? 1 : 0;
      const whatsappContactPermission = qualification.extractedFields.whatsappContactPermission ? 1 : 0;
      const contactPermission = qualification.extractedFields.contactPermission ? 1 : 0;
      const externalSharingPermission = qualification.extractedFields.externalSharingPermission ? 1 : 0;
      const unansweredQuestionsJson = JSON.stringify(qualification.unansweredQuestions || []);
      const confusionsJson = JSON.stringify(qualification.confusions || []);

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
              current_location = COALESCE(?, current_location),
              nationality = COALESCE(?, nationality),
              profession = COALESCE(?, profession),
              target_emirate = COALESCE(?, target_emirate),
              timeline = COALESCE(?, timeline),
              whatsapp_number = COALESCE(?, whatsapp_number),
              whatsapp_same_as_phone = CASE WHEN ? = 1 THEN 1 ELSE whatsapp_same_as_phone END,
              whatsapp_contact_permission = CASE WHEN ? = 1 THEN 1 ELSE whatsapp_contact_permission END,
              contact_permission = CASE WHEN ? = 1 THEN 1 ELSE contact_permission END,
              external_sharing_permission = CASE WHEN ? = 1 THEN 1 ELSE external_sharing_permission END,
              lead_status = ?,
              status_reason = COALESCE(?, status_reason),
              missing_details_json = ?,
              unanswered_questions_json = CASE WHEN ? != '[]' THEN ? ELSE unanswered_questions_json END,
              confusions_json = CASE WHEN ? != '[]' THEN ? ELSE confusions_json END,
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
            currentLocation,
            nationality,
            profession,
            targetEmirate,
            timeline,
            whatsappNumber,
            whatsappSameAsPhone,
            whatsappContactPermission,
            contactPermission,
            externalSharingPermission,
            qualification.leadStatus,
            qualification.statusReason,
            JSON.stringify(qualification.missingFields || []),
            unansweredQuestionsJson, unansweredQuestionsJson,
            confusionsJson, confusionsJson,
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
              current_location, nationality, profession, target_emirate, whatsapp_number,
              whatsapp_same_as_phone, whatsapp_contact_permission, contact_permission, external_sharing_permission,
              lead_status, status_reason, missing_details_json, unanswered_questions_json, confusions_json,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            timeline,
            qualification.language || 'en',
            currentLocation,
            nationality,
            profession,
            targetEmirate,
            whatsappNumber,
            whatsappSameAsPhone,
            whatsappContactPermission,
            contactPermission,
            externalSharingPermission,
            qualification.leadStatus,
            qualification.statusReason,
            JSON.stringify(qualification.missingFields || []),
            unansweredQuestionsJson,
            confusionsJson,
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

      // 9. Handover / Human Review Takeover check
      const requiresHumanReview =
        Boolean(qualification.humanReviewRequired) ||
        qualification.leadStatus === 'handover_requested' ||
        conversation.human_takeover === 1;

      if (requiresHumanReview) {
        await env.DB
          .prepare('UPDATE conversations SET human_takeover = 1, takeover_at = ?, updated_at = ? WHERE id = ?')
          .bind(now, now, conversationId)
          .run();
        logger.info('Auto-paused AI: Handover or human review triggered', {
          conversationId,
          leadStatus: qualification.leadStatus,
          statusReason: qualification.statusReason,
          humanReviewReason: qualification.humanReviewReason,
        });
      }

      // 10. Outbound Reply Dispatch: Authoritative safety check
      if (qualification.replyText) {
        // Run server-side reply policy check (defense-in-depth against unauthorized price quoting)
        const policyCheck = evaluateReplyPolicy(qualification.replyText);
        const isPolicyViolation = !policyCheck.allowed;

        if (isPolicyViolation) {
          logger.warn('Suppressed auto-dispatch due to policy violation', {
            conversationId,
            reason: policyCheck.reason,
            flag: policyCheck.flag,
          });
        }

        // Strict guard: NEVER auto-dispatch if human review is required, handover requested, takeover is active, policy violated, or ai_mode disables auto-send
        const isAutoDispatch =
          !requiresHumanReview &&
          !isPolicyViolation &&
          (conversation.ai_mode as string) !== 'DRAFT_REVIEW' &&
          (conversation.ai_mode as string) !== 'OFF';

        if (isAutoDispatch) {
          // Outbound deduplication: check if an outbound message has already been delivered for this webhook event / message
          const existingDelivered = await env.DB
            .prepare(
              `SELECT id FROM messages 
               WHERE conversation_id = ? AND direction = 'outbound' AND delivery_status = 'delivered' AND created_at >= ? LIMIT 1`
            )
            .bind(conversationId, now - 5000)
            .first<any>();

          if (existingDelivered) {
            logger.warn('Skipped duplicate outbound dispatch within 5s window', { conversationId });
          } else {
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
        } else {
          // Staged as draft for staff review (Section 8 & 10)
          await draftRepository.createDraft(env.DB, tenantId, {
            conversationId,
            leadId,
            suggestedText: qualification.replyText,
            rationale: qualification.rationale || qualification.statusReason || (requiresHumanReview ? 'Awaiting human review' : isPolicyViolation ? policyCheck.reason : 'AI generated response awaiting review'),
          });
          logger.info('Staged AI reply in message_drafts for staff review', {
            conversationId,
            leadId,
            leadStatus: qualification.leadStatus,
            requiresHumanReview,
            isPolicyViolation,
          });
        }
      }

      // 11. Mark webhook event completed
      await env.DB
        .prepare("UPDATE webhook_events SET status = 'completed', processed_at = ? WHERE id = ?")
        .bind(now, eventId)
        .run();

      message.ack();
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : String(err);
      logger.error('Error processing queue message for event', err, { eventId });
      try {
        // Reset status to 'enqueued' so queue redelivery attempts are processed by lock query
        await env.DB
          .prepare("UPDATE webhook_events SET status = 'enqueued', error_message = ?, attempts = attempts + 1 WHERE id = ?")
          .bind(errText, eventId)
          .run();
      } catch {}
      message.retry();
    }
  }
}
