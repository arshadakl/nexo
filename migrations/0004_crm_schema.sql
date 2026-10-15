-- Migration 0004: CRM Schema (Conversations, Messages, Leads, Links, Notes)

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    connection_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('instagram', 'whatsapp')),
    provider_convo_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    customer_handle TEXT,
    assigned_user_id TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
    ai_mode TEXT NOT NULL DEFAULT 'INHERIT' CHECK (ai_mode IN ('INHERIT', 'ON', 'OFF')),
    human_takeover INTEGER NOT NULL DEFAULT 0, -- 1 = staff took over, AI paused
    takeover_user_id TEXT,
    takeover_at INTEGER,
    unread_count INTEGER NOT NULL DEFAULT 0,
    last_message_at INTEGER NOT NULL,
    last_inbound_at INTEGER,
    last_outbound_at INTEGER,
    lease_owner TEXT,
    lease_expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (takeover_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (connection_id, provider_convo_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_inbox ON conversations(tenant_id, channel, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(tenant_id, assigned_user_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(connection_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lease ON conversations(lease_expires_at);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    provider_message_id TEXT UNIQUE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('applicant', 'ai', 'staff', 'system')),
    sender_id TEXT,
    message_text TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'document', 'template', 'unsupported')),
    delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'unknown')),
    metadata_json TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_provider_id ON messages(provider_message_id);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    full_name TEXT,
    residence_country TEXT,
    destination_country TEXT,
    visa_category TEXT,
    education TEXT,
    work_experience TEXT,
    language_test TEXT,
    timeline TEXT,
    budget_range TEXT,
    phone_or_email TEXT,
    lead_score INTEGER NOT NULL DEFAULT 0,
    score_breakdown_json TEXT,
    lead_status TEXT NOT NULL DEFAULT 'collecting_information' CHECK (
        lead_status IN ('new', 'collecting_information', 'qualified', 'consultation_booked', 'converted', 'unqualified', 'spam_irrelevant', 'needs_human_review', 'closed_lost')
    ),
    human_review_reason TEXT,
    owner_id TEXT,
    last_qualified_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline ON leads(tenant_id, lead_status, lead_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(tenant_id, owner_id, lead_status);

-- Lead-to-Conversation links (allows multiple channel DMs linked to one applicant)
CREATE TABLE IF NOT EXISTS lead_conversation_links (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    link_method TEXT NOT NULL CHECK (link_method IN ('auto_customer_id', 'auto_contact_match', 'manual_staff')),
    confidence REAL NOT NULL DEFAULT 1.0,
    linked_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    UNIQUE (lead_id, conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_links_lead ON lead_conversation_links(lead_id);
CREATE INDEX IF NOT EXISTS idx_links_conversation ON lead_conversation_links(conversation_id);

-- Internal notes
CREATE TABLE IF NOT EXISTS internal_notes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    conversation_id TEXT,
    lead_id TEXT,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notes_conversation ON internal_notes(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_lead ON internal_notes(lead_id, created_at DESC);
