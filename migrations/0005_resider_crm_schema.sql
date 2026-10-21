-- Migration 0005: RESIDER Canonical CRM Schema
-- Replaces study-abroad/fitness schema with official Resider UAE Residency & Business Setup data model

-- 1. Recreate `leads` table with canonical RESIDER columns & 7 official statuses
CREATE TABLE IF NOT EXISTS leads_new (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    full_name TEXT,
    phone_or_email TEXT,
    service_vertical TEXT NOT NULL DEFAULT 'unspecified' CHECK (service_vertical IN ('residency', 'business_setup', 'both', 'unspecified')),
    residency_intent TEXT NOT NULL DEFAULT 'unspecified' CHECK (residency_intent IN ('permit_with_residency', 'residency_only', 'understanding_options', 'unspecified')),
    work_business_activity TEXT,
    uae_location_context TEXT NOT NULL DEFAULT 'unknown' CHECK (uae_location_context IN ('inside_uae', 'outside_uae', 'undecided', 'unknown')),
    target_emirate TEXT,
    timeline TEXT,
    detected_language TEXT NOT NULL DEFAULT 'en',
    contact_method_preference TEXT,
    contact_permission INTEGER NOT NULL DEFAULT 0,
    external_sharing_permission INTEGER NOT NULL DEFAULT 0,
    lead_status TEXT NOT NULL DEFAULT 'needs_clarification' CHECK (
        lead_status IN ('needs_clarification', 'exploring', 'ready_for_team', 'handover_requested', 'handed_over', 'support_enquiry', 'outside_scope_spam')
    ),
    status_reason TEXT,
    missing_details_json TEXT,
    questions_answered_json TEXT,
    assigned_expert_id TEXT,
    owner_id TEXT,
    next_action TEXT,
    next_action_owner TEXT,
    summary TEXT,
    last_qualified_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Safely migrate any existing leads with mapped statuses
INSERT OR IGNORE INTO leads_new (
    id, tenant_id, full_name, phone_or_email,
    timeline, lead_status, status_reason,
    owner_id, last_qualified_at, created_at, updated_at
)
SELECT 
    id, tenant_id, full_name, phone_or_email,
    timeline,
    CASE 
        WHEN lead_status = 'qualified' THEN 'ready_for_team'
        WHEN lead_status = 'consultation_booked' THEN 'handed_over'
        WHEN lead_status = 'spam_irrelevant' THEN 'outside_scope_spam'
        WHEN lead_status = 'needs_human_review' THEN 'handover_requested'
        WHEN lead_status = 'collecting_information' THEN 'exploring'
        ELSE 'needs_clarification'
    END,
    human_review_reason,
    owner_id, last_qualified_at, created_at, updated_at
FROM leads;

DROP TABLE IF EXISTS leads;
ALTER TABLE leads_new RENAME TO leads;

CREATE INDEX IF NOT EXISTS idx_leads_pipeline ON leads(tenant_id, lead_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(tenant_id, owner_id, lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_vertical ON leads(tenant_id, service_vertical, lead_status);

-- 2. Verified Business-Setup Experts Directory (Section 4)
CREATE TABLE IF NOT EXISTS verified_experts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    organization_name TEXT NOT NULL,
    sectors_json TEXT NOT NULL DEFAULT '[]',
    languages_json TEXT NOT NULL DEFAULT '["en"]',
    emirates_json TEXT NOT NULL DEFAULT '["all"]',
    services_offered_json TEXT NOT NULL DEFAULT '[]',
    is_verified INTEGER NOT NULL DEFAULT 1,
    is_available INTEGER NOT NULL DEFAULT 1,
    contact_phone TEXT,
    contact_email TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_experts_lookup ON verified_experts(tenant_id, is_verified, is_available);

-- 3. AI Message Drafts & Staging Table (Section 8 & 10 Draft Approval Mode)
CREATE TABLE IF NOT EXISTS message_drafts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    lead_id TEXT,
    suggested_text TEXT NOT NULL,
    rationale TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved_sent', 'rejected', 'modified_sent')),
    modified_text TEXT,
    reviewed_by TEXT,
    reviewed_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_drafts_pending ON message_drafts(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_convo ON message_drafts(conversation_id, created_at DESC);

-- 4. Approved Business Knowledge Items (Section 9 Anti-Hallucination Guardrail)
CREATE TABLE IF NOT EXISTS business_knowledge_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('residency_package', 'business_service', 'policy', 'faq')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    price_aed REAL,
    is_approved_by_client INTEGER NOT NULL DEFAULT 0,
    approval_notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_knowledge_approved ON business_knowledge_items(tenant_id, is_approved_by_client, category);
