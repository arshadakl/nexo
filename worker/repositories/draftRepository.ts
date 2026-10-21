import type {
  MessageDraft,
  CreateDraftInput,
  DraftStatus,
} from '@shared/types/draft.types';

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
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?)`
      )
      .bind(
        id,
        tenantId,
        input.conversationId,
        input.leadId || null,
        input.suggestedText,
        input.rationale || null,
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
        `SELECT id, tenant_id, conversation_id, lead_id, suggested_text, rationale,
                status, modified_text, reviewed_by, reviewed_at, created_at
         FROM message_drafts
         WHERE tenant_id = ? AND id = ?`
      )
      .bind(tenantId, draftId)
      .first<any>();

    if (!row) return null;
    return this.mapRowToDraft(row);
  }

  /**
   * Retrieves the latest active pending draft for a specific conversation.
   */
  async getPendingDraft(
    db: D1Database,
    tenantId: string,
    conversationId: string
  ): Promise<MessageDraft | null> {
    const row = await db
      .prepare(
        `SELECT id, tenant_id, conversation_id, lead_id, suggested_text, rationale,
                status, modified_text, reviewed_by, reviewed_at, created_at
         FROM message_drafts
         WHERE tenant_id = ? AND conversation_id = ? AND status = 'pending_review'
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(tenantId, conversationId)
      .first<any>();

    if (!row) return null;
    return this.mapRowToDraft(row);
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
        `SELECT id, tenant_id, conversation_id, lead_id, suggested_text, rationale,
                status, modified_text, reviewed_by, reviewed_at, created_at
         FROM message_drafts
         WHERE tenant_id = ? AND status = 'pending_review'
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
    };
  }
}

export const draftRepository = new DraftRepository();
