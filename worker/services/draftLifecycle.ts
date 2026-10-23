import type { DraftContextMessage, DraftStatus, MessageDraft } from '@shared/types/draft.types';
import { draftRepository } from '../repositories/draftRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { dispatchOutboundText } from './outboundDispatch';
import { continueIfClear, type QueueEnv } from './conversationAutomation';
import { logger } from '../lib/logger';

/**
 * Approval lifecycle for a reply held for review:
 *
 *   pending_review --approve/edit--> sending --ok--> approved_sent | modified_sent  (AI resumes if clear)
 *                                           \--error--> send_failed --retry/edit--> sending
 *   pending_review | send_failed --reject--> rejected       (nothing is sent)
 *   pending_review | send_failed --resume with discard--> superseded
 *
 * Every transition is a conditional UPDATE on the current status, so duplicate approval requests
 * cannot dispatch the same reply twice.
 */

// A 'sending' claim older than this is treated as an interrupted worker and may be retried.
const STALE_SENDING_MS = 2 * 60 * 1000;

export type SendDraftOutcome =
  | { kind: 'sent'; draft: MessageDraft }
  | { kind: 'failed'; draft: MessageDraft; error: string }
  | { kind: 'not_found' }
  | { kind: 'conflict'; status: DraftStatus }
  | { kind: 'empty' }
  | { kind: 'stale'; draft: MessageDraft; newInboundMessages: DraftContextMessage[] };

export interface SendDraftParams {
  tenantId: string;
  draftId: string;
  userId: string;
  masterKey: string;
  /** Reviewer-edited text. When absent the stored (edited or suggested) text is sent. */
  modifiedText?: string | null | undefined;
  acknowledgeNewMessages?: boolean | undefined;
  mode: 'approve' | 'retry';
}

export async function sendDraft(env: QueueEnv, params: SendDraftParams): Promise<SendDraftOutcome> {
  const { tenantId, draftId, userId } = params;
  const draft = await draftRepository.getDraftById(env.DB, tenantId, draftId);
  if (!draft) return { kind: 'not_found' };

  const allowed: DraftStatus[] = params.mode === 'approve' ? ['pending_review'] : ['send_failed', 'sending'];
  if (!allowed.includes(draft.status)) return { kind: 'conflict', status: draft.status };
  if (draft.status === 'sending' && (draft.updatedAt ?? draft.createdAt) > Date.now() - STALE_SENDING_MS) {
    return { kind: 'conflict', status: draft.status };
  }

  const edited = params.modifiedText?.trim() || null;
  const text = (edited || draft.modifiedText || draft.suggestedText || '').trim();
  if (!text) return { kind: 'empty' };

  // A reply written before the customer's latest messages may no longer fit.
  const newInboundMessages = await draftRepository.listInboundSince(env.DB, draft.conversationId, draft.basedOnMessageAt ?? null);
  if (newInboundMessages.length > 0 && !params.acknowledgeNewMessages) {
    return { kind: 'stale', draft: { ...draft, newInboundMessages }, newInboundMessages };
  }

  const now = Date.now();
  const claim = await env.DB
    .prepare(
      `UPDATE message_drafts
       SET status = 'sending', send_attempts = send_attempts + 1,
           modified_text = COALESCE(?, modified_text), reviewed_by = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?
         AND (status IN ('pending_review', 'send_failed') AND status = ?
              OR (status = 'sending' AND ? = 'retry' AND COALESCE(updated_at, created_at) < ?))`
    )
    .bind(edited, userId, now, tenantId, draftId, draft.status, params.mode, now - STALE_SENDING_MS)
    .run();
  if (claim.meta.changes === 0) {
    const latest = await draftRepository.getDraftById(env.DB, tenantId, draftId);
    return { kind: 'conflict', status: latest?.status ?? draft.status };
  }

  const isEdited = Boolean(edited || draft.modifiedText) && text !== draft.suggestedText.trim();
  let messageId: string | null = draft.sentMessageId ?? null;

  try {
    const convo = await env.DB
      .prepare('SELECT id, connection_id, channel, customer_id FROM conversations WHERE id = ? AND tenant_id = ?')
      .bind(draft.conversationId, tenantId)
      .first<any>();
    if (!convo) throw new Error('Associated conversation not found');

    const metadata = JSON.stringify({ draftId, approvedBy: userId, edited: isEdited });
    const reused = messageId
      ? await env.DB
          .prepare(
            `UPDATE messages SET message_text = ?, sender_type = ?, delivery_status = 'pending', error_message = NULL, metadata_json = ?
             WHERE id = ? AND delivery_status = 'failed'`
          )
          .bind(text, isEdited ? 'staff' : 'ai', metadata, messageId)
          .run()
      : null;
    if (!reused || reused.meta.changes === 0) {
      messageId = crypto.randomUUID();
      await env.DB.batch([
        env.DB
          .prepare(
            `INSERT INTO messages (
              id, tenant_id, conversation_id, direction, sender_type, sender_id,
              message_text, message_type, delivery_status, metadata_json, created_at
            ) VALUES (?, ?, ?, 'outbound', ?, ?, ?, 'text', 'pending', ?, ?)`
          )
          .bind(messageId, tenantId, draft.conversationId, isEdited ? 'staff' : 'ai', userId, text, metadata, now),
        env.DB.prepare('UPDATE message_drafts SET sent_message_id = ? WHERE id = ?').bind(messageId, draftId),
      ]);
    }

    const result = await dispatchOutboundText(
      env.DB,
      params.masterKey,
      { connectionId: convo.connection_id, channel: convo.channel, customerId: convo.customer_id },
      text
    );

    if (!result.ok) {
      await conversationRepository.updateMessageDelivery(env.DB, messageId as string, 'failed', undefined, result.error);
      await markSendFailed(env.DB, draftId, result.error);
      const failed = await draftRepository.getDraftById(env.DB, tenantId, draftId);
      return { kind: 'failed', draft: failed!, error: result.error };
    }

    const sentAt = Date.now();
    await env.DB.batch([
      env.DB
        .prepare("UPDATE messages SET delivery_status = 'delivered', provider_message_id = ?, error_message = NULL WHERE id = ?")
        .bind(result.providerMessageId || null, messageId),
      env.DB
        .prepare(
          `UPDATE message_drafts SET status = ?, reviewed_at = ?, last_error = NULL, updated_at = ?
           WHERE id = ? AND status = 'sending'`
        )
        .bind(isEdited ? 'modified_sent' : 'approved_sent', sentAt, sentAt, draftId),
      env.DB
        .prepare('UPDATE conversations SET last_message_at = ?, last_outbound_at = ?, updated_at = ? WHERE id = ?')
        .bind(sentAt, sentAt, sentAt, draft.conversationId),
      // Messages received before the reviewer clicked send were shown to them (approval requires
      // acknowledging them), so the sent reply answers them: do not generate a second reply.
      env.DB
        .prepare(
          `UPDATE messages SET ai_processed_at = ?
           WHERE conversation_id = ? AND direction = 'inbound' AND ai_processed_at IS NULL AND created_at <= ?`
        )
        .bind(sentAt, draft.conversationId, now),
    ]);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('Approved draft dispatch aborted', err, { draftId });
    if (messageId) await conversationRepository.updateMessageDelivery(env.DB, messageId, 'failed', undefined, error).catch(() => {});
    await markSendFailed(env.DB, draftId, error);
    const failed = await draftRepository.getDraftById(env.DB, tenantId, draftId);
    return { kind: 'failed', draft: failed!, error };
  }

  // Delivery confirmed: the approval pause for this draft is over. Resume only if nothing else pauses.
  await continueIfClear(env, tenantId, draft.conversationId, 'approved_reply_sent');
  const sent = await draftRepository.getDraftById(env.DB, tenantId, draftId);
  return { kind: 'sent', draft: sent! };
}

async function markSendFailed(db: D1Database, draftId: string, error: string) {
  await db
    .prepare(
      `UPDATE message_drafts SET status = 'send_failed', last_error = ?, updated_at = ?
       WHERE id = ? AND status = 'sending'`
    )
    .bind(error.slice(0, 500), Date.now(), draftId)
    .run();
}

export type RejectDraftOutcome =
  | { kind: 'rejected'; draft: MessageDraft }
  | { kind: 'not_found' }
  | { kind: 'conflict'; status: DraftStatus };

/**
 * Rejects a held reply without sending it, then applies the reviewer's next action:
 * take_over pauses the conversation for a human; resume_ai lets the AI handle later messages.
 */
export async function rejectDraft(
  env: QueueEnv,
  params: { tenantId: string; draftId: string; userId: string; nextAction: 'take_over' | 'resume_ai' }
): Promise<RejectDraftOutcome> {
  const draft = await draftRepository.getDraftById(env.DB, params.tenantId, params.draftId);
  if (!draft) return { kind: 'not_found' };
  if (draft.status !== 'pending_review' && draft.status !== 'send_failed') {
    return { kind: 'conflict', status: draft.status };
  }

  const now = Date.now();
  const claim = await env.DB
    .prepare(
      `UPDATE message_drafts SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ? AND status IN ('pending_review', 'send_failed')`
    )
    .bind(params.userId, now, now, params.tenantId, params.draftId)
    .run();
  if (claim.meta.changes === 0) return { kind: 'conflict', status: draft.status };

  if (params.nextAction === 'take_over') {
    await conversationRepository.setHumanTakeover(env.DB, params.tenantId, draft.conversationId, true, params.userId);
  } else {
    await continueIfClear(env, params.tenantId, draft.conversationId, 'draft_rejected_resume');
  }

  const rejected = await draftRepository.getDraftById(env.DB, params.tenantId, params.draftId);
  return { kind: 'rejected', draft: rejected! };
}
