-- Migration 0002: Integrations Schema (Connections, OAuth Attempts, Webhook Ingestion, Outbox Jobs)

-- Integration connections table (Meta Instagram & WhatsApp)
CREATE TABLE IF NOT EXISTS integration_connections (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('instagram', 'whatsapp')),
    external_account_id TEXT NOT NULL,
    display_name TEXT,
    phone_number TEXT,
    phone_number_id TEXT,
    waba_id TEXT,
    granted_scopes TEXT NOT NULL, -- JSON array of scopes
    encrypted_token TEXT NOT NULL, -- Web Crypto AES-256-GCM ciphertext
    key_version INTEGER NOT NULL DEFAULT 1,
    key_nonce TEXT NOT NULL, -- Base64 12-byte IV
    token_expires_at INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'reconnect_required', 'disconnected', 'error')),
    webhook_subscribed INTEGER NOT NULL DEFAULT 0,
    last_health_check_at INTEGER,
    last_webhook_at INTEGER,
    error_code TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE (tenant_id, provider, external_account_id)
);
CREATE INDEX IF NOT EXISTS idx_connections_tenant_provider ON integration_connections(tenant_id, provider, status);
CREATE INDEX IF NOT EXISTS idx_connections_lookup ON integration_connections(provider, external_account_id);

-- OAuth attempts table (Single-use CSRF-resistant state tracking)
CREATE TABLE IF NOT EXISTS oauth_attempts (
    id TEXT PRIMARY KEY,
    state_hash TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('instagram', 'whatsapp')),
    redirect_uri TEXT NOT NULL,
    metadata_json TEXT,
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_oauth_state ON oauth_attempts(state_hash, expires_at);

-- Durable webhook ingestion table
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    connection_id TEXT,
    event_key TEXT NOT NULL UNIQUE, -- Deterministic deduplication key
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'enqueued', 'processing', 'completed', 'failed', 'ignored')),
    attempts INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL, -- Bounded raw payload (max 128 KiB)
    error_message TEXT,
    received_at INTEGER NOT NULL,
    processed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status, received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_connection ON webhook_events(connection_id, received_at DESC);

-- Outbox jobs table (Guarantees asynchronous queue delivery and recovery)
CREATE TABLE IF NOT EXISTS outbox_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    job_type TEXT NOT NULL, -- e.g. 'process_inbound_dm', 'send_outbound_reply'
    linked_id TEXT NOT NULL, -- References webhook_events.id or messages.id
    dedupe_key TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'leased', 'completed', 'failed', 'dead_letter')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    scheduled_at INTEGER NOT NULL,
    lease_owner TEXT,
    lease_expires_at INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outbox_jobs_sweep ON outbox_jobs(status, scheduled_at ASC);
CREATE INDEX IF NOT EXISTS idx_outbox_jobs_lease ON outbox_jobs(lease_expires_at);
