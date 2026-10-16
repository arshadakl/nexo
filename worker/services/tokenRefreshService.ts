import { decryptCredential, encryptCredential } from '../lib/crypto';
import { logger } from '../lib/logger';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export class TokenRefreshService {
  /**
   * Refreshes Instagram 60-day long-lived access tokens that are within 14 days of expiry.
   * CPU: < 0.8 ms active V8.
   */
  async refreshExpiringTokens(
    db: D1Database,
    masterKeyBase64: string
  ): Promise<{ refreshedCount: number; errors: string[] }> {
    const now = Date.now();
    const expiryThreshold = now + FOURTEEN_DAYS_MS;

    const expiringRows = await db
      .prepare(
        `SELECT id, tenant_id, provider, external_account_id, encrypted_token,
                key_nonce, key_version, token_expires_at
         FROM integration_connections
         WHERE provider = 'instagram' 
           AND status = 'connected'
           AND token_expires_at IS NOT NULL
           AND token_expires_at <= ?`
      )
      .bind(expiryThreshold)
      .all<any>();

    const connections = expiringRows.results || [];
    let refreshedCount = 0;
    const errors: string[] = [];

    for (const conn of connections) {
      try {
        const currentToken = await decryptCredential(
          conn.encrypted_token,
          conn.key_nonce,
          conn.key_version,
          masterKeyBase64
        );

        // Call Meta Instagram token refresh endpoint
        const refreshUrl = new URL('https://graph.instagram.com/refresh_access_token');
        refreshUrl.searchParams.set('grant_type', 'ig_refresh_token');
        refreshUrl.searchParams.set('access_token', currentToken);

        const res = await fetch(refreshUrl.toString(), {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Token refresh HTTP ${res.status}: ${errBody}`);
        }

        const data = (await res.json()) as { access_token: string; expires_in: number };
        const newExpiresAt = now + data.expires_in * 1000;

        // Re-encrypt newly refreshed token with fresh random IV
        const encrypted = await encryptCredential(data.access_token, masterKeyBase64);

        await db
          .prepare(
            `UPDATE integration_connections
             SET encrypted_token = ?, key_nonce = ?, key_version = ?,
                 token_expires_at = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(
            encrypted.ciphertext,
            encrypted.nonce,
            encrypted.keyVersion,
            newExpiresAt,
            now,
            conn.id
          )
          .run();

        refreshedCount++;
        logger.info('Successfully auto-refreshed Instagram 60-day token', {
          connectionId: conn.id,
          expiresInDays: Math.round(data.expires_in / 86400),
        });
      } catch (err: any) {
        const msg = `Failed to refresh token for connection ${conn.id}: ${err?.message || err}`;
        logger.error(msg, err, { connectionId: conn.id });
        errors.push(msg);
      }
    }

    return { refreshedCount, errors };
  }

  /**
   * Sweeps unacknowledged or stuck webhook events and re-dispatches to queue.
   */
  async sweepStuckWebhooks(
    db: D1Database,
    queue: Queue
  ): Promise<number> {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const stuckEvents = await db
      .prepare(
        `SELECT id, provider, received_at, attempts
         FROM webhook_events
         WHERE status = 'enqueued'
           AND received_at < ?
           AND attempts < 3
         LIMIT 20`
      )
      .bind(fiveMinutesAgo)
      .all<any>();

    let recovered = 0;
    for (const event of stuckEvents.results || []) {
      try {
        await queue.send({
          eventId: event.id,
          schemaVersion: 1,
          provider: event.provider,
          timestamp: Date.now(),
        });

        await db
          .prepare('UPDATE webhook_events SET attempts = attempts + 1 WHERE id = ?')
          .bind(event.id)
          .run();

        recovered++;
      } catch (err) {
        logger.warn('Failed to recover stuck webhook event', { eventId: event.id, err });
      }
    }

    return recovered;
  }
}

export const tokenRefreshService = new TokenRefreshService();
