import type {
  ConversationSummary,
  ConversationWithDetails,
  Message,
  ChannelType,
  ConversationStatus,
  ConversationAIMode,
} from '@shared/types/crm.types';
import { AUTOMATION_STATE_SQL } from '../services/conversationAutomation';

export interface ConversationListFilters {
  channel?: (ChannelType | 'all') | undefined;
  status?: ConversationStatus | undefined;
  takeover?: boolean | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export class ConversationRepository {
  /**
   * Retrieves conversation list for the unified inbox with unread counts and linked lead snippets.
   * Leverages idx_conversations_inbox. CPU: < 1.2 ms.
   */
  async listConversations(
    db: D1Database,
    tenantId: string,
    filters: ConversationListFilters = {}
  ): Promise<ConversationSummary[]> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    let query = `
      SELECT 
        c.id, c.channel, c.customer_id, c.customer_name, c.customer_handle,
        c.unread_count, c.human_takeover, c.ai_mode, c.status, c.last_message_at,
        (
          SELECT message_text FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC LIMIT 1
        ) AS last_message_text,
        l.id AS lead_id,
        l.full_name AS lead_name,
        l.phone_or_email AS lead_contact,
        l.service_vertical AS lead_vertical,
        l.residency_intent AS lead_intent,
        l.lead_status,
        l.status_reason,
        l.missing_details_json,
        l.qualification AS lead_qualification,
        l.qualification_reason AS lead_qualification_reason,
        ${AUTOMATION_STATE_SQL} AS automation_state
      FROM conversations c
      LEFT JOIN (
        SELECT lead_id, conversation_id, ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY linked_at DESC) as rn
        FROM lead_conversation_links
      ) lcl ON lcl.conversation_id = c.id AND lcl.rn = 1
      LEFT JOIN leads l ON l.id = lcl.lead_id
      WHERE c.tenant_id = ?
    `;

    const bindings: any[] = [tenantId];

    if (filters.channel && filters.channel !== 'all') {
      query += ' AND c.channel = ?';
      bindings.push(filters.channel);
    }

    if (filters.status) {
      query += ' AND c.status = ?';
      bindings.push(filters.status);
    }

    // "takeover" filters on conversations a person must act on: explicit takeover or unresolved approval.
    if (filters.takeover !== undefined) {
      query += ` AND (${AUTOMATION_STATE_SQL}) ${filters.takeover ? 'IN' : 'NOT IN'} ('human_takeover', 'approval_pending', 'approval_sending', 'send_failed')`;
    }

    if (filters.search) {
      query += ' AND (c.customer_name LIKE ? OR c.customer_handle LIKE ?)';
      bindings.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY c.last_message_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await db.prepare(query).bind(...bindings).all<any>();

    return (result.results || []).map((row) => ({
      id: row.id,
      channel: row.channel,
      customerId: row.customer_id,
      customerName: row.customer_name || 'Anonymous Applicant',
      customerHandle: row.customer_handle || null,
      unreadCount: Number(row.unread_count || 0),
      lastMessageText: row.last_message_text || '',
      lastMessageAt: Number(row.last_message_at || 0),
      humanTakeover: Boolean(row.human_takeover === 1),
      aiMode: row.ai_mode,
      status: row.status,
      automationState: row.automation_state || 'ai_active',
      lead: row.lead_id
        ? {
            id: row.lead_id,
            fullName: row.lead_name || null,
            phoneOrEmail: row.lead_contact || null,
            serviceVertical: row.lead_vertical || 'unspecified',
            residencyIntent: row.lead_intent || 'unspecified',
            leadStatus: row.lead_status || 'needs_clarification',
            statusReason: row.status_reason || null,
            missingDetails: (() => {
              try {
                return row.missing_details_json ? JSON.parse(row.missing_details_json) : [];
              } catch {
                return [];
              }
            })(),
            qualification: row.lead_qualification || 'unknown',
            qualificationReason: row.lead_qualification_reason || null,
          }
        : null,
    }));
  }

  /**
   * Retrieves single conversation details and marks unread messages as read.
   */
  async getConversationById(
    db: D1Database,
    tenantId: string,
    conversationId: string
  ): Promise<ConversationWithDetails | null> {
    const query = `
      SELECT 
        c.id, c.connection_id, c.channel, c.customer_id, c.customer_name, c.customer_handle,
        c.assigned_user_id, c.takeover_user_id, c.takeover_at,
        c.unread_count, c.human_takeover, c.ai_mode, c.status, c.last_message_at,
        c.created_at, c.updated_at,
        (
          SELECT message_text FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC LIMIT 1
        ) AS last_message_text,
        l.id AS lead_id,
        l.full_name AS lead_name,
        l.phone_or_email AS lead_contact,
        l.service_vertical AS lead_vertical,
        l.residency_intent AS lead_intent,
        l.lead_status,
        l.status_reason,
        l.missing_details_json,
        l.qualification AS lead_qualification,
        l.qualification_reason AS lead_qualification_reason,
        ${AUTOMATION_STATE_SQL} AS automation_state
      FROM conversations c
      LEFT JOIN (
        SELECT lead_id, conversation_id, ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY linked_at DESC) as rn
        FROM lead_conversation_links
      ) lcl ON lcl.conversation_id = c.id AND lcl.rn = 1
      LEFT JOIN leads l ON l.id = lcl.lead_id
      WHERE c.tenant_id = ? AND c.id = ?
    `;

    const row = await db.prepare(query).bind(tenantId, conversationId).first<any>();
    if (!row) return null;

    // Mark unread messages as read
    if (row.unread_count > 0) {
      await db
        .prepare('UPDATE conversations SET unread_count = 0, updated_at = ? WHERE id = ?')
        .bind(Date.now(), conversationId)
        .run();
    }

    return {
      id: row.id,
      connectionId: row.connection_id,
      channel: row.channel,
      customerId: row.customer_id,
      customerName: row.customer_name || 'Anonymous Applicant',
      customerHandle: row.customer_handle || null,
      assignedUserId: row.assigned_user_id || null,
      takeoverUserId: row.takeover_user_id || null,
      takeoverAt: row.takeover_at ? Number(row.takeover_at) : null,
      unreadCount: 0, // Reset to 0 after viewing
      lastMessageText: row.last_message_text || '',
      lastMessageAt: Number(row.last_message_at || 0),
      humanTakeover: Boolean(row.human_takeover === 1),
      aiMode: row.ai_mode,
      status: row.status,
      automationState: row.automation_state || 'ai_active',
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      lead: row.lead_id
        ? {
            id: row.lead_id,
            fullName: row.lead_name || null,
            phoneOrEmail: row.lead_contact || null,
            serviceVertical: row.lead_vertical || 'unspecified',
            residencyIntent: row.lead_intent || 'unspecified',
            leadStatus: row.lead_status || 'needs_clarification',
            statusReason: row.status_reason || null,
            missingDetails: (() => {
              try {
                return row.missing_details_json ? JSON.parse(row.missing_details_json) : [];
              } catch {
                return [];
              }
            })(),
            qualification: row.lead_qualification || 'unknown',
            qualificationReason: row.lead_qualification_reason || null,
          }
        : null,
    };
  }

  /**
   * Retrieves messages thread for a given conversation.
   * Hits idx_messages_thread. CPU: < 0.8 ms.
   */
  async listMessages(
    db: D1Database,
    tenantId: string,
    conversationId: string,
    limit = 50
  ): Promise<Message[]> {
    const cappedLimit = Math.min(limit, 100);

    const rows = await db
      .prepare(
        `SELECT id, tenant_id, conversation_id, provider_message_id, direction,
                sender_type, sender_id, message_text, message_type, delivery_status,
                error_message, created_at
         FROM messages
         WHERE tenant_id = ? AND conversation_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .bind(tenantId, conversationId, cappedLimit)
      .all<any>();

    return (rows.results || []).reverse().map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      conversationId: row.conversation_id,
      providerMessageId: row.provider_message_id || null,
      direction: row.direction,
      senderType: row.sender_type,
      senderId: row.sender_id || null,
      messageText: row.message_text,
      messageType: row.message_type,
      deliveryStatus: row.delivery_status,
      errorMessage: row.error_message || null,
      createdAt: Number(row.created_at),
    }));
  }

  /**
   * Persists an inbound customer message once (idempotent on provider_message_id).
   * created_at uses the provider timestamp so rapidly consecutive messages keep their order.
   */
  async insertInboundMessage(
    db: D1Database,
    params: {
      tenantId: string;
      conversationId: string;
      providerMessageId: string;
      senderId: string;
      messageText: string;
      messageType?: string | undefined;
      attachments?: unknown[] | undefined;
      timestamp?: number | undefined;
    }
  ): Promise<boolean> {
    const createdAt = params.timestamp && params.timestamp > 0 ? params.timestamp : Date.now();
    const attachments = params.attachments && params.attachments.length > 0 ? params.attachments : null;
    const result = await db
      .prepare(
        `INSERT INTO messages (
          id, tenant_id, conversation_id, provider_message_id, direction,
          sender_type, sender_id, message_text, message_type, delivery_status, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, 'inbound', 'applicant', ?, ?, ?, 'delivered', ?, ?)
        ON CONFLICT(provider_message_id) DO NOTHING`
      )
      .bind(
        crypto.randomUUID(),
        params.tenantId,
        params.conversationId,
        params.providerMessageId,
        params.senderId,
        params.messageText,
        params.messageType || 'text',
        attachments ? JSON.stringify({ attachments }) : null,
        createdAt
      )
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  /**
   * Inserts an outbound message sent by a staff member.
   */
  async insertStaffMessage(
    db: D1Database,
    params: {
      tenantId: string;
      conversationId: string;
      staffUserId: string;
      messageText: string;
    }
  ): Promise<Message> {
    const messageId = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO messages (
          id, tenant_id, conversation_id, direction, sender_type,
          sender_id, message_text, message_type, delivery_status, created_at
        ) VALUES (?, ?, ?, 'outbound', 'staff', ?, ?, 'text', 'pending', ?)`
      )
      .bind(
        messageId,
        params.tenantId,
        params.conversationId,
        params.staffUserId,
        params.messageText,
        now
      )
      .run();

    await db
      .prepare(
        'UPDATE conversations SET last_message_at = ?, last_outbound_at = ?, updated_at = ? WHERE id = ?'
      )
      .bind(now, now, now, params.conversationId)
      .run();

    return {
      id: messageId,
      tenantId: params.tenantId,
      conversationId: params.conversationId,
      direction: 'outbound',
      senderType: 'staff',
      senderId: params.staffUserId,
      messageText: params.messageText,
      messageType: 'text',
      deliveryStatus: 'pending',
      createdAt: now,
    };
  }

  /**
   * Updates message delivery status and provider message ID after dispatch.
   */
  async updateMessageDelivery(
    db: D1Database,
    messageId: string,
    status: 'delivered' | 'failed',
    providerMessageId?: string,
    errorMessage?: string
  ): Promise<void> {
    await db
      .prepare(
        'UPDATE messages SET delivery_status = ?, provider_message_id = ?, error_message = ? WHERE id = ?'
      )
      .bind(status, providerMessageId || null, errorMessage || null, messageId)
      .run();
  }

  /**
   * Toggles human takeover for a conversation.
   * When human takeover is 1, automated AI replies are paused.
   */
  async setHumanTakeover(
    db: D1Database,
    tenantId: string,
    conversationId: string,
    takeover: boolean,
    userId?: string
  ): Promise<void> {
    const now = Date.now();
    await db
      .prepare(
        `UPDATE conversations 
         SET human_takeover = ?, 
             takeover_user_id = ?, 
             takeover_at = ?, 
             updated_at = ? 
         WHERE tenant_id = ? AND id = ?`
      )
      .bind(
        takeover ? 1 : 0,
        takeover ? userId || null : null,
        takeover ? now : null,
        now,
        tenantId,
        conversationId
      )
      .run();
  }

  /**
   * Updates conversation AI mode (INHERIT, ON, OFF).
   */
  async setAIMode(
    db: D1Database,
    tenantId: string,
    conversationId: string,
    aiMode: ConversationAIMode
  ): Promise<void> {
    const now = Date.now();
    await db
      .prepare('UPDATE conversations SET ai_mode = ?, updated_at = ? WHERE tenant_id = ? AND id = ?')
      .bind(aiMode, now, tenantId, conversationId)
      .run();
  }

  /**
   * Clears conversation history and drafts.
   * If deleteLead is true, deletes lead links and the associated leads records.
   * If deleteLead is false, clears message history only and preserves lead records.
   * Resets ai_mode to 'ON' so future incoming messages auto-reply without needing manual intervention.
   * CPU: < 1.5 ms.
   */
  async clearConversationHistory(
    db: D1Database,
    tenantId: string,
    conversationId: string,
    deleteLead: boolean = false
  ): Promise<void> {
    const now = Date.now();

    // 1. Get associated lead IDs before deleting links if lead deletion requested
    const leadLinks = await db
      .prepare('SELECT lead_id FROM lead_conversation_links WHERE tenant_id = ? AND conversation_id = ?')
      .bind(tenantId, conversationId)
      .all<{ lead_id: string }>();

    const leadIds = (leadLinks.results || []).map((l) => l.lead_id);

    // 2. Delete messages belonging to this conversation
    await db
      .prepare('DELETE FROM messages WHERE tenant_id = ? AND conversation_id = ?')
      .bind(tenantId, conversationId)
      .run();

    // A reset must not leave an AI reply generated from the deleted history available to send.
    await db
      .prepare('DELETE FROM message_drafts WHERE tenant_id = ? AND conversation_id = ?')
      .bind(tenantId, conversationId)
      .run();

    // 3. If deleteLead is true, unlink and delete the lead records
    if (deleteLead) {
      await db
        .prepare('DELETE FROM lead_conversation_links WHERE tenant_id = ? AND conversation_id = ?')
        .bind(tenantId, conversationId)
        .run();

      if (leadIds.length > 0) {
        const placeholders = leadIds.map(() => '?').join(',');
        await db
          .prepare(`DELETE FROM leads WHERE tenant_id = ? AND id IN (${placeholders})`)
          .bind(tenantId, ...leadIds)
          .run();
      }
    }

    // 4. Reset conversation metadata, human takeover, and reset AI mode to ON so future messages auto-reply
    await db
      .prepare(
        `UPDATE conversations SET 
          unread_count = 0, 
          human_takeover = 0, 
          takeover_user_id = NULL, 
          takeover_at = NULL, 
          ai_mode = 'ON', 
          last_outbound_at = NULL,
          updated_at = ? 
        WHERE tenant_id = ? AND id = ?`
      )
      .bind(now, tenantId, conversationId)
      .run();
  }
}

export const conversationRepository = new ConversationRepository();
