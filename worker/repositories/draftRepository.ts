import type {
  MessageDraft,
  CreateDraftInput,
  DraftStatus,
  DraftReviewKind,
  DraftContextMessage,
} from '@shared/types/draft.types';

const DRAFT_COLUMNS = `id, tenant_id, conversation_id, lead_id, suggested_text, rationale,
                status, modified_text, reviewed_by, reviewed_at, created_at,
                review_kind, review_reason, customer_question, based_on_message_at,
                sent_message_id, send_attempts, last_error, updated_at`;

export class DraftRepository {
  /**
   * Creates a new pending draft for human review.
   */
  async createDraft(
    db: D1Database,
    tenantId: string,
    input: CreateDraftInput
  ): Promise<MessageDraft> {
    const id = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO message_drafts (
          id, tenant_id, conversation_id, lead_id, suggested_text, rationale,
          status, created_at, review_kind, review_reason, customer_question,
          based_on_message_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        input.conversationId,
        input.leadId || null,
        input.suggestedText,
        input.rationale || null,
        now,
        input.reviewKind || null,
        input.reviewReason || null,
        input.customerQuestion || null,
        input.basedOnMessageAt ?? null,
        now
      )
      .run();

    const created = await this.getDraftById(db, tenantId, id);
    if (!created) throw new Error('Failed to retrieve created draft');
    return created;
  }

  /**
   * Retrieves single draft by ID.
   */
  async getDraftById(
    db: D1Database,
    tenantId: string,
    draftId: string
  ): Promise<MessageDraft | null> {
    const row = await db
      .prepare(
        `SELECT ${DRAFT_COLUMNS}
         FROM message_drafts
         WHERE tenant_id = ? AND id = ?`
      )
      .bind(tenantId, draftId)
      .first<any>();

    if (!row) return null;
    return this.mapRowToDraft(row);
  }

  /**
   * Retrieves the latest unresolved draft (awaiting review, sending, or failed to send) for a
   * conversation, with any customer messages that arrived after it was written.
   */
  async getPendingDraft(
    db: D1Database,
    tenantId: string,
    conversationId: string
  ): Promise<MessageDraft | null> {
    const row = await db
      .prepare(
        `SELECT ${DRAFT_COLUMNS}
         FROM message_drafts
         WHERE tenant_id = ? AND conversation_id = ? AND status IN ('pending_review', 'sending', 'send_failed')
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(tenantId, conversationId)
      .first<any>();

    if (!row) return null;
    const draft = this.mapRowToDraft(row);
    draft.newInboundMessages = await this.listInboundSince(db, conversationId, draft.basedOnMessageAt ?? null);
    return draft;
  }

  /** Inbound customer messages newer than `since` (none when the draft predates this tracking). */
  async listInboundSince(
    db: D1Database,
    conversationId: string,
    since: number | null
  ): Promise<DraftContextMessage[]> {
    if (since === null) return [];
    const rows = await db
      .prepare(
        `SELECT id, message_text, message_type, created_at FROM messages
         WHERE conversation_id = ? AND direction = 'inbound' AND created_at > ?
         ORDER BY created_at ASC, id ASC LIMIT 20`
      )
      .bind(conversationId, since)
      .all<any>();
    return (rows.results || []).map((r) => ({
      id: r.id,
      messageText: r.message_text,
      messageType: r.message_type,
      createdAt: Number(r.created_at),
    }));
  }

  /**
   * Lists all pending drafts awaiting staff approval across conversations.
   */
  async listPendingDrafts(
    db: D1Database,
    tenantId: string,
    limit = 20,
    offset = 0
  ): Promise<MessageDraft[]> {
    const rows = await db
      .prepare(
        `SELECT ${DRAFT_COLUMNS}
         FROM message_drafts
         WHERE tenant_id = ? AND status IN ('pending_review', 'sending', 'send_failed')
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(tenantId, limit, offset)
      .all<any>();

    return (rows.results || []).map((row) => this.mapRowToDraft(row));
  }

  /**
   * Resolves a draft: approved, modified, or rejected.
   */
  async resolveDraft(
    db: D1Database,
    tenantId: string,
    draftId: string,
    status: DraftStatus,
    modifiedText?: string | null,
    reviewedBy?: string | null
  ): Promise<MessageDraft | null> {
    const now = Date.now();

    await db
      .prepare(
        `UPDATE message_drafts SET
          status = ?,
          modified_text = COALESCE(?, modified_text),
          reviewed_by = ?,
          reviewed_at = ?
        WHERE tenant_id = ? AND id = ?`
      )
      .bind(status, modifiedText || null, reviewedBy || null, now, tenantId, draftId)
      .run();

    return this.getDraftById(db, tenantId, draftId);
  }

  private mapRowToDraft(row: any): MessageDraft {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      conversationId: row.conversation_id,
      leadId: row.lead_id || null,
      suggestedText: row.suggested_text,
      rationale: row.rationale || null,
      status: row.status as DraftStatus,
      modifiedText: row.modified_text || null,
      reviewedBy: row.reviewed_by || null,
      reviewedAt: row.reviewed_at ? Number(row.reviewed_at) : null,
      createdAt: Number(row.created_at),
      updatedAt: row.updated_at ? Number(row.updated_at) : null,
      reviewKind: (row.review_kind as DraftReviewKind) || null,
      reviewReason: row.review_reason || null,
      customerQuestion: row.customer_question || null,
      basedOnMessageAt: row.based_on_message_at != null ? Number(row.based_on_message_at) : null,
      sentMessageId: row.sent_message_id || null,
      sendAttempts: Number(row.send_attempts || 0),
      lastError: row.last_error || null,
    };
  }
}

export const draftRepository = new DraftRepository();
