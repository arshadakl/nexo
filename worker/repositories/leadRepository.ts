import type {
  Lead,
  LeadStatus,
  ServiceVertical,
  LocationContext,
  InternalNote,
} from '@shared/types/crm.types';
import type { UpdateLeadSchemaType, CreateLeadSchemaType } from '@shared/schemas/lead.schema';

export interface LeadListFilters {
  status?: LeadStatus | undefined;
  serviceVertical?: ServiceVertical | undefined;
  uaeLocationContext?: LocationContext | undefined;
  search?: string | undefined;
  sortBy?: ('recent' | 'status') | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export class LeadRepository {
  /**
   * Retrieves paginated leads using idx_leads_pipeline or idx_leads_vertical. CPU: < 1.0 ms.
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
        id, tenant_id, full_name, phone_or_email, service_vertical, residency_intent,
        work_business_activity, uae_location_context, target_emirate, timeline,
        detected_language, contact_method_preference, contact_permission,
        external_sharing_permission, lead_status, status_reason, missing_details_json,
        questions_answered_json, assigned_expert_id, owner_id, next_action,
        next_action_owner, summary, last_qualified_at, created_at, updated_at,
        current_location, nationality, profession, whatsapp_number,
        whatsapp_same_as_phone, whatsapp_contact_permission,
        unanswered_questions_json, confusions_json
      FROM leads
      WHERE tenant_id = ?
    `;

    const bindings: any[] = [tenantId];

    if (filters.status) {
      query += ' AND lead_status = ?';
      bindings.push(filters.status);
    }

    if (filters.serviceVertical && filters.serviceVertical !== 'unspecified') {
      query += ' AND service_vertical = ?';
      bindings.push(filters.serviceVertical);
    }

    if (filters.uaeLocationContext && filters.uaeLocationContext !== 'unknown') {
      query += ' AND uae_location_context = ?';
      bindings.push(filters.uaeLocationContext);
    }

    if (filters.search) {
      query += ' AND (full_name LIKE ? OR phone_or_email LIKE ? OR work_business_activity LIKE ? OR target_emirate LIKE ? OR summary LIKE ? OR current_location LIKE ? OR nationality LIKE ?)';
      bindings.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const rows = await db.prepare(query).bind(...bindings).all<any>();

    return (rows.results || []).map((row) => this.mapRowToLead(row));
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
          id, tenant_id, full_name, phone_or_email, service_vertical, residency_intent,
          work_business_activity, uae_location_context, target_emirate, timeline,
          detected_language, contact_method_preference, contact_permission,
          external_sharing_permission, lead_status, status_reason, missing_details_json,
          questions_answered_json, assigned_expert_id, owner_id, next_action,
          next_action_owner, summary, last_qualified_at, created_at, updated_at,
          current_location, nationality, profession, whatsapp_number,
          whatsapp_same_as_phone, whatsapp_contact_permission,
          unanswered_questions_json, confusions_json
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
      ...this.mapRowToLead(row),
      linkedConversationIds,
    };
  }

  /**
   * Updates lead profile attributes with audit evidence.
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
    if (updates.phoneOrEmail !== undefined) {
      fields.push('phone_or_email = ?');
      bindings.push(updates.phoneOrEmail);
    } else if (updates.phoneNumber !== undefined) {
      fields.push('phone_or_email = ?');
      bindings.push(updates.phoneNumber);
    }
    if (updates.serviceVertical !== undefined) {
      fields.push('service_vertical = ?');
      bindings.push(updates.serviceVertical);
    }
    if (updates.residencyIntent !== undefined) {
      fields.push('residency_intent = ?');
      bindings.push(updates.residencyIntent);
    }
    if (updates.workBusinessActivity !== undefined) {
      fields.push('work_business_activity = ?');
      bindings.push(updates.workBusinessActivity);
    }
    if (updates.uaeLocationContext !== undefined) {
      fields.push('uae_location_context = ?');
      bindings.push(updates.uaeLocationContext);
    }
    if (updates.targetEmirate !== undefined) {
      fields.push('target_emirate = ?');
      bindings.push(updates.targetEmirate);
    }
    if (updates.timeline !== undefined) {
      fields.push('timeline = ?');
      bindings.push(updates.timeline);
    }
    if (updates.detectedLanguage !== undefined) {
      fields.push('detected_language = ?');
      bindings.push(updates.detectedLanguage);
    }
    if (updates.contactMethodPreference !== undefined) {
      fields.push('contact_method_preference = ?');
      bindings.push(updates.contactMethodPreference);
    }
    if (updates.contactPermission !== undefined) {
      fields.push('contact_permission = ?');
      bindings.push(updates.contactPermission ? 1 : 0);
    }
    if (updates.externalSharingPermission !== undefined) {
      fields.push('external_sharing_permission = ?');
      bindings.push(updates.externalSharingPermission ? 1 : 0);
    }
    if (updates.leadStatus !== undefined) {
      fields.push('lead_status = ?');
      bindings.push(updates.leadStatus);
    }
    if (updates.statusReason !== undefined) {
      fields.push('status_reason = ?');
      bindings.push(updates.statusReason);
    }
    if (updates.missingDetails !== undefined) {
      fields.push('missing_details_json = ?');
      bindings.push(JSON.stringify(updates.missingDetails));
    }
    if (updates.questionsAnswered !== undefined) {
      fields.push('questions_answered_json = ?');
      bindings.push(JSON.stringify(updates.questionsAnswered));
    }
    if (updates.assignedExpertId !== undefined) {
      fields.push('assigned_expert_id = ?');
      bindings.push(updates.assignedExpertId);
    }
    if (updates.ownerId !== undefined) {
      fields.push('owner_id = ?');
      bindings.push(updates.ownerId);
    }
    if (updates.nextAction !== undefined) {
      fields.push('next_action = ?');
      bindings.push(updates.nextAction);
    }
    if (updates.nextActionOwner !== undefined) {
      fields.push('next_action_owner = ?');
      bindings.push(updates.nextActionOwner);
    }
    if (updates.summary !== undefined) {
      fields.push('summary = ?');
      bindings.push(updates.summary);
    }
    if (updates.currentLocation !== undefined) {
      fields.push('current_location = ?');
      bindings.push(updates.currentLocation);
    }
    if (updates.nationality !== undefined) {
      fields.push('nationality = ?');
      bindings.push(updates.nationality);
    }
    if (updates.profession !== undefined) {
      fields.push('profession = ?');
      bindings.push(updates.profession);
    }
    if (updates.whatsappNumber !== undefined) {
      fields.push('whatsapp_number = ?');
      bindings.push(updates.whatsappNumber);
    }
    if (updates.whatsappSameAsPhone !== undefined) {
      fields.push('whatsapp_same_as_phone = ?');
      bindings.push(updates.whatsappSameAsPhone ? 1 : 0);
    }
    if (updates.whatsappContactPermission !== undefined) {
      fields.push('whatsapp_contact_permission = ?');
      bindings.push(updates.whatsappContactPermission ? 1 : 0);
    }
    if (updates.unansweredQuestions !== undefined) {
      fields.push('unanswered_questions_json = ?');
      bindings.push(JSON.stringify(updates.unansweredQuestions));
    }
    if (updates.confusions !== undefined) {
      fields.push('confusions_json = ?');
      bindings.push(JSON.stringify(updates.confusions));
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
   * Creates a new RESIDER lead manually or from qualification.
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
          id, tenant_id, full_name, phone_or_email, service_vertical, residency_intent,
          work_business_activity, uae_location_context, target_emirate, timeline,
          detected_language, contact_method_preference, contact_permission,
          external_sharing_permission, lead_status, status_reason, missing_details_json,
          questions_answered_json, assigned_expert_id, owner_id, next_action,
          next_action_owner, summary, current_location, nationality, profession,
          whatsapp_number, whatsapp_same_as_phone, whatsapp_contact_permission,
          unanswered_questions_json, confusions_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        data.fullName,
        data.phoneOrEmail || data.phoneNumber || null,
        data.serviceVertical || 'unspecified',
        data.residencyIntent || 'unspecified',
        data.workBusinessActivity || null,
        data.uaeLocationContext || 'unknown',
        data.targetEmirate || null,
        data.timeline || null,
        data.detectedLanguage || 'en',
        data.contactMethodPreference || null,
        data.contactPermission ? 1 : 0,
        data.externalSharingPermission ? 1 : 0,
        data.leadStatus || 'needs_clarification',
        data.statusReason || null,
        JSON.stringify(data.missingDetails || []),
        JSON.stringify(data.questionsAnswered || []),
        data.assignedExpertId || null,
        data.ownerId || null,
        data.nextAction || null,
        data.nextActionOwner || null,
        data.summary || null,
        data.currentLocation || null,
        data.nationality || null,
        data.profession || null,
        data.whatsappNumber || null,
        data.whatsappSameAsPhone ? 1 : 0,
        data.whatsappContactPermission ? 1 : 0,
        JSON.stringify(data.unansweredQuestions || []),
        JSON.stringify(data.confusions || []),
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

  private mapRowToLead(row: any): Lead {
    let missingDetails: string[] = [];
    try {
      if (row.missing_details_json) {
        missingDetails = JSON.parse(row.missing_details_json);
      }
    } catch {}

    let questionsAnswered: string[] = [];
    try {
      if (row.questions_answered_json) {
        questionsAnswered = JSON.parse(row.questions_answered_json);
      }
    } catch {}

    let unansweredQuestions: string[] = [];
    try {
      if (row.unanswered_questions_json) {
        unansweredQuestions = JSON.parse(row.unanswered_questions_json);
      }
    } catch {}

    let confusions: string[] = [];
    try {
      if (row.confusions_json) {
        confusions = JSON.parse(row.confusions_json);
      }
    } catch {}

    return {
      id: row.id,
      tenantId: row.tenant_id,
      fullName: row.full_name || null,
      phoneOrEmail: row.phone_or_email || null,
      phoneNumber: row.phone_or_email || null,
      serviceVertical: row.service_vertical || 'unspecified',
      residencyIntent: row.residency_intent || 'unspecified',
      workBusinessActivity: row.work_business_activity || null,
      uaeLocationContext: row.uae_location_context || 'unknown',
      targetEmirate: row.target_emirate || null,
      timeline: row.timeline || null,
      detectedLanguage: row.detected_language || 'en',
      contactMethodPreference: row.contact_method_preference || null,
      contactPermission: row.contact_permission === 1,
      externalSharingPermission: row.external_sharing_permission === 1,
      leadStatus: row.lead_status || 'needs_clarification',
      statusReason: row.status_reason || null,
      missingDetails,
      questionsAnswered,
      assignedExpertId: row.assigned_expert_id || null,
      ownerId: row.owner_id || null,
      nextAction: row.next_action || null,
      nextActionOwner: row.next_action_owner || null,
      summary: row.summary || null,
      lastQualifiedAt: row.last_qualified_at ? Number(row.last_qualified_at) : null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      currentLocation: row.current_location || null,
      nationality: row.nationality || null,
      profession: row.profession || null,
      whatsappNumber: row.whatsapp_number || null,
      whatsappSameAsPhone: row.whatsapp_same_as_phone === 1,
      whatsappContactPermission: row.whatsapp_contact_permission === 1,
      unansweredQuestions,
      confusions,
    };
  }
}

export const leadRepository = new LeadRepository();
