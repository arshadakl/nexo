import type {
  VerifiedExpert,
  CreateExpertInput,
  UpdateExpertInput,
  ExpertMatchCriteria,
} from '@shared/types/expert.types';

export interface ExpertListFilters {
  sector?: string | undefined;
  language?: string | undefined;
  emirate?: string | undefined;
  isVerified?: boolean | undefined;
  isAvailable?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export class ExpertRepository {
  /**
   * Lists verified experts with optional sector, language, and availability filtering.
   */
  async listExperts(
    db: D1Database,
    tenantId: string,
    filters: ExpertListFilters = {}
  ): Promise<VerifiedExpert[]> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    let query = `
      SELECT id, tenant_id, full_name, organization_name, sectors_json, languages_json,
             emirates_json, services_offered_json, is_verified, is_available,
             contact_phone, contact_email, created_at, updated_at
      FROM verified_experts
      WHERE tenant_id = ?
    `;

    const bindings: any[] = [tenantId];

    if (filters.isVerified !== undefined) {
      query += ' AND is_verified = ?';
      bindings.push(filters.isVerified ? 1 : 0);
    }

    if (filters.isAvailable !== undefined) {
      query += ' AND is_available = ?';
      bindings.push(filters.isAvailable ? 1 : 0);
    }

    if (filters.sector) {
      query += ' AND sectors_json LIKE ?';
      bindings.push(`%"${filters.sector}"%`);
    }

    if (filters.language) {
      query += ' AND languages_json LIKE ?';
      bindings.push(`%"${filters.language}"%`);
    }

    if (filters.emirate) {
      query += ' AND (emirates_json LIKE ? OR emirates_json LIKE \'%"all"%\')';
      bindings.push(`%"${filters.emirate}"%`);
    }

    query += ' ORDER BY is_available DESC, is_verified DESC, full_name ASC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const rows = await db.prepare(query).bind(...bindings).all<any>();
    return (rows.results || []).map((row) => this.mapRowToExpert(row));
  }

  /**
   * Retrieves single expert by ID.
   */
  async getExpertById(
    db: D1Database,
    tenantId: string,
    expertId: string
  ): Promise<VerifiedExpert | null> {
    const row = await db
      .prepare(
        `SELECT id, tenant_id, full_name, organization_name, sectors_json, languages_json,
                emirates_json, services_offered_json, is_verified, is_available,
                contact_phone, contact_email, created_at, updated_at
         FROM verified_experts
         WHERE tenant_id = ? AND id = ?`
      )
      .bind(tenantId, expertId)
      .first<any>();

    if (!row) return null;
    return this.mapRowToExpert(row);
  }

  /**
   * Matches top verified experts based on sector, language, and emirate criteria (Section 4D).
   */
  async matchExperts(
    db: D1Database,
    tenantId: string,
    criteria: ExpertMatchCriteria
  ): Promise<VerifiedExpert[]> {
    const experts = await this.listExperts(db, tenantId, {
      isVerified: true,
      isAvailable: true,
      sector: criteria.sector || undefined,
      language: criteria.language || undefined,
      emirate: criteria.emirate || undefined,
      limit: 5,
    });

    // If exact filter yielded results, return them
    if (experts.length > 0) return experts;

    // Fallback: match by language alone among available verified partners
    return this.listExperts(db, tenantId, {
      isVerified: true,
      isAvailable: true,
      language: criteria.language || undefined,
      limit: 3,
    });
  }

  /**
   * Creates a new verified expert in the directory.
   */
  async createExpert(
    db: D1Database,
    tenantId: string,
    input: CreateExpertInput
  ): Promise<VerifiedExpert> {
    const id = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO verified_experts (
          id, tenant_id, full_name, organization_name, sectors_json, languages_json,
          emirates_json, services_offered_json, is_verified, is_available,
          contact_phone, contact_email, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        input.fullName,
        input.organizationName,
        JSON.stringify(input.sectors || []),
        JSON.stringify(input.languages || ['en']),
        JSON.stringify(input.emirates || ['all']),
        JSON.stringify(input.servicesOffered || []),
        input.isVerified ?? true ? 1 : 0,
        input.isAvailable ?? true ? 1 : 0,
        input.contactPhone || null,
        input.contactEmail || null,
        now,
        now
      )
      .run();

    const created = await this.getExpertById(db, tenantId, id);
    if (!created) throw new Error('Failed to retrieve created expert');
    return created;
  }

  /**
   * Updates expert record.
   */
  async updateExpert(
    db: D1Database,
    tenantId: string,
    expertId: string,
    updates: UpdateExpertInput
  ): Promise<VerifiedExpert | null> {
    const fields: string[] = [];
    const bindings: any[] = [];

    if (updates.fullName !== undefined) {
      fields.push('full_name = ?');
      bindings.push(updates.fullName);
    }
    if (updates.organizationName !== undefined) {
      fields.push('organization_name = ?');
      bindings.push(updates.organizationName);
    }
    if (updates.sectors !== undefined) {
      fields.push('sectors_json = ?');
      bindings.push(JSON.stringify(updates.sectors));
    }
    if (updates.languages !== undefined) {
      fields.push('languages_json = ?');
      bindings.push(JSON.stringify(updates.languages));
    }
    if (updates.emirates !== undefined) {
      fields.push('emirates_json = ?');
      bindings.push(JSON.stringify(updates.emirates));
    }
    if (updates.servicesOffered !== undefined) {
      fields.push('services_offered_json = ?');
      bindings.push(JSON.stringify(updates.servicesOffered));
    }
    if (updates.isVerified !== undefined) {
      fields.push('is_verified = ?');
      bindings.push(updates.isVerified ? 1 : 0);
    }
    if (updates.isAvailable !== undefined) {
      fields.push('is_available = ?');
      bindings.push(updates.isAvailable ? 1 : 0);
    }
    if (updates.contactPhone !== undefined) {
      fields.push('contact_phone = ?');
      bindings.push(updates.contactPhone);
    }
    if (updates.contactEmail !== undefined) {
      fields.push('contact_email = ?');
      bindings.push(updates.contactEmail);
    }

    if (fields.length === 0) {
      return this.getExpertById(db, tenantId, expertId);
    }

    const now = Date.now();
    fields.push('updated_at = ?');
    bindings.push(now);

    bindings.push(tenantId, expertId);

    await db
      .prepare(`UPDATE verified_experts SET ${fields.join(', ')} WHERE tenant_id = ? AND id = ?`)
      .bind(...bindings)
      .run();

    return this.getExpertById(db, tenantId, expertId);
  }

  /**
   * Deletes an expert.
   */
  async deleteExpert(db: D1Database, tenantId: string, expertId: string): Promise<boolean> {
    const result = await db
      .prepare('DELETE FROM verified_experts WHERE tenant_id = ? AND id = ?')
      .bind(tenantId, expertId)
      .run();
    return result.meta.changes > 0;
  }

  private mapRowToExpert(row: any): VerifiedExpert {
    let sectors: string[] = [];
    try {
      if (row.sectors_json) sectors = JSON.parse(row.sectors_json);
    } catch {}

    let languages: string[] = ['en'];
    try {
      if (row.languages_json) languages = JSON.parse(row.languages_json);
    } catch {}

    let emirates: string[] = ['all'];
    try {
      if (row.emirates_json) emirates = JSON.parse(row.emirates_json);
    } catch {}

    let servicesOffered: string[] = [];
    try {
      if (row.services_offered_json) servicesOffered = JSON.parse(row.services_offered_json);
    } catch {}

    return {
      id: row.id,
      tenantId: row.tenant_id,
      fullName: row.full_name,
      organizationName: row.organization_name,
      sectors,
      languages,
      emirates,
      servicesOffered,
      isVerified: row.is_verified === 1,
      isAvailable: row.is_available === 1,
      contactPhone: row.contact_phone || null,
      contactEmail: row.contact_email || null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }
}

export const expertRepository = new ExpertRepository();
