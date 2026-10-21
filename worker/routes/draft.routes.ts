import { Hono } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import { draftRepository } from '../repositories/draftRepository';
import { connectionRepository } from '../repositories/connectionRepository';
import { instagramSendApiAdapter } from '../adapters/meta/instagramSendApi';
import { whatsappSendApiAdapter } from '../adapters/meta/whatsappSendApi';
import { resolveTenantId, resolveUserId } from '../lib/authContext';
import type { WorkerEnv } from '../env';

export const draftRoutes = new Hono<{ Bindings: WorkerEnv }>();

/**
 * GET /api/drafts/pending
 * Lists all drafts awaiting human review.
 */
draftRoutes.get('/pending', async (c) => {
  const tenantId = resolveTenantId(c);
  const drafts = await draftRepository.listPendingDrafts(c.env.DB, tenantId);
  return jsonOk(c, drafts);
});

/**
 * GET /api/drafts/conversation/:id
 * Retrieves the latest pending draft for a specific conversation.
 */
draftRoutes.get('/conversation/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const conversationId = c.req.param('id');

  const draft = await draftRepository.getPendingDraft(c.env.DB, tenantId, conversationId);
  return jsonOk(c, draft);
});

/**
 * POST /api/drafts/:id/approve
 * Approves a staged AI draft and dispatches it through the Meta Send API.
 */
draftRoutes.post('/:id/approve', async (c) => {
  const tenantId = resolveTenantId(c);
  const userId = resolveUserId(c);
  const draftId = c.req.param('id');
  const masterKey = c.env.META_TOKEN_ENCRYPTION_KEY || 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

  const draft = await draftRepository.getDraftById(c.env.DB, tenantId, draftId);
  if (!draft) {
    return jsonError(c, 'NOT_FOUND', 'Draft not found', 404);
  }

  if (draft.status !== 'pending_review') {
    return jsonError(c, 'CONFLICT', `Draft is already in status '${draft.status}'`, 409);
  }

  const convo = await c.env.DB
    .prepare('SELECT id, connection_id, channel, customer_id FROM conversations WHERE id = ? AND tenant_id = ?')
    .bind(draft.conversationId, tenantId)
    .first<any>();

  if (!convo) {
    return jsonError(c, 'NOT_FOUND', 'Associated conversation not found', 404);
  }

  const now = Date.now();
  const textToSend = draft.suggestedText;

  // 1. Record outbound message in database
  const messageId = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO messages (
        id, tenant_id, conversation_id, direction, sender_type,
        message_text, message_type, delivery_status, created_at
      ) VALUES (?, ?, ?, 'outbound', 'ai', ?, 'text', 'pending', ?)`
    )
    .bind(messageId, tenantId, draft.conversationId, textToSend, now)
    .run();

  // 2. Dispatch via channel adapter
  const connection = await connectionRepository.getByIdDecrypted(c.env.DB, convo.connection_id, masterKey);
  let dispatchedMessageId = `msg_${now}`;

  if (connection && connection.accessToken) {
    if (convo.channel === 'whatsapp') {
      const sendResult = await whatsappSendApiAdapter.sendMessage({
        phoneNumberId: connection.phoneNumberId || connection.externalAccountId,
        accessToken: connection.accessToken,
        recipientPhone: convo.customer_id,
        text: textToSend,
      });
      dispatchedMessageId = sendResult.messageId;
    } else {
      const sendResult = await instagramSendApiAdapter.sendMessage({
        accessToken: connection.accessToken,
        recipientId: convo.customer_id,
        text: textToSend,
      });
      dispatchedMessageId = sendResult.messageId;
    }

    await c.env.DB
      .prepare("UPDATE messages SET provider_message_id = ?, delivery_status = 'delivered' WHERE id = ?")
      .bind(dispatchedMessageId, messageId)
      .run();
  }

  // 3. Update conversation last message time
  await c.env.DB
    .prepare('UPDATE conversations SET last_message_at = ?, last_outbound_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, now, draft.conversationId)
    .run();

  // 4. Mark draft as approved
  const updatedDraft = await draftRepository.resolveDraft(
    c.env.DB,
    tenantId,
    draftId,
    'approved_sent',
    null,
    userId
  );

  return jsonOk(c, updatedDraft);
});

/**
 * POST /api/drafts/:id/modify
 * Modifies the draft text and dispatches through the Meta Send API.
 */
draftRoutes.post('/:id/modify', async (c) => {
  const tenantId = resolveTenantId(c);
  const userId = resolveUserId(c);
  const draftId = c.req.param('id');
  const masterKey = c.env.META_TOKEN_ENCRYPTION_KEY || 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const modifiedText = typeof rawBody.modifiedText === 'string' ? rawBody.modifiedText.trim() : '';
  if (!modifiedText) {
    return jsonError(c, 'VALIDATION_ERROR', 'modifiedText is required', 400);
  }

  const draft = await draftRepository.getDraftById(c.env.DB, tenantId, draftId);
  if (!draft) {
    return jsonError(c, 'NOT_FOUND', 'Draft not found', 404);
  }

  const convo = await c.env.DB
    .prepare('SELECT id, connection_id, channel, customer_id FROM conversations WHERE id = ? AND tenant_id = ?')
    .bind(draft.conversationId, tenantId)
    .first<any>();

  if (!convo) {
    return jsonError(c, 'NOT_FOUND', 'Associated conversation not found', 404);
  }

  const now = Date.now();

  // 1. Record outbound message in database
  const messageId = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO messages (
        id, tenant_id, conversation_id, direction, sender_type,
        message_text, message_type, delivery_status, created_at
      ) VALUES (?, ?, ?, 'outbound', 'staff', ?, 'text', 'pending', ?)`
    )
    .bind(messageId, tenantId, draft.conversationId, modifiedText, now)
    .run();

  // 2. Dispatch via channel adapter
  const connection = await connectionRepository.getByIdDecrypted(c.env.DB, convo.connection_id, masterKey);
  let dispatchedMessageId = `msg_${now}`;

  if (connection && connection.accessToken) {
    if (convo.channel === 'whatsapp') {
      const sendResult = await whatsappSendApiAdapter.sendMessage({
        phoneNumberId: connection.phoneNumberId || connection.externalAccountId,
        accessToken: connection.accessToken,
        recipientPhone: convo.customer_id,
        text: modifiedText,
      });
      dispatchedMessageId = sendResult.messageId;
    } else {
      const sendResult = await instagramSendApiAdapter.sendMessage({
        accessToken: connection.accessToken,
        recipientId: convo.customer_id,
        text: modifiedText,
      });
      dispatchedMessageId = sendResult.messageId;
    }

    await c.env.DB
      .prepare("UPDATE messages SET provider_message_id = ?, delivery_status = 'delivered' WHERE id = ?")
      .bind(dispatchedMessageId, messageId)
      .run();
  }

  // 3. Update conversation last message time
  await c.env.DB
    .prepare('UPDATE conversations SET last_message_at = ?, last_outbound_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, now, draft.conversationId)
    .run();

  // 4. Mark draft as modified_sent
  const updatedDraft = await draftRepository.resolveDraft(
    c.env.DB,
    tenantId,
    draftId,
    'modified_sent',
    modifiedText,
    userId
  );

  return jsonOk(c, updatedDraft);
});

/**
 * POST /api/drafts/:id/reject
 * Rejects a draft without sending.
 */
draftRoutes.post('/:id/reject', async (c) => {
  const tenantId = resolveTenantId(c);
  const userId = resolveUserId(c);
  const draftId = c.req.param('id');

  const draft = await draftRepository.getDraftById(c.env.DB, tenantId, draftId);
  if (!draft) {
    return jsonError(c, 'NOT_FOUND', 'Draft not found', 404);
  }

  const updatedDraft = await draftRepository.resolveDraft(
    c.env.DB,
    tenantId,
    draftId,
    'rejected',
    null,
    userId
  );

  return jsonOk(c, updatedDraft);
});
