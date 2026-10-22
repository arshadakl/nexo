-- Migration 0009: Conversation automation lifecycle, turn processing and lead profile separation
-- 1. message_drafts gains a send lifecycle (sending / send_failed / superseded) and review context.
-- 2. messages records when an inbound message has been handled by the AI turn processor.
-- 3. leads stores location/visa fields separately, a qualification score, and dashboard-confirmed fields.
-- 4. Releases pauses that the AI pipeline (not a human) set through human_takeover.

CREATE TABLE message_drafts_v9 (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    lead_id TEXT,
    suggested_text TEXT NOT NULL,
    rationale TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (
        status IN ('pending_review', 'sending', 'send_failed', 'approved_sent', 'modified_sent', 'rejected', 'superseded')
    ),
    modified_text TEXT,
    reviewed_by TEXT,
    reviewed_at INTEGER,
    created_at INTEGER NOT NULL,
    review_kind TEXT,
    review_reason TEXT,
    customer_question TEXT,
    based_on_message_at INTEGER,
    sent_message_id TEXT,
    send_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    updated_at INTEGER,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

INSERT INTO message_drafts_v9 (
    id, tenant_id, conversation_id, lead_id, suggested_text, rationale, status,
    modified_text, reviewed_by, reviewed_at, created_at, updated_at
)
SELECT
    id, tenant_id, conversation_id, lead_id, suggested_text, rationale, status,
    modified_text, reviewed_by, reviewed_at, created_at, COALESCE(reviewed_at, created_at)
FROM message_drafts;

DROP TABLE message_drafts;
ALTER TABLE message_drafts_v9 RENAME TO message_drafts;

CREATE INDEX idx_drafts_pending ON message_drafts(tenant_id, status, created_at DESC);
CREATE INDEX idx_drafts_convo ON message_drafts(conversation_id, status, created_at DESC);

-- Inbound messages that the AI has not yet handled have ai_processed_at = NULL.
ALTER TABLE messages ADD COLUMN ai_processed_at INTEGER;
UPDATE messages SET ai_processed_at = created_at WHERE direction = 'inbound';
CREATE INDEX idx_messages_unprocessed ON messages(conversation_id, direction, ai_processed_at, created_at);

ALTER TABLE leads ADD COLUMN current_country TEXT;
ALTER TABLE leads ADD COLUMN current_city TEXT;
ALTER TABLE leads ADD COLUMN visa_status TEXT;
ALTER TABLE leads ADD COLUMN timeline_stated_at INTEGER;
ALTER TABLE leads ADD COLUMN qualification TEXT NOT NULL DEFAULT 'unknown' CHECK (
    qualification IN ('hot', 'warm', 'cold', 'unknown', 'outside_scope')
);
ALTER TABLE leads ADD COLUMN qualification_reason TEXT;
ALTER TABLE leads ADD COLUMN contact_pending INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN confirmed_fields_json TEXT;
ALTER TABLE leads ADD COLUMN ai_suggestions_json TEXT;

-- Before this migration the queue consumer set human_takeover = 1 (without a user) whenever a reply
-- needed review, and nothing cleared it. Review is now represented by pending drafts, so those
-- AI-set pauses are released. Takeovers made by a staff member (takeover_user_id set) are kept.
UPDATE conversations
SET human_takeover = 0, takeover_at = NULL
WHERE human_takeover = 1 AND takeover_user_id IS NULL;
