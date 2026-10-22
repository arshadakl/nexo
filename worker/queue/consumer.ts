import { openAiCompatibleAdapter } from '../adapters/ai/openAiCompatible';
import { aiProviderRepository } from '../repositories/aiProviderRepository';
import { knowledgeRepository } from '../repositories/knowledgeRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { buildResiderSystemPrompt } from '../lib/residerPrompt';
import { evaluateReplyPolicy, extractPriceFigures } from '../lib/policyEngine';
import { mergeLeadProfile, resolveQualification } from '../lib/leadProfile';
import {
  detectLanguageHint,
  hasCustomerText,
  historyText,
  isUnsupportedFallbackText,
  isUnsupportedType,
  unsupportedFallbackText,
} from '../lib/inboundContent';
import { getAutomationSnapshot } from '../services/conversationAutomation';
import { dispatchOutboundText } from '../services/outboundDispatch';
import { logger } from '../lib/logger';
import type { WorkerEnv } from '../env';
import type { PromptMessage } from '../adapters/ai/adapter.interface';
import type { AIQualificationResult } from '@shared/types/ai.types';
import type { DraftReviewKind } from '@shared/types/draft.types';

/**
 * Inbound processing works per conversation turn, not per webhook event:
 *
 * 1. Each inbound message is persisted first (idempotent on provider_message_id) and enqueued with
 *    a short delay (INBOUND_DEBOUNCE_SECONDS) so rapidly consecutive messages form one turn.
 * 2. A job whose message is not the newest unprocessed one defers to the newer message's job.
 * 3. A per-conversation lease prevents overlapping workers from processing the same thread.
 * 4. All unprocessed inbound messages are answered together using the full recent history.
 * 5. Before a reply is sent, newly arrived messages are rechecked; an outdated reply is regenerated.
 * 6. Nothing is generated while the conversation is paused (approval pending, send failed, human
 *    takeover, AI off). Messages stay unprocessed and are handled once after the pause ends.
 */

const LEASE_MS = 90_000;
const MAX_TURN_PASSES = 3;
const HISTORY_LIMIT = 30;
const LEASE_RETRY_DELAY_SECONDS = 5;

export class LeaseBusyError extends Error {
  constructor() {
    super('Conversation is being processed by another worker');
    this.name = 'LeaseBusyError';
  }
}

interface InboundRow {
  id: string;
  provider_message_id: string | null;
  message_text: string;
  message_type: string;
  created_at: number;
}

export async function processQueueBatch(
  batch: MessageBatch<any>,
  env: WorkerEnv
): Promise<void> {
  const masterKey = env.META_TOKEN_ENCRYPTION_KEY || 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

  for (const message of batch.messages) {
    const payload = message.body;
    const eventId = payload?.eventId;

    try {
      // Follow-up job (approval sent, takeover released, resume, sweep): process waiting messages once.
      if (payload?.kind === 'process_conversation') {
        if (payload.tenantId && payload.conversationId) {
          await processConversationTurn(env, masterKey, payload.tenantId, payload.conversationId, null);
        }
        message.ack();
        continue;
      }

      if (!eventId) {
        message.ack();
        continue;
      }

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

      // 3. Find or create conversation in D1
      let conversation = await env.DB
        .prepare('SELECT id FROM conversations WHERE connection_id = ? AND provider_convo_id = ?')
        .bind(connectionId, providerConvoId)
        .first<{ id: string }>();

      let conversationId: string;
      if (!conversation) {
        conversationId = crypto.randomUUID();
        await env.DB
          .prepare(
            `INSERT INTO conversations (
              id, tenant_id, connection_id, channel, provider_convo_id,
              customer_id, customer_name, ai_mode, human_takeover,
              unread_count, last_message_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ON', 0, 0, ?, ?, ?)
            ON CONFLICT(connection_id, provider_convo_id) DO NOTHING`
          )
          .bind(conversationId, tenantId, connectionId, provider, providerConvoId, senderId, senderName, now, now, now)
          .run();
        conversation = await env.DB
          .prepare('SELECT id FROM conversations WHERE connection_id = ? AND provider_convo_id = ?')
          .bind(connectionId, providerConvoId)
          .first<{ id: string }>();
      }
      conversationId = conversation!.id;

      // 4. Persist the inbound message before any processing (the webhook route may already have).
      const inserted = await conversationRepository.insertInboundMessage(env.DB, {
        tenantId,
        conversationId,
        providerMessageId,
        senderId,
        messageText: rawEvent.messageText || '',
        messageType: rawEvent.messageType,
        attachments: rawEvent.attachments,
        timestamp: rawEvent.timestamp,
      });
      if (inserted) {
        await env.DB
          .prepare('UPDATE conversations SET last_message_at = ?, last_inbound_at = ?, unread_count = unread_count + 1, updated_at = ? WHERE id = ?')
          .bind(now, now, now, conversationId)
          .run();
      }

      // 5. Process the conversation turn this message belongs to.
      await processConversationTurn(env, masterKey, tenantId, conversationId, { providerMessageId });

      await env.DB
        .prepare("UPDATE webhook_events SET status = 'completed', processed_at = ? WHERE id = ?")
        .bind(Date.now(), eventId)
        .run();

      message.ack();
    } catch (err: unknown) {
      const busy = err instanceof LeaseBusyError;
      const errText = err instanceof Error ? err.message : String(err);
      if (!busy) logger.error('Error processing queue message for event', err, { eventId });
      try {
        if (eventId) {
          // Reset status to 'enqueued' so queue redelivery attempts are processed by lock query
          await env.DB
            .prepare("UPDATE webhook_events SET status = 'enqueued', error_message = ? WHERE id = ?")
            .bind(busy ? null : errText, eventId)
            .run();
        }
      } catch {}
      message.retry(busy ? { delaySeconds: LEASE_RETRY_DELAY_SECONDS } : undefined);
    }
  }
}

async function listUnprocessedInbound(db: D1Database, conversationId: string): Promise<InboundRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, provider_message_id, message_text, message_type, created_at
       FROM messages
       WHERE conversation_id = ? AND direction = 'inbound' AND ai_processed_at IS NULL
       ORDER BY created_at ASC, id ASC`
    )
    .bind(conversationId)
    .all<InboundRow>();
  return rows.results || [];
}

function markProcessedStatement(db: D1Database, ids: string[], at: number) {
  return db
    .prepare(`UPDATE messages SET ai_processed_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(at, ...ids);
}

export type TurnOutcome = 'paused' | 'nothing' | 'deferred' | 'handled' | 'no_provider';

/**
 * Handles every unprocessed inbound message of a conversation as one turn.
 * Throws LeaseBusyError when another worker holds the conversation.
 */
export async function processConversationTurn(
  env: WorkerEnv,
  masterKey: string,
  tenantId: string,
  conversationId: string,
  trigger: { providerMessageId: string } | null
): Promise<TurnOutcome> {
  const snapshot = await getAutomationSnapshot(env.DB, conversationId);
  if (!snapshot || snapshot.state !== 'ai_active') {
    logger.info('AI reply skipped: conversation is paused', { conversationId, state: snapshot?.state });
    return 'paused';
  }

  const pending = await listUnprocessedInbound(env.DB, conversationId);
  if (pending.length === 0) return 'nothing';

  // Debounce: the job of the newest message in the turn handles the whole turn.
  if (trigger) {
    const mine = pending.find((m) => m.provider_message_id === trigger.providerMessageId);
    const newest = pending[pending.length - 1]!;
    if (mine && Number(newest.created_at) > Number(mine.created_at)) return 'deferred';
  }

  const leaseOwner = crypto.randomUUID();
  const now = Date.now();
  const lease = await env.DB
    .prepare(
      `UPDATE conversations SET lease_owner = ?, lease_expires_at = ?
       WHERE id = ? AND (lease_owner IS NULL OR lease_expires_at IS NULL OR lease_expires_at < ?)`
    )
    .bind(leaseOwner, now + LEASE_MS, conversationId, now)
    .run();
  if (lease.meta.changes === 0) throw new LeaseBusyError();

  let outcome: TurnOutcome = 'nothing';
  try {
    for (let pass = 0; pass < MAX_TURN_PASSES; pass++) {
      const current = await getAutomationSnapshot(env.DB, conversationId);
      if (!current || current.state !== 'ai_active') {
        outcome = 'paused';
        break;
      }
      const turn = await listUnprocessedInbound(env.DB, conversationId);
      if (turn.length === 0) break;

      const result = await handleTurn(env, masterKey, tenantId, conversationId, turn);
      if (result === 'superseded') continue; // Newer messages arrived while generating; regenerate.
      outcome = result;
      if (result !== 'handled') break;
      // Loop again to pick up messages that arrived while this turn was being handled.
    }
  } finally {
    await env.DB
      .prepare('UPDATE conversations SET lease_owner = NULL, lease_expires_at = NULL WHERE id = ? AND lease_owner = ?')
      .bind(conversationId, leaseOwner)
      .run();
  }
  return outcome;
}

async function handleTurn(
  env: WorkerEnv,
  masterKey: string,
  tenantId: string,
  conversationId: string,
  turn: InboundRow[]
): Promise<TurnOutcome | 'superseded'> {
  const db = env.DB;
  const turnIds = turn.map((m) => m.id);
  const turnLatestAt = Math.max(...turn.map((m) => Number(m.created_at)));

  const conversation = await db
    .prepare('SELECT id, connection_id, channel, customer_id, customer_name FROM conversations WHERE id = ?')
    .bind(conversationId)
    .first<any>();
  if (!conversation) return 'nothing';
  const target = {
    connectionId: conversation.connection_id,
    channel: conversation.channel as 'instagram' | 'whatsapp',
    customerId: conversation.customer_id,
  };

  const lead = await db
    .prepare(
      `SELECT l.* FROM lead_conversation_links lcl
       JOIN leads l ON l.id = lcl.lead_id
       WHERE lcl.conversation_id = ?
       ORDER BY lcl.linked_at DESC LIMIT 1`
    )
    .bind(conversationId)
    .first<any>();

  const textMessages = turn.filter((m) => hasCustomerText(m.message_type, m.message_text));
  const hasUnsupported = turn.some((m) => isUnsupportedType(m.message_type));

  // Voice notes / attachments with no readable text: one honest text-request fallback, no model call.
  if (textMessages.length === 0) {
    const kind = turn.some((m) => m.message_type === 'audio') ? 'audio' : 'attachment';
    const recentText = await db
      .prepare(
        `SELECT message_text FROM messages WHERE conversation_id = ? AND direction = 'inbound' AND message_type = 'text'
         ORDER BY created_at DESC LIMIT 5`
      )
      .bind(conversationId)
      .all<{ message_text: string }>();
    const language = detectLanguageHint((recentText.results || []).map((r) => r.message_text), lead?.detected_language);
    const lastOutbound = await db
      .prepare(
        `SELECT message_text, created_at FROM messages WHERE conversation_id = ? AND direction = 'outbound'
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(conversationId)
      .first<{ message_text: string; created_at: number }>();

    // Already asked for text and the customer has not typed anything since: don't repeat it.
    if (isUnsupportedFallbackText(lastOutbound?.message_text)) {
      await markProcessedStatement(db, turnIds, Date.now()).run();
      return 'handled';
    }
    await sendAutoReply(db, masterKey, tenantId, conversationId, target, unsupportedFallbackText(kind, language), turnIds, turnLatestAt);
    return 'handled';
  }

  const aiConfig = await aiProviderRepository.getDefaultDecrypted(db, tenantId, masterKey);
  if (!aiConfig) {
    logger.warn('No active default AI provider configured for tenant', { tenantId });
    return 'no_provider';
  }

  const turnText = textMessages.map((m) => m.message_text).join('\n').toLowerCase();
  const isBusinessInquiry = /business|company|licen[cs]e/.test(turnText);
  const isResidencyInquiry = /visa|freelance|residency/.test(turnText);
  let approvedKnowledge = await knowledgeRepository.listApprovedKnowledge(db, tenantId);
  if (isBusinessInquiry && !isResidencyInquiry) {
    approvedKnowledge = approvedKnowledge.filter((k) => k.category === 'business_service' || k.category === 'policy' || k.category === 'faq');
  } else if (isResidencyInquiry && !isBusinessInquiry) {
    approvedKnowledge = approvedKnowledge.filter((k) => k.category === 'residency_package' || k.category === 'policy' || k.category === 'faq');
  }

  const historyRows = await db
    .prepare(
      `SELECT sender_type, message_text, message_type, delivery_status, metadata_json, created_at
       FROM (
         SELECT sender_type, message_text, message_type, delivery_status, metadata_json, created_at, id
         FROM messages
         WHERE conversation_id = ? AND TRIM(message_text) != ''
         ORDER BY created_at DESC, id DESC
         LIMIT ${HISTORY_LIMIT}
       )
       ORDER BY created_at ASC, id ASC`
    )
    .bind(conversationId)
    .all<any>();
  const history = historyRows.results || [];

  const confirmedFields = parseJsonArray(lead?.confirmed_fields_json);
  const systemPrompt = buildResiderSystemPrompt({
    lead: lead
      ? {
          fullName: lead.full_name,
          phoneOrEmail: lead.phone_or_email,
          whatsappNumber: lead.whatsapp_number,
          whatsappSameAsPhone: lead.whatsapp_same_as_phone === 1,
          contactPending: lead.contact_pending === 1,
          nationality: lead.nationality,
          currentCountry: lead.current_country,
          currentCity: lead.current_city,
          currentLocation: lead.current_location,
          visaStatus: lead.visa_status,
          profession: lead.profession,
          workBusinessActivity: lead.work_business_activity,
          serviceVertical: lead.service_vertical,
          residencyIntent: lead.residency_intent,
          uaeLocationContext: lead.uae_location_context,
          targetEmirate: lead.target_emirate,
          timeline: lead.timeline,
          contactMethodPreference: lead.contact_method_preference,
          contactPermission: lead.contact_permission === 1,
          whatsappContactPermission: lead.whatsapp_contact_permission === 1,
          externalSharingPermission: lead.external_sharing_permission === 1,
          leadStatus: lead.lead_status,
          qualification: lead.qualification,
          confirmedFields,
          missingDetails: parseJsonArray(lead.missing_details_json),
        }
      : null,
    customerName:
      conversation.customer_name && conversation.customer_name !== 'Instagram User' ? conversation.customer_name : null,
    channel: target.channel,
    approvedKnowledge,
    turn: { messages: textMessages.map((m) => m.message_text), hasUnsupportedAttachment: hasUnsupported },
    messageDate: new Date(turnLatestAt).toISOString().slice(0, 10),
  });

  const promptMessages: PromptMessage[] = [{ role: 'system', content: systemPrompt }];
  for (const m of history) {
    promptMessages.push({
      role: m.sender_type === 'applicant' ? 'user' : 'assistant',
      content: historyText(m.message_type, m.message_text),
    });
  }

  const qualification = await openAiCompatibleAdapter.generateQualification(aiConfig, promptMessages);

  // Recheck before acting: a reply written before the customer's newest message is outdated.
  const newer = await db
    .prepare(
      `SELECT id FROM messages WHERE conversation_id = ? AND direction = 'inbound'
       AND ai_processed_at IS NULL AND created_at > ? LIMIT 1`
    )
    .bind(conversationId, turnLatestAt)
    .first<{ id: string }>();
  if (newer) return 'superseded';

  // A human may have taken over while the model was generating.
  const gate = await getAutomationSnapshot(db, conversationId);
  if (!gate || gate.state !== 'ai_active') return 'paused';

  const leadId = await upsertLead(db, tenantId, conversationId, lead, qualification, turnLatestAt);

  // Figures a reviewer already sent to this customer may be repeated for this customer only.
  const approvedFigures = history
    .filter((m) => m.sender_type === 'staff' || (m.metadata_json && String(m.metadata_json).includes('"draftId"')))
    .filter((m) => m.delivery_status === 'delivered' || m.delivery_status === 'read' || m.delivery_status === 'sent')
    .flatMap((m) => extractPriceFigures(m.message_text));

  const replyText = qualification.replyText?.trim() || null;
  const policy = replyText ? evaluateReplyPolicy(replyText, { approvedFigures }) : null;
  const isPolicyViolation = Boolean(policy && !policy.allowed);
  const isModelFallback = qualification.safetyFlags.some((f) => f === 'INVALID_MODEL_OUTPUT' || f === 'JSON_PARSE_EXCEPTION');
  const isHumanRequest = qualification.intent === 'human_request' || qualification.leadStatus === 'handover_requested';
  const needsReview =
    Boolean(qualification.humanReviewRequired) || isHumanRequest || isModelFallback || isPolicyViolation;

  if (needsReview) {
    const reviewKind: DraftReviewKind =
      qualification.reviewKind ||
      (isModelFallback ? 'model_fallback' : isPolicyViolation ? 'policy_block' : isHumanRequest ? 'human_requested' : 'ai_review');
    const reviewReason =
      qualification.reviewerMustConfirm ||
      qualification.humanReviewReason ||
      (isPolicyViolation ? policy?.reason : null) ||
      qualification.statusReason ||
      'Reply needs human review before sending';
    const draftNow = Date.now();
    await db.batch([
      db
        .prepare(
          `INSERT INTO message_drafts (
            id, tenant_id, conversation_id, lead_id, suggested_text, rationale, status, created_at,
            review_kind, review_reason, customer_question, based_on_message_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          tenantId,
          conversationId,
          leadId,
          replyText || '',
          qualification.rationale || qualification.statusReason || null,
          draftNow,
          reviewKind,
          reviewReason,
          qualification.customerQuestion || textMessages.map((m) => m.message_text).join('\n'),
          turnLatestAt,
          draftNow
        ),
      markProcessedStatement(db, turnIds, draftNow),
    ]);
    logger.info('Reply held for human approval', { conversationId, leadId, reviewKind, isPolicyViolation });
    return 'handled';
  }

  if (!replyText) {
    await markProcessedStatement(db, turnIds, Date.now()).run();
    return 'handled';
  }

  await sendAutoReply(db, masterKey, tenantId, conversationId, target, replyText, turnIds, turnLatestAt);
  return 'handled';
}

/**
 * Records the outbound reply and marks the turn processed atomically, then dispatches.
 * A crash after this point leaves a 'pending' message, never a duplicate reply.
 */
async function sendAutoReply(
  db: D1Database,
  masterKey: string,
  tenantId: string,
  conversationId: string,
  target: { connectionId: string; channel: 'instagram' | 'whatsapp'; customerId: string },
  text: string,
  turnIds: string[],
  turnLatestAt: number
) {
  const outboundId = crypto.randomUUID();
  const at = Math.max(Date.now(), turnLatestAt + 1); // Keep the reply after the messages it answers.
  await db.batch([
    db
      .prepare(
        `INSERT INTO messages (
          id, tenant_id, conversation_id, direction, sender_type,
          message_text, message_type, delivery_status, created_at
        ) VALUES (?, ?, ?, 'outbound', 'ai', ?, 'text', 'pending', ?)`
      )
      .bind(outboundId, tenantId, conversationId, text, at),
    markProcessedStatement(db, turnIds, at),
    db
      .prepare('UPDATE conversations SET last_message_at = ?, last_outbound_at = ?, updated_at = ? WHERE id = ?')
      .bind(at, at, at, conversationId),
  ]);

  const result = await dispatchOutboundText(db, masterKey, target, text);
  if (result.ok) {
    await conversationRepository.updateMessageDelivery(db, outboundId, 'delivered', result.providerMessageId || undefined);
  } else {
    await conversationRepository.updateMessageDelivery(db, outboundId, 'failed', undefined, result.error);
  }
}

function parseJsonArray<T = string>(value: unknown): T[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function upsertLead(
  db: D1Database,
  tenantId: string,
  conversationId: string,
  existing: any | null,
  qualification: AIQualificationResult,
  messageAt: number
): Promise<string> {
  const now = Date.now();
  let leadId: string = existing?.id;

  if (!existing) {
    leadId = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO leads (id, tenant_id, detected_language, lead_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(leadId, tenantId, qualification.language || 'en', qualification.leadStatus, now, now),
      db
        .prepare(
          `INSERT INTO lead_conversation_links (id, tenant_id, lead_id, conversation_id, link_method, confidence, linked_at)
           VALUES (?, ?, ?, ?, 'auto_customer_id', 1.0, ?)
           ON CONFLICT(lead_id, conversation_id) DO NOTHING`
        )
        .bind(crypto.randomUUID(), tenantId, leadId, conversationId, now),
    ]);
  }

  const confirmed = new Set(parseJsonArray(existing?.confirmed_fields_json));
  const merge = mergeLeadProfile(
    existing
      ? {
          fullName: existing.full_name,
          phoneOrEmail: existing.phone_or_email,
          whatsappNumber: existing.whatsapp_number,
          nationality: existing.nationality,
          currentCountry: existing.current_country,
          currentCity: existing.current_city,
          currentLocation: existing.current_location,
          targetEmirate: existing.target_emirate,
          visaStatus: existing.visa_status,
          timeline: existing.timeline,
          profession: existing.profession,
          workBusinessActivity: existing.work_business_activity,
          serviceVertical: existing.service_vertical,
          residencyIntent: existing.residency_intent,
          uaeLocationContext: existing.uae_location_context,
          confirmedFields: [...confirmed],
        }
      : null,
    qualification,
    messageAt
  );

  const set: Record<string, string | number | null> = { ...merge.columns };
  const fields = qualification.extractedFields || {};
  if (fields.contactPermission) set.contact_permission = 1;
  if (fields.whatsappContactPermission) set.whatsapp_contact_permission = 1;
  if (fields.externalSharingPermission) set.external_sharing_permission = 1;
  if (fields.contactMethodPreference) set.contact_method_preference = fields.contactMethodPreference;
  if (fields.whatsappSameAsPhone) set.whatsapp_same_as_phone = 1;

  set.lead_status = qualification.leadStatus;
  if (qualification.statusReason) set.status_reason = qualification.statusReason;
  if (qualification.language) set.detected_language = qualification.language;
  set.missing_details_json = JSON.stringify(qualification.missingFields || []);
  if (qualification.unansweredQuestions?.length) set.unanswered_questions_json = JSON.stringify(qualification.unansweredQuestions);
  if (qualification.confusions?.length) set.confusions_json = JSON.stringify(qualification.confusions);
  if (qualification.needSummary && !confirmed.has('summary')) set.summary = qualification.needSummary;
  if (qualification.nextAction && !confirmed.has('nextAction')) set.next_action = qualification.nextAction;

  if (!confirmed.has('qualification')) {
    const q = resolveQualification(qualification.qualification, qualification.qualificationReason, qualification.leadStatus);
    if (q) {
      set.qualification = q.qualification;
      set.qualification_reason = q.reason;
    }
  }

  const newSuggestions = [
    ...merge.suggestions,
    ...(qualification.ambiguousStatements || []).map((s) => ({ field: 'statement', value: s, at: messageAt })),
  ];
  if (newSuggestions.length > 0) {
    const previous = parseJsonArray(existing?.ai_suggestions_json);
    set.ai_suggestions_json = JSON.stringify([...previous, ...newSuggestions].slice(-20));
  }

  set.last_qualified_at = now;
  set.updated_at = now;

  const columns = Object.keys(set);
  await db
    .prepare(`UPDATE leads SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .bind(...columns.map((c) => set[c]), leadId)
    .run();

  if (typeof set.full_name === 'string' && set.full_name) {
    await db
      .prepare('UPDATE conversations SET customer_name = ?, updated_at = ? WHERE id = ?')
      .bind(set.full_name, now, conversationId)
      .run();
  }

  return leadId;
}
