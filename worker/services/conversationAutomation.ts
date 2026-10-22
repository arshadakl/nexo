import type { AutomationState } from '@shared/types/crm.types';
import { logger } from '../lib/logger';

/**
 * Conversation automation state model.
 *
 * Nothing stores "the" state; it is derived so it cannot drift from its causes:
 *   human_takeover   - a staff member explicitly took over (conversations.human_takeover = 1)
 *   send_failed      - an approved reply failed to send and is awaiting retry/edit/reject
 *   approval_sending - an approved reply is being dispatched right now
 *   approval_pending - a reply is waiting for human approval
 *   ai_off           - AI disabled for this conversation (ai_mode = 'OFF')
 *   ai_active        - none of the above; the AI replies automatically
 *
 * The first four pause automatic replies. Approval-related pauses end when their draft is resolved;
 * a human takeover ends only through an explicit resume.
 */

export const BLOCKING_DRAFT_STATUSES = ['pending_review', 'sending', 'send_failed'] as const;

/** SQL expression for list/detail queries; expects the conversation aliased as `c`. */
export const AUTOMATION_STATE_SQL = `
  CASE
    WHEN c.human_takeover = 1 THEN 'human_takeover'
    WHEN EXISTS (SELECT 1 FROM message_drafts d WHERE d.conversation_id = c.id AND d.status = 'send_failed') THEN 'send_failed'
    WHEN EXISTS (SELECT 1 FROM message_drafts d WHERE d.conversation_id = c.id AND d.status = 'sending') THEN 'approval_sending'
    WHEN EXISTS (SELECT 1 FROM message_drafts d WHERE d.conversation_id = c.id AND d.status = 'pending_review') THEN 'approval_pending'
    WHEN c.ai_mode = 'OFF' THEN 'ai_off'
    ELSE 'ai_active'
  END`;

export interface AutomationSnapshot {
  state: AutomationState;
  humanTakeover: boolean;
  aiMode: string;
  pendingDrafts: number;
  sendingDrafts: number;
  failedDrafts: number;
}

export function deriveAutomationState(input: Omit<AutomationSnapshot, 'state'>): AutomationState {
  if (input.humanTakeover) return 'human_takeover';
  if (input.failedDrafts > 0) return 'send_failed';
  if (input.sendingDrafts > 0) return 'approval_sending';
  if (input.pendingDrafts > 0) return 'approval_pending';
  if (input.aiMode === 'OFF') return 'ai_off';
  return 'ai_active';
}

export async function getAutomationSnapshot(
  db: D1Database,
  conversationId: string
): Promise<AutomationSnapshot | null> {
  const row = await db
    .prepare(
      `SELECT c.human_takeover, c.ai_mode,
        (SELECT COUNT(*) FROM message_drafts d WHERE d.conversation_id = c.id AND d.status = 'pending_review') AS pending,
        (SELECT COUNT(*) FROM message_drafts d WHERE d.conversation_id = c.id AND d.status = 'sending') AS sending,
        (SELECT COUNT(*) FROM message_drafts d WHERE d.conversation_id = c.id AND d.status = 'send_failed') AS failed
       FROM conversations c WHERE c.id = ?`
    )
    .bind(conversationId)
    .first<any>();
  if (!row) return null;
  const snapshot = {
    humanTakeover: Number(row.human_takeover) === 1,
    aiMode: String(row.ai_mode || 'INHERIT'),
    pendingDrafts: Number(row.pending || 0),
    sendingDrafts: Number(row.sending || 0),
    failedDrafts: Number(row.failed || 0),
  };
  return { ...snapshot, state: deriveAutomationState(snapshot) };
}

export async function countUnprocessedInbound(db: D1Database, conversationId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM messages
       WHERE conversation_id = ? AND direction = 'inbound' AND ai_processed_at IS NULL`
    )
    .bind(conversationId)
    .first<{ cnt: number }>();
  return Number(row?.cnt || 0);
}

export interface QueueEnv {
  DB: D1Database;
  MESSAGING_QUEUE: Queue;
}

/** Asks the queue consumer to handle any unprocessed inbound messages of this conversation once. */
export async function enqueueConversationProcessing(
  env: QueueEnv,
  tenantId: string,
  conversationId: string,
  reason: string
): Promise<boolean> {
  try {
    await env.MESSAGING_QUEUE.send({
      kind: 'process_conversation',
      schemaVersion: 2,
      tenantId,
      conversationId,
      reason,
      timestamp: Date.now(),
    });
    return true;
  } catch (err) {
    // The cron sweep re-enqueues conversations with unprocessed messages, so this is recoverable.
    logger.warn('Could not enqueue conversation processing', { conversationId, reason, err: String(err) });
    return false;
  }
}

/**
 * After a pause cause is removed: if nothing else still pauses the conversation and customer
 * messages are waiting, process them once. Does not generate a reply when nothing is waiting.
 */
export async function continueIfClear(
  env: QueueEnv,
  tenantId: string,
  conversationId: string,
  reason: string
): Promise<AutomationSnapshot | null> {
  const snapshot = await getAutomationSnapshot(env.DB, conversationId);
  if (snapshot?.state === 'ai_active' && (await countUnprocessedInbound(env.DB, conversationId)) > 0) {
    await enqueueConversationProcessing(env, tenantId, conversationId, reason);
  }
  return snapshot;
}

export type ResumeOutcome =
  | { kind: 'resumed'; snapshot: AutomationSnapshot | null }
  | { kind: 'conflict'; pendingDrafts: number; sendingDrafts: number };

/**
 * Explicit "Resume AI": clears human takeover and AI-off. Pending approvals conflict with resuming
 * and must be resolved first, or discarded explicitly (they are marked superseded, never sent).
 */
export async function resumeAI(
  env: QueueEnv,
  params: { tenantId: string; conversationId: string; discardPendingDrafts?: boolean; userId?: string }
): Promise<ResumeOutcome> {
  const { tenantId, conversationId } = params;
  const before = await getAutomationSnapshot(env.DB, conversationId);
  if (!before) return { kind: 'resumed', snapshot: null };

  const unresolved = before.pendingDrafts + before.failedDrafts;
  if (before.sendingDrafts > 0 || (unresolved > 0 && !params.discardPendingDrafts)) {
    return { kind: 'conflict', pendingDrafts: unresolved, sendingDrafts: before.sendingDrafts };
  }

  const now = Date.now();
  const statements = [
    env.DB
      .prepare(
        `UPDATE conversations
         SET human_takeover = 0, takeover_user_id = NULL, takeover_at = NULL,
             ai_mode = CASE WHEN ai_mode = 'OFF' THEN 'ON' ELSE ai_mode END,
             updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      )
      .bind(now, tenantId, conversationId),
  ];
  if (unresolved > 0) {
    statements.push(
      env.DB
        .prepare(
          `UPDATE message_drafts SET status = 'superseded', reviewed_by = ?, reviewed_at = ?, updated_at = ?
           WHERE tenant_id = ? AND conversation_id = ? AND status IN ('pending_review', 'send_failed')`
        )
        .bind(params.userId || null, now, now, tenantId, conversationId)
    );
  }
  await env.DB.batch(statements);

  const snapshot = await continueIfClear(env, tenantId, conversationId, 'resume_ai');
  return { kind: 'resumed', snapshot };
}

/**
 * Cron safety net: re-enqueues active conversations whose customer messages are still unprocessed
 * (e.g. a job hit its retry limit while another worker held the lease). Limited to the last day.
 */
export async function sweepUnprocessedConversations(env: QueueEnv, now = Date.now()): Promise<number> {
  const rows = await env.DB
    .prepare(
      `SELECT DISTINCT c.id, c.tenant_id
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.direction = 'inbound' AND m.ai_processed_at IS NULL
         AND m.created_at < ? AND m.created_at > ?
         AND c.human_takeover = 0 AND c.ai_mode != 'OFF'
         AND (c.lease_expires_at IS NULL OR c.lease_expires_at < ?)
         AND NOT EXISTS (
           SELECT 1 FROM message_drafts d
           WHERE d.conversation_id = c.id AND d.status IN ('pending_review', 'sending', 'send_failed')
         )
       LIMIT 20`
    )
    .bind(now - 2 * 60 * 1000, now - 24 * 60 * 60 * 1000, now)
    .all<{ id: string; tenant_id: string }>();

  let enqueued = 0;
  for (const row of rows.results || []) {
    if (await enqueueConversationProcessing(env, row.tenant_id, row.id, 'sweep_unprocessed')) enqueued++;
  }
  return enqueued;
}
