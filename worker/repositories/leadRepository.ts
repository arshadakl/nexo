import type {
  Lead,
  LeadStatus,
  InternalNote,
} from '@shared/types/crm.types';
import type { UpdateLeadSchemaType, CreateLeadSchemaType } from '@shared/schemas/lead.schema';

export interface LeadListFilters {
  status?: LeadStatus | undefined;
  destinationCountry?: string | undefined;
  search?: string | undefined;
  minScore?: number | undefined;
  maxScore?: number | undefined;
  sortBy?: ('score' | 'recent') | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export class LeadRepository {
  /**
   * Retrieves paginated leads using idx_leads_pipeline. CPU: < 1.0 ms.
   */
  async listLeads(
    db: D1Database,
    tenantId: string,
    filters: LeadListFilters = {}
  ): Promise<Lead[]> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    let query = `
      SELECT 
        id, tenant_id, full_name, residence_country, destination_country,
        visa_category, education, work_experience, language_test, timeline,
        budget_range, phone_or_email, lead_score, score_breakdown_json,
        lead_status, human_review_reason, owner_id, last_qualified_at,
        created_at, updated_at
      FROM leads
      WHERE tenant_id = ?
    `;

    const bindings: any[] = [tenantId];

    if (filters.status) {
      query += ' AND lead_status = ?';
      bindings.push(filters.status);
    }

    if (filters.destinationCountry) {
      query += ' AND destination_country = ?';
      bindings.push(filters.destinationCountry);
    }

    if (filters.minScore !== undefined) {
      query += ' AND lead_score >= ?';
      bindings.push(filters.minScore);
    }

    if (filters.maxScore !== undefined) {
      query += ' AND lead_score <= ?';
      bindings.push(filters.maxScore);
    }

    if (filters.search) {
      query += ' AND (full_name LIKE ? OR phone_or_email LIKE ? OR visa_category LIKE ?)';
      bindings.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.sortBy === 'recent') {
      query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    } else {
      query += ' ORDER BY lead_score DESC, updated_at DESC LIMIT ? OFFSET ?';
    }

    bindings.push(limit, offset);

    const rows = await db.prepare(query).bind(...bindings).all<any>();

    return (rows.results || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      fullName: row.full_name || null,
      residenceCountry: row.residence_country || null,
      destinationCountry: row.destination_country || null,
      visaCategory: row.visa_category || null,
      education: row.education || null,
      workExperience: row.work_experience || null,
      languageTest: row.language_test || null,
      timeline: row.timeline || null,
      budgetRange: row.budget_range || null,
      phoneOrEmail: row.phone_or_email || null,
      leadScore: Number(row.lead_score || 0),
      scoreBreakdown: row.score_breakdown_json ? JSON.parse(row.score_breakdown_json) : null,
      leadStatus: row.lead_status,
      humanReviewReason: row.human_review_reason || null,
      ownerId: row.owner_id || null,
      lastQualifiedAt: row.last_qualified_at ? Number(row.last_qualified_at) : null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    }));
  }

  /**
   * Retrieves single lead profile with linked conversation IDs.
   */
  async getLeadById(
    db: D1Database,
    tenantId: string,
    leadId: string
  ): Promise<(Lead & { linkedConversationIds: string[] }) | null> {
    const row = await db
      .prepare(
        `SELECT 
          id, tenant_id, full_name, residence_country, destination_country,
          visa_category, education, work_experience, language_test, timeline,
          budget_range, phone_or_email, lead_score, score_breakdown_json,
          lead_status, human_review_reason, owner_id, last_qualified_at,
          created_at, updated_at
        FROM leads
        WHERE tenant_id = ? AND id = ?`
      )
      .bind(tenantId, leadId)
      .first<any>();

    if (!row) return null;

    // Get linked conversation IDs
    const links = await db
      .prepare('SELECT conversation_id FROM lead_conversation_links WHERE tenant_id = ? AND lead_id = ?')
      .bind(tenantId, leadId)
      .all<any>();

    const linkedConversationIds = (links.results || []).map((l) => l.conversation_id);

    return {
      id: row.id,
      tenantId: row.tenant_id,
      fullName: row.full_name || null,
      residenceCountry: row.residence_country || null,
      destinationCountry: row.destination_country || null,
      visaCategory: row.visa_category || null,
      education: row.education || null,
      workExperience: row.work_experience || null,
      languageTest: row.language_test || null,
      timeline: row.timeline || null,
      budgetRange: row.budget_range || null,
      phoneOrEmail: row.phone_or_email || null,
      leadScore: Number(row.lead_score || 0),
      scoreBreakdown: row.score_breakdown_json ? JSON.parse(row.score_breakdown_json) : null,
      leadStatus: row.lead_status,
      humanReviewReason: row.human_review_reason || null,
      ownerId: row.owner_id || null,
      lastQualifiedAt: row.last_qualified_at ? Number(row.last_qualified_at) : null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      linkedConversationIds,
    };
  }

  /**
   * Updates lead profile attributes.
   */
  async updateLead(
    db: D1Database,
    tenantId: string,
    leadId: string,
    updates: UpdateLeadSchemaType
  ): Promise<Lead | null> {
    const fields: string[] = [];
    const bindings: any[] = [];

    if (updates.fullName !== undefined) {
      fields.push('full_name = ?');
      bindings.push(updates.fullName);
    }
    if (updates.residenceCountry !== undefined) {
      fields.push('residence_country = ?');
      bindings.push(updates.residenceCountry);
    }
    if (updates.destinationCountry !== undefined) {
      fields.push('destination_country = ?');
      bindings.push(updates.destinationCountry);
    }
    if (updates.visaCategory !== undefined) {
      fields.push('visa_category = ?');
      bindings.push(updates.visaCategory);
    }
    if (updates.education !== undefined) {
      fields.push('education = ?');
      bindings.push(updates.education);
    }
    if (updates.workExperience !== undefined) {
      fields.push('work_experience = ?');
      bindings.push(updates.workExperience);
    }
    if (updates.languageTest !== undefined) {
      fields.push('language_test = ?');
      bindings.push(updates.languageTest);
    }
    if (updates.timeline !== undefined) {
      fields.push('timeline = ?');
      bindings.push(updates.timeline);
    }
    if (updates.budgetRange !== undefined) {
      fields.push('budget_range = ?');
      bindings.push(updates.budgetRange);
    }
    if (updates.phoneOrEmail !== undefined) {
      fields.push('phone_or_email = ?');
      bindings.push(updates.phoneOrEmail);
    }
    if (updates.leadScore !== undefined) {
      fields.push('lead_score = ?');
      bindings.push(updates.leadScore);
    }
    if (updates.leadStatus !== undefined) {
      fields.push('lead_status = ?');
      bindings.push(updates.leadStatus);
    }
    if (updates.ownerId !== undefined) {
      fields.push('owner_id = ?');
      bindings.push(updates.ownerId);
    }

    if (fields.length === 0) {
      return this.getLeadById(db, tenantId, leadId);
    }

    const now = Date.now();
    fields.push('updated_at = ?');
    bindings.push(now);

    bindings.push(tenantId, leadId);

    await db
      .prepare(`UPDATE leads SET ${fields.join(', ')} WHERE tenant_id = ? AND id = ?`)
      .bind(...bindings)
      .run();

    return this.getLeadById(db, tenantId, leadId);
  }

  /**
   * Creates a new lead manually.
   */
  async createLead(
    db: D1Database,
    tenantId: string,
    data: CreateLeadSchemaType
  ): Promise<Lead> {
    const id = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO leads (
          id, tenant_id, full_name, residence_country, destination_country,
          visa_category, education, work_experience, timeline, budget_range,
          phone_or_email, lead_score, lead_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        data.fullName,
        data.residenceCountry || null,
        data.destinationCountry || null,
        data.visaCategory || null,
        data.education || null,
        data.workExperience || null,
        data.timeline || null,
        data.budgetRange || null,
        data.phoneOrEmail || null,
        data.leadScore || 0,
        data.leadStatus || 'new',
        now,
        now
      )
      .run();

    const created = await this.getLeadById(db, tenantId, id);
    if (!created) throw new Error('Failed to retrieve newly created lead');
    return created;
  }

  /**
   * Internal notes for a lead.
   */
  async listNotes(
    db: D1Database,
    tenantId: string,
    leadId: string
  ): Promise<InternalNote[]> {
    const rows = await db
      .prepare(
        `SELECT id, tenant_id, conversation_id, lead_id, author_id, content, created_at
         FROM internal_notes
         WHERE tenant_id = ? AND lead_id = ?
         ORDER BY created_at DESC`
      )
      .bind(tenantId, leadId)
      .all<any>();

    return (rows.results || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      conversationId: row.conversation_id || null,
      leadId: row.lead_id || null,
      authorId: row.author_id,
      content: row.content,
      createdAt: Number(row.created_at),
    }));
  }

  /**
   * Adds an internal note to a lead or conversation.
   */
  async createNote(
    db: D1Database,
    params: {
      tenantId: string;
      leadId?: string;
      conversationId?: string;
      authorId: string;
      content: string;
    }
  ): Promise<InternalNote> {
    const id = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO internal_notes (
          id, tenant_id, lead_id, conversation_id, author_id, content, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        params.tenantId,
        params.leadId || null,
        params.conversationId || null,
        params.authorId,
        params.content,
        now
      )
      .run();

    return {
      id,
      tenantId: params.tenantId,
      leadId: params.leadId || null,
      conversationId: params.conversationId || null,
      authorId: params.authorId,
      content: params.content,
      createdAt: now,
    };
  }
}

export const leadRepository = new LeadRepository();
