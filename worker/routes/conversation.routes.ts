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
import type { WorkerEnv } from '../env';
import type { ChannelType, ConversationStatus } from '@shared/types/crm.types';

import { resolveTenantId, resolveUserId, getMasterKey } from '../lib/authContext';

export const conversationRoutes = new Hono<{ Bindings: WorkerEnv }>();

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

  return jsonOk(c, {
    success: true,
    conversationId,
    humanTakeover: parseResult.data.takeover,
  });
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
