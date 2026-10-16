import type {
  MetaConnectionSummary,
  DecryptedConnection,
  MetaProvider,
  ConnectionStatus,
} from '@shared/types/meta.types';
import { encryptCredential, decryptCredential } from '../lib/crypto';

export class ConnectionRepository {
  /**
   * Records a single-use OAuth attempt with hashed state.
   */
  async createOAuthAttempt(
    db: D1Database,
    params: {
      stateHash: string;
      tenantId: string;
      userId: string;
      provider: MetaProvider;
      redirectUri: string;
      expiresAt: number;
    }
  ): Promise<void> {
    const id = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO oauth_attempts (
          id, state_hash, tenant_id, user_id, provider, redirect_uri, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        params.stateHash,
        params.tenantId,
        params.userId,
        params.provider,
        params.redirectUri,
        params.expiresAt,
        now
      )
      .run();
  }

  /**
   * Validates and marks an OAuth state as consumed in an atomic operation.
   * Prevents replay attacks.
   */
  async validateAndConsumeState(
    db: D1Database,
    stateHash: string,
    provider: MetaProvider
  ): Promise<{ tenantId: string; userId: string; redirectUri: string } | null> {
    const now = Date.now();

    const row = await db
      .prepare(
        `SELECT id, tenant_id, user_id, redirect_uri, expires_at, consumed_at
        FROM oauth_attempts
        WHERE state_hash = ? AND provider = ?
        LIMIT 1`
      )
      .bind(stateHash, provider)
      .first<any>();

    if (!row || row.consumed_at !== null || row.expires_at < now) {
      return null;
    }

    // Mark consumed immediately
    await db
      .prepare('UPDATE oauth_attempts SET consumed_at = ? WHERE id = ?')
      .bind(now, row.id)
      .run();

    return {
      tenantId: row.tenant_id,
      userId: row.user_id,
      redirectUri: row.redirect_uri,
    };
  }

  /**
   * Lists active connections for a tenant (without decrypted token secrets).
   */
  async listByTenant(db: D1Database, tenantId: string): Promise<MetaConnectionSummary[]> {
    const rows = await db
      .prepare(
        `SELECT 
          id, provider, external_account_id, display_name, phone_number,
          status, granted_scopes, webhook_subscribed, last_health_check_at,
          last_webhook_at, error_code, token_expires_at, created_at
        FROM integration_connections
        WHERE tenant_id = ?
        ORDER BY created_at ASC`
      )
      .bind(tenantId)
      .all<any>();

    if (!rows.results) return [];

    return rows.results.map((r) => {
      const summary: MetaConnectionSummary = {
        id: r.id,
        provider: r.provider as MetaProvider,
        externalAccountId: r.external_account_id,
        status: r.status as ConnectionStatus,
        grantedScopes: r.granted_scopes ? JSON.parse(r.granted_scopes) : [],
        webhookSubscribed: Boolean(r.webhook_subscribed),
        createdAt: r.created_at,
      };

      if (r.display_name !== null) summary.displayName = r.display_name;
      if (r.phone_number !== null) summary.phoneNumber = r.phone_number;
      if (r.last_health_check_at !== null) summary.lastHealthCheckAt = r.last_health_check_at;
      if (r.last_webhook_at !== null) summary.lastWebhookAt = r.last_webhook_at;
      if (r.error_code !== null) summary.errorCode = r.error_code;
      if (r.token_expires_at !== null) summary.tokenExpiresAt = r.token_expires_at;

      return summary;
    });
  }

  /**
   * Gets a decrypted connection by provider and external account ID (used by webhooks & send API).
   */
  async getByExternalIdDecrypted(
    db: D1Database,
    provider: MetaProvider,
    externalAccountId: string,
    masterKeyBase64: string
  ): Promise<DecryptedConnection | null> {
    const row = await db
      .prepare(
        `SELECT 
          id, tenant_id, provider, external_account_id, display_name,
          phone_number, phone_number_id, waba_id, encrypted_token,
          key_nonce, key_version, token_expires_at, status, granted_scopes,
          webhook_subscribed
        FROM integration_connections
        WHERE provider = ? AND external_account_id = ?
        LIMIT 1`
      )
      .bind(provider, externalAccountId)
      .first<any>();

    if (!row) return null;

    const decryptedToken = await decryptCredential(
      row.encrypted_token,
      row.key_nonce,
      row.key_version,
      masterKeyBase64
    );

    const connection: DecryptedConnection = {
      id: row.id,
      tenantId: row.tenant_id,
      provider: row.provider as MetaProvider,
      externalAccountId: row.external_account_id,
      accessToken: decryptedToken,
      status: row.status as ConnectionStatus,
      grantedScopes: row.granted_scopes ? JSON.parse(row.granted_scopes) : [],
      webhookSubscribed: Boolean(row.webhook_subscribed),
    };

    if (row.display_name !== null) connection.displayName = row.display_name;
    if (row.phone_number !== null) connection.phoneNumber = row.phone_number;
    if (row.phone_number_id !== null) connection.phoneNumberId = row.phone_number_id;
    if (row.waba_id !== null) connection.wabaId = row.waba_id;
    if (row.token_expires_at !== null) connection.tokenExpiresAt = row.token_expires_at;

    return connection;
  }

  /**
   * Gets a decrypted connection by its primary ID.
   */
  async getByIdDecrypted(
    db: D1Database,
    connectionId: string,
    masterKeyBase64: string
  ): Promise<DecryptedConnection | null> {
    const row = await db
      .prepare(
        `SELECT 
          id, tenant_id, provider, external_account_id, display_name,
          phone_number, phone_number_id, waba_id, encrypted_token,
          key_nonce, key_version, token_expires_at, status, granted_scopes,
          webhook_subscribed
        FROM integration_connections
        WHERE id = ?
        LIMIT 1`
      )
      .bind(connectionId)
      .first<any>();

    if (!row) return null;

    const decryptedToken = await decryptCredential(
      row.encrypted_token,
      row.key_nonce,
      row.key_version,
      masterKeyBase64
    );

    const connection: DecryptedConnection = {
      id: row.id,
      tenantId: row.tenant_id,
      provider: row.provider as MetaProvider,
      externalAccountId: row.external_account_id,
      accessToken: decryptedToken,
      status: row.status as ConnectionStatus,
      grantedScopes: row.granted_scopes ? JSON.parse(row.granted_scopes) : [],
      webhookSubscribed: Boolean(row.webhook_subscribed),
    };

    if (row.display_name !== null) connection.displayName = row.display_name;
    if (row.phone_number !== null) connection.phoneNumber = row.phone_number;
    if (row.phone_number_id !== null) connection.phoneNumberId = row.phone_number_id;
    if (row.waba_id !== null) connection.wabaId = row.waba_id;
    if (row.token_expires_at !== null) connection.tokenExpiresAt = row.token_expires_at;

    return connection;
  }

  /**
   * Saves or updates a verified connection, encrypting the access token with AES-256-GCM.
   */
  async upsertConnection(
    db: D1Database,
    params: {
      tenantId: string;
      provider: MetaProvider;
      externalAccountId: string;
      displayName?: string | undefined;
      grantedScopes: string[];
      accessToken: string;
      expiresInSeconds?: number | undefined;
      webhookSubscribed?: boolean | undefined;
    },
    masterKeyBase64: string
  ): Promise<string> {
    const now = Date.now();
    const tokenExpiresAt = params.expiresInSeconds ? now + params.expiresInSeconds * 1000 : null;

    const encrypted = await encryptCredential(params.accessToken, masterKeyBase64);
    const scopesJson = JSON.stringify(params.grantedScopes);

    // Check existing
    const existing = await db
      .prepare(
        'SELECT id FROM integration_connections WHERE tenant_id = ? AND provider = ? AND external_account_id = ?'
      )
      .bind(params.tenantId, params.provider, params.externalAccountId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(
          `UPDATE integration_connections
          SET display_name = ?, granted_scopes = ?, encrypted_token = ?,
              key_nonce = ?, key_version = ?, token_expires_at = ?,
              status = 'connected', webhook_subscribed = ?, updated_at = ?
          WHERE id = ?`
        )
        .bind(
          params.displayName || null,
          scopesJson,
          encrypted.ciphertext,
          encrypted.nonce,
          encrypted.keyVersion,
          tokenExpiresAt,
          params.webhookSubscribed ? 1 : 0,
          now,
          existing.id
        )
        .run();
      return existing.id;
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO integration_connections (
          id, tenant_id, provider, external_account_id, display_name,
          granted_scopes, encrypted_token, key_version, key_nonce,
          token_expires_at, status, webhook_subscribed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', ?, ?, ?)`
      )
      .bind(
        id,
        params.tenantId,
        params.provider,
        params.externalAccountId,
        params.displayName || null,
        scopesJson,
        encrypted.ciphertext,
        encrypted.keyVersion,
        encrypted.nonce,
        tokenExpiresAt,
        params.webhookSubscribed ? 1 : 0,
        now,
        now
      )
      .run();

    return id;
  }

  /**
   * Marks a connection as disconnected and purges its encrypted token material.
   */
  async disconnect(db: D1Database, tenantId: string, connectionId: string): Promise<boolean> {
    const now = Date.now();
    const result = await db
      .prepare(
        `UPDATE integration_connections
        SET status = 'disconnected', encrypted_token = '', webhook_subscribed = 0, updated_at = ?
        WHERE tenant_id = ? AND id = ?`
      )
      .bind(now, tenantId, connectionId)
      .run();

    return (result.meta?.changes ?? 0) > 0;
  }
}

export const connectionRepository = new ConnectionRepository();
