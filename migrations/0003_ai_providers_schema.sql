-- Migration 0003: Dynamic AI Providers & Automation Schema

-- Dynamic OpenAI-compatible providers table (Configurable per tenant from dashboard)
CREATE TABLE IF NOT EXISTS tenant_ai_providers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL, -- e.g. "Groq Production", "OpenRouter Primary", "OpenAI Backup"
    provider_type TEXT NOT NULL DEFAULT 'openai_compatible',
    base_url TEXT NOT NULL, -- e.g. "https://api.openai.com/v1", "https://api.groq.com/openai/v1"
    encrypted_api_key TEXT NOT NULL, -- Web Crypto AES-256-GCM
    key_version INTEGER NOT NULL DEFAULT 1,
    key_nonce TEXT NOT NULL, -- Base64 12-byte IV
    default_model TEXT NOT NULL, -- e.g. "gpt-4o-mini", "llama-3.3-70b-versatile", "deepseek-chat"
    temperature REAL NOT NULL DEFAULT 0.2,
    max_tokens INTEGER NOT NULL DEFAULT 600,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0, -- 1 = default provider for this tenant
    custom_headers TEXT, -- Optional JSON string for extra headers
    last_health_check_at INTEGER,
    last_health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (last_health_status IN ('unknown', 'healthy', 'error', 'unauthorized')),
    last_health_latency_ms INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tenant_ai_providers ON tenant_ai_providers(tenant_id, is_active, is_default);

-- Channel automation settings (Master switches, human approval mode, rate limits)
CREATE TABLE IF NOT EXISTS channel_automation_settings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('all', 'instagram', 'whatsapp')),
    enabled INTEGER NOT NULL DEFAULT 1, -- 1 = AI automation ON
    approval_required INTEGER NOT NULL DEFAULT 0, -- 1 = Drafts only, requires staff approval
    max_auto_replies_per_convo INTEGER NOT NULL DEFAULT 15,
    confidence_threshold REAL NOT NULL DEFAULT 0.7,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE (tenant_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_channel_settings ON channel_automation_settings(tenant_id, channel);

-- AI telemetry and run history (Sanitized, no raw secrets or PII)
CREATE TABLE IF NOT EXISTS ai_runs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    provider_id TEXT,
    model TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    outcome TEXT NOT NULL CHECK (outcome IN ('reply_generated', 'draft_saved', 'human_review_required', 'error', 'safety_block')),
    lead_score INTEGER,
    error_code TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_runs_conversation ON ai_runs(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_tenant_time ON ai_runs(tenant_id, created_at DESC);

-- Knowledge base articles (Approved factual visa guidelines)
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g. "student_visa", "work_permit", "visitor"
    destination_country TEXT,
    content TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    reviewed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_knowledge_lookup ON knowledge_articles(tenant_id, is_active, category, destination_country);
