import type {
  BusinessKnowledgeItem,
  CreateKnowledgeItemInput,
  UpdateKnowledgeItemInput,
  KnowledgeCategory,
} from '@shared/types/knowledge.types';

export class KnowledgeRepository {
  /**
   * Lists approved knowledge items only (strictly where is_approved_by_client = 1).
   * This is what feeds into the AI Prompt context to guarantee zero hallucinated prices.
   */
  async listApprovedKnowledge(
    db: D1Database,
    tenantId: string,
    category?: KnowledgeCategory
  ): Promise<BusinessKnowledgeItem[]> {
    let query = `
      SELECT id, tenant_id, category, title, content, price_aed,
             is_approved_by_client, approval_notes, created_at, updated_at
      FROM business_knowledge_items
      WHERE tenant_id = ? AND is_approved_by_client = 1
    `;
    const bindings: any[] = [tenantId];

    if (category) {
      query += ' AND category = ?';
      bindings.push(category);
    }

    query += ' ORDER BY category ASC, title ASC';
    const rows = await db.prepare(query).bind(...bindings).all<any>();
    return (rows.results || []).map((row) => this.mapRowToKnowledge(row));
  }

  /**
   * Lists all knowledge items (for the dashboard settings / review screen).
   */
  async listAllKnowledge(
    db: D1Database,
    tenantId: string
  ): Promise<BusinessKnowledgeItem[]> {
    const rows = await db
      .prepare(
        `SELECT id, tenant_id, category, title, content, price_aed,
                is_approved_by_client, approval_notes, created_at, updated_at
         FROM business_knowledge_items
         WHERE tenant_id = ?
         ORDER BY is_approved_by_client ASC, category ASC, title ASC`
      )
      .bind(tenantId)
      .all<any>();

    return (rows.results || []).map((row) => this.mapRowToKnowledge(row));
  }

  /**
   * Retrieves single knowledge item by ID.
   */
  async getKnowledgeItemById(
    db: D1Database,
    tenantId: string,
    id: string
  ): Promise<BusinessKnowledgeItem | null> {
    const row = await db
      .prepare(
        `SELECT id, tenant_id, category, title, content, price_aed,
                is_approved_by_client, approval_notes, created_at, updated_at
         FROM business_knowledge_items
         WHERE tenant_id = ? AND id = ?`
      )
      .bind(tenantId, id)
      .first<any>();

    if (!row) return null;
    return this.mapRowToKnowledge(row);
  }

  /**
   * Creates a new knowledge item.
   */
  async createKnowledgeItem(
    db: D1Database,
    tenantId: string,
    input: CreateKnowledgeItemInput
  ): Promise<BusinessKnowledgeItem> {
    const id = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO business_knowledge_items (
          id, tenant_id, category, title, content, price_aed,
          is_approved_by_client, approval_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        input.category,
        input.title,
        input.content,
        input.priceAed || null,
        input.isApprovedByClient ? 1 : 0,
        input.approvalNotes || null,
        now,
        now
      )
      .run();

    const created = await this.getKnowledgeItemById(db, tenantId, id);
    if (!created) throw new Error('Failed to retrieve created knowledge item');
    return created;
  }

  /**
   * Updates an existing knowledge item.
   */
  async updateKnowledgeItem(
    db: D1Database,
    tenantId: string,
    id: string,
    updates: UpdateKnowledgeItemInput
  ): Promise<BusinessKnowledgeItem | null> {
    const fields: string[] = [];
    const bindings: any[] = [];

    if (updates.category !== undefined) {
      fields.push('category = ?');
      bindings.push(updates.category);
    }
    if (updates.title !== undefined) {
      fields.push('title = ?');
      bindings.push(updates.title);
    }
    if (updates.content !== undefined) {
      fields.push('content = ?');
      bindings.push(updates.content);
    }
    if (updates.priceAed !== undefined) {
      fields.push('price_aed = ?');
      bindings.push(updates.priceAed);
    }
    if (updates.isApprovedByClient !== undefined) {
      fields.push('is_approved_by_client = ?');
      bindings.push(updates.isApprovedByClient ? 1 : 0);
    }
    if (updates.approvalNotes !== undefined) {
      fields.push('approval_notes = ?');
      bindings.push(updates.approvalNotes);
    }

    if (fields.length === 0) {
      return this.getKnowledgeItemById(db, tenantId, id);
    }

    const now = Date.now();
    fields.push('updated_at = ?');
    bindings.push(now);

    bindings.push(tenantId, id);

    await db
      .prepare(`UPDATE business_knowledge_items SET ${fields.join(', ')} WHERE tenant_id = ? AND id = ?`)
      .bind(...bindings)
      .run();

    return this.getKnowledgeItemById(db, tenantId, id);
  }

  /**
   * Sets client approval status with audit note.
   */
  async setApprovalStatus(
    db: D1Database,
    tenantId: string,
    id: string,
    isApproved: boolean,
    notes?: string
  ): Promise<BusinessKnowledgeItem | null> {
    const now = Date.now();
    await db
      .prepare(
        `UPDATE business_knowledge_items SET
          is_approved_by_client = ?,
          approval_notes = COALESCE(?, approval_notes),
          updated_at = ?
        WHERE tenant_id = ? AND id = ?`
      )
      .bind(isApproved ? 1 : 0, notes || null, now, tenantId, id)
      .run();

    return this.getKnowledgeItemById(db, tenantId, id);
  }

  /**
   * Deletes a knowledge item.
   */
  async deleteKnowledgeItem(db: D1Database, tenantId: string, id: string): Promise<boolean> {
    const result = await db
      .prepare('DELETE FROM business_knowledge_items WHERE tenant_id = ? AND id = ?')
      .bind(tenantId, id)
      .run();
    return result.meta.changes > 0;
  }

  private mapRowToKnowledge(row: any): BusinessKnowledgeItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      category: row.category,
      title: row.title,
      content: row.content,
      priceAed: row.price_aed ? Number(row.price_aed) : null,
      isApprovedByClient: row.is_approved_by_client === 1,
      approvalNotes: row.approval_notes || null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }
}

export const knowledgeRepository = new KnowledgeRepository();
