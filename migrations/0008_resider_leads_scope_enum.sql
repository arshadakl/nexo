-- Migration 0008: Add outside_scope_request to leads CHECK constraint
-- Recreates leads table to support 'outside_scope_request' in lead_status

CREATE TABLE leads_v8 (
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
        lead_status IN (
            'needs_clarification',
            'exploring',
            'ready_for_team',
            'handover_requested',
            'handed_over',
            'support_enquiry',
            'outside_scope_request',
            'outside_scope_spam'
        )
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
    current_location TEXT,
    nationality TEXT,
    profession TEXT,
    whatsapp_number TEXT,
    whatsapp_same_as_phone INTEGER DEFAULT 0,
    whatsapp_contact_permission INTEGER DEFAULT 0,
    unanswered_questions_json TEXT,
    confusions_json TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Copy all existing data across
INSERT INTO leads_v8 (
    id, tenant_id, full_name, phone_or_email, service_vertical, residency_intent,
    work_business_activity, uae_location_context, target_emirate, timeline,
    detected_language, contact_method_preference, contact_permission, external_sharing_permission,
    lead_status, status_reason, missing_details_json, questions_answered_json,
    assigned_expert_id, owner_id, next_action, next_action_owner, summary,
    last_qualified_at, created_at, updated_at, current_location, nationality,
    profession, whatsapp_number, whatsapp_same_as_phone, whatsapp_contact_permission,
    unanswered_questions_json, confusions_json
)
SELECT 
    id, tenant_id, full_name, phone_or_email, service_vertical, residency_intent,
    work_business_activity, uae_location_context, target_emirate, timeline,
    detected_language, contact_method_preference, contact_permission, external_sharing_permission,
    lead_status, status_reason, missing_details_json, questions_answered_json,
    assigned_expert_id, owner_id, next_action, next_action_owner, summary,
    last_qualified_at, created_at, updated_at, current_location, nationality,
    profession, whatsapp_number, whatsapp_same_as_phone, whatsapp_contact_permission,
    unanswered_questions_json, confusions_json
FROM leads;

DROP TABLE leads;
ALTER TABLE leads_v8 RENAME TO leads;

-- Recreate performance indexes
CREATE INDEX idx_leads_pipeline ON leads(tenant_id, lead_status, updated_at DESC);
CREATE INDEX idx_leads_owner ON leads(tenant_id, owner_id, lead_status);
CREATE INDEX idx_leads_vertical ON leads(tenant_id, service_vertical, lead_status);
