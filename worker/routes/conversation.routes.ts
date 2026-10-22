import { Hono } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import { conversationRepository } from '../repositories/conversationRepository';
import { connectionRepository } from '../repositories/connectionRepository';
import { instagramSendApiAdapter } from '../adapters/meta/instagramSendApi';
import { whatsappSendApiAdapter } from '../adapters/meta/whatsappSendApi';
import {
  SendMessageSchema,
  TakeoverSchema,
  SetAIModeSchema,
  CreateNoteSchema,
} from '@shared/schemas/conversation.schema';
import { leadRepository } from '../repositories/leadRepository';
import { logger } from '../lib/logger';
import { continueIfClear, resumeAI } from '../services/conversationAutomation';
import { dispatchOutboundText } from '../services/outboundDispatch';
import { sendDraft } from '../services/draftLifecycle';
import type { WorkerEnv } from '../env';
import type { ChannelType, ConversationStatus } from '@shared/types/crm.types';

import { resolveTenantId, resolveUserId, getMasterKey } from '../lib/authContext';

export const conversationRoutes = new Hono<{ Bindings: WorkerEnv }>();

/**
 * POST /api/conversations/reset-testing
 * Complete workspace data reset for testing:
 * Removes all conversations, messages, message drafts, leads, lead_conversation_links,
 * and webhook_events for the tenant.
 * Preserves users, memberships, sessions, integration_connections, and tenant_ai_providers.
 */
conversationRoutes.post('/reset-testing', async (c) => {
  const tenantId = resolveTenantId(c);

  // 1. Delete message drafts
  await c.env.DB.prepare('DELETE FROM message_drafts WHERE tenant_id = ?').bind(tenantId).run();

  // 2. Delete messages
  await c.env.DB.prepare('DELETE FROM messages WHERE tenant_id = ?').bind(tenantId).run();

  // 3. Delete lead conversation links
  await c.env.DB.prepare('DELETE FROM lead_conversation_links WHERE tenant_id = ?').bind(tenantId).run();

  // 4. Delete leads
  await c.env.DB.prepare('DELETE FROM leads WHERE tenant_id = ?').bind(tenantId).run();

  // 5. Delete conversations
  await c.env.DB.prepare('DELETE FROM conversations WHERE tenant_id = ?').bind(tenantId).run();

  // 6. Delete webhook events
  await c.env.DB.prepare('DELETE FROM webhook_events WHERE tenant_id = ?').bind(tenantId).run();

  // 7. Delete ai runs telemetry
  await c.env.DB.prepare('DELETE FROM ai_runs WHERE tenant_id = ?').bind(tenantId).run();

  logger.info('Purged all testing communication and lead records for tenant', { tenantId });

  return jsonOk(c, {
    success: true,
    message: 'Testing data reset complete. All conversations, messages, drafts, and leads have been wiped.',
  });
});

/**
 * GET /api/conversations
 * Lists conversation threads with unread counters, channel badges, and linked lead summaries.
 * CPU: < 1.5 ms.
 */
conversationRoutes.get('/', async (c) => {
  const tenantId = resolveTenantId(c);
  const channel = c.req.query('channel') as ChannelType | 'all' | undefined;
  const status = c.req.query('status') as ConversationStatus | undefined;
  const search = c.req.query('search') || undefined;
  const takeoverParam = c.req.query('takeover');
  const takeover = takeoverParam !== undefined ? takeoverParam === 'true' : undefined;

  const conversations = await conversationRepository.listConversations(c.env.DB, tenantId, {
    channel,
    status,
    search,
    takeover,
  });

  return jsonOk(c, conversations);
});

/**
 * GET /api/conversations/:id
 * Fetches detailed conversation record and marks unread messages as read.
 */
conversationRoutes.get('/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const conversationId = c.req.param('id');

  const conversation = await conversationRepository.getConversationById(
    c.env.DB,
    tenantId,
    conversationId
  );

  if (!conversation) {
    return jsonError(c, 'NOT_FOUND', 'Conversation not found', 404);
  }

  return jsonOk(c, conversation);
});

/**
 * GET /api/conversations/:id/messages
 * Retrieves chronological message thread for a conversation.
 * CPU: < 0.8 ms.
 */
conversationRoutes.get('/:id/messages', async (c) => {
  const tenantId = resolveTenantId(c);
  const conversationId = c.req.param('id');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  const messages = await conversationRepository.listMessages(
    c.env.DB,
    tenantId,
    conversationId,
    limit
  );

  return jsonOk(c, messages);
});

/**
 * POST /api/conversations/:id/messages
 * Sends a manual staff reply and dispatches it immediately via Meta Instagram Send API.
 */
conversationRoutes.post('/:id/messages', async (c) => {
  const tenantId = resolveTenantId(c);
  const staffUserId = resolveUserId(c);
  const conversationId = c.req.param('id');

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parseResult = SendMessageSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return jsonError(c, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid payload', 400);
  }

  const conversation = await conversationRepository.getConversationById(
    c.env.DB,
    tenantId,
    conversationId
  );

  if (!conversation) {
    return jsonError(c, 'NOT_FOUND', 'Conversation not found', 404);
  }

  // 1. Insert into D1 messages table with status 'pending'
  const messageRecord = await conversationRepository.insertStaffMessage(c.env.DB, {
    tenantId,
    conversationId,
    staffUserId,
    messageText: parseResult.data.messageText,
  });

  // 2. Dispatch to channel if external connection exists
  const masterKey = getMasterKey(c);
  try {
    const connection = await connectionRepository.getByIdDecrypted(
      c.env.DB,
      conversation.connectionId,
      masterKey
    );

    if (connection && connection.accessToken) {
      let dispatchedMessageId = `msg_${Date.now()}`;

      if (conversation.channel === 'whatsapp') {
        const sendResult = await whatsappSendApiAdapter.sendMessage({
          phoneNumberId: connection.phoneNumberId || connection.externalAccountId,
          accessToken: connection.accessToken,
          recipientPhone: conversation.customerId,
          text: parseResult.data.messageText,
        });
        dispatchedMessageId = sendResult.messageId;
      } else if (conversation.channel === 'instagram') {
        const sendResult = await instagramSendApiAdapter.sendMessage({
          accessToken: connection.accessToken,
          recipientId: conversation.customerId,
          text: parseResult.data.messageText,
        });
        dispatchedMessageId = sendResult.messageId;
      }

      await conversationRepository.updateMessageDelivery(
        c.env.DB,
        messageRecord.id,
        'delivered',
        dispatchedMessageId
      );
      messageRecord.deliveryStatus = 'delivered';
      messageRecord.providerMessageId = dispatchedMessageId;
    }
  } catch (err: any) {
    logger.error('Failed to dispatch staff outbound reply to messaging provider', err, {
      conversationId,
      channel: conversation.channel,
      messageId: messageRecord.id,
    });

    await conversationRepository.updateMessageDelivery(
      c.env.DB,
      messageRecord.id,
      'failed',
      undefined,
      err?.message || 'Dispatch failed'
    );
    messageRecord.deliveryStatus = 'failed';
    messageRecord.errorMessage = err?.message || 'Dispatch failed';
  }

  return jsonOk(c, messageRecord);
});

/**
 * POST /api/conversations/:id/takeover
 * Toggles human takeover status for a conversation (1 = human took over, AI paused).
 */
conversationRoutes.post('/:id/takeover', async (c) => {
  const tenantId = resolveTenantId(c);
  const userId = resolveUserId(c);
  const conversationId = c.req.param('id');

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parseResult = TakeoverSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return jsonError(c, 'VALIDATION_ERROR', 'Invalid takeover payload', 400);
  }

  await conversationRepository.setHumanTakeover(
    c.env.DB,
    tenantId,
    conversationId,
    parseResult.data.takeover,
    userId
  );

  // Releasing a takeover lets waiting customer messages be answered, unless an approval still pauses.
  const snapshot = parseResult.data.takeover
    ? null
    : await continueIfClear(c.env, tenantId, conversationId, 'takeover_released');

  return jsonOk(c, {
    success: true,
    conversationId,
    humanTakeover: parseResult.data.takeover,
    automationState: snapshot?.state ?? (parseResult.data.takeover ? 'human_takeover' : undefined),
  });
});

/**
 * POST /api/conversations/:id/resume
 * Resumes AI replies: clears human takeover and AI-off. Fails with 409 while approvals are
 * unresolved unless { discardPendingDrafts: true } is sent (discarded drafts are never sent).
 */
conversationRoutes.post('/:id/resume', async (c) => {
  const tenantId = resolveTenantId(c);
  const conversationId = c.req.param('id');
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    // Body is optional
  }

  const outcome = await resumeAI(c.env, {
    tenantId,
    conversationId,
    discardPendingDrafts: body?.discardPendingDrafts === true,
    userId: resolveUserId(c),
  });

  if (outcome.kind === 'conflict') {
    return jsonError(
      c,
      'PENDING_APPROVALS',
      outcome.sendingDrafts > 0
        ? 'An approved reply is being sent right now. Try again in a moment.'
        : `${outcome.pendingDrafts} reply awaiting approval must be resolved before resuming AI.`,
      409,
      outcome
    );
  }

  return jsonOk(c, {
    success: true,
    conversationId,
    humanTakeover: false,
    automationState: outcome.snapshot?.state ?? 'ai_active',
  });
});

/**
 * POST /api/conversations/:id/messages/:messageId/retry
 * Retries a failed outbound message. Messages sent from an approved draft retry through the draft.
 */
conversationRoutes.post('/:id/messages/:messageId/retry', async (c) => {
  const tenantId = resolveTenantId(c);
  const conversationId = c.req.param('id');
  const messageId = c.req.param('messageId');

  const message = await c.env.DB
    .prepare(
      `SELECT id, message_text, metadata_json, delivery_status FROM messages
       WHERE id = ? AND tenant_id = ? AND conversation_id = ? AND direction = 'outbound'`
    )
    .bind(messageId, tenantId, conversationId)
    .first<any>();
  if (!message) return jsonError(c, 'NOT_FOUND', 'Message not found', 404);

  let draftId: string | null = null;
  try {
    draftId = message.metadata_json ? JSON.parse(message.metadata_json).draftId || null : null;
  } catch {}

  if (draftId) {
    const outcome = await sendDraft(c.env, {
      tenantId,
      draftId,
      userId: resolveUserId(c),
      masterKey: getMasterKey(c),
      acknowledgeNewMessages: true,
      mode: 'retry',
    });
    if (outcome.kind === 'sent' || outcome.kind === 'failed') {
      const rows = await conversationRepository.listMessages(c.env.DB, tenantId, conversationId, 100);
      const updated = rows.find((m) => m.id === messageId);
      return outcome.kind === 'sent'
        ? jsonOk(c, updated)
        : jsonError(c, 'SEND_FAILED', `The reply was not delivered: ${outcome.error}`, 502, updated);
    }
    return jsonError(c, 'CONFLICT', 'This message can no longer be retried.', 409);
  }

  const claim = await c.env.DB
    .prepare(
      `UPDATE messages SET delivery_status = 'pending', error_message = NULL
       WHERE id = ? AND tenant_id = ? AND delivery_status = 'failed'`
    )
    .bind(messageId, tenantId)
    .run();
  if (claim.meta.changes === 0) {
    return jsonError(c, 'CONFLICT', `Message is in status '${message.delivery_status}' and cannot be retried`, 409);
  }

  const conversation = await conversationRepository.getConversationById(c.env.DB, tenantId, conversationId);
  if (!conversation) return jsonError(c, 'NOT_FOUND', 'Conversation not found', 404);

  const result = await dispatchOutboundText(
    c.env.DB,
    getMasterKey(c),
    { connectionId: conversation.connectionId, channel: conversation.channel, customerId: conversation.customerId },
    message.message_text
  );
  await conversationRepository.updateMessageDelivery(
    c.env.DB,
    messageId,
    result.ok ? 'delivered' : 'failed',
    result.ok ? result.providerMessageId || undefined : undefined,
    result.ok ? undefined : result.error
  );
  const rows = await conversationRepository.listMessages(c.env.DB, tenantId, conversationId, 100);
  const updated = rows.find((m) => m.id === messageId);
  return result.ok
    ? jsonOk(c, updated)
    : jsonError(c, 'SEND_FAILED', `The message was not delivered: ${result.error}`, 502, updated);
});

/**
 * POST /api/conversations/:id/ai-mode
 * Updates conversation AI mode (INHERIT, ON, OFF).
 */
conversationRoutes.post('/:id/ai-mode', async (c) => {
  const tenantId = resolveTenantId(c);
  const conversationId = c.req.param('id');

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parseResult = SetAIModeSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return jsonError(c, 'VALIDATION_ERROR', 'Invalid AI mode', 400);
  }

  await conversationRepository.setAIMode(
    c.env.DB,
    tenantId,
    conversationId,
    parseResult.data.aiMode
  );

  if (parseResult.data.aiMode !== 'OFF') {
    await continueIfClear(c.env, tenantId, conversationId, 'ai_mode_enabled');
  }

  return jsonOk(c, {
    success: true,
    conversationId,
    aiMode: parseResult.data.aiMode,
  });
});

/**
 * POST /api/conversations/:id/notes
 * Adds internal staff note attached to conversation.
 */
conversationRoutes.post('/:id/notes', async (c) => {
  const tenantId = resolveTenantId(c);
  const userId = resolveUserId(c);
  const conversationId = c.req.param('id');

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parseResult = CreateNoteSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return jsonError(c, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid note', 400);
  }

  const note = await leadRepository.createNote(c.env.DB, {
    tenantId,
    conversationId,
    authorId: userId,
    content: parseResult.data.content,
  });

  return jsonOk(c, note);
});

/**
 * DELETE /api/conversations/:id/messages
 * Clears all messages and lead data for a conversation so next incoming message is treated as a new lead.
 */
conversationRoutes.delete('/:id/messages', async (c) => {
  const tenantId = resolveTenantId(c);
  const conversationId = c.req.param('id');

  // Support deleteLead flag via query parameter (?deleteLead=true) or optional JSON body
  let deleteLead = c.req.query('deleteLead') === 'true';
  if (!deleteLead) {
    try {
      const body = await c.req.json();
      if (body && typeof body.deleteLead === 'boolean') {
        deleteLead = body.deleteLead;
      }
    } catch {
      // Body is optional on DELETE requests
    }
  }

  const conversation = await conversationRepository.getConversationById(
    c.env.DB,
    tenantId,
    conversationId
  );

  if (!conversation) {
    return jsonError(c, 'NOT_FOUND', 'Conversation not found', 404);
  }

  await conversationRepository.clearConversationHistory(
    c.env.DB,
    tenantId,
    conversationId,
    deleteLead
  );

  return jsonOk(c, {
    success: true,
    conversationId,
    deleteLead,
    message: deleteLead
      ? 'Chat history and lead data cleared.'
      : 'Chat history cleared. Lead data preserved.',
  });
});
