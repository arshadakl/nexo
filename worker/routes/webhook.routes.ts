import { Hono } from 'hono';
import { constantTimeEqual, verifyMetaSignature } from '../lib/crypto';
import { instagramWebhookAdapter } from '../adapters/meta/instagramWebhook';
import { instagramOAuthAdapter } from '../adapters/meta/instagramOAuth';
import { whatsappWebhookAdapter } from '../adapters/meta/whatsappWebhook';
import { logger } from '../lib/logger';
import { conversationRepository } from '../repositories/conversationRepository';
import type { WorkerEnv } from '../env';

/** Seconds to wait before processing so rapidly consecutive messages form one conversational turn. */
export function inboundDebounceSeconds(env: Pick<WorkerEnv, 'INBOUND_DEBOUNCE_SECONDS'>): number {
  const parsed = Number(env.INBOUND_DEBOUNCE_SECONDS);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(Math.round(parsed), 60) : 4;
}

export const webhookRoutes = new Hono<{ Bindings: WorkerEnv }>();

const MAX_PAYLOAD_BYTES = 128 * 1024; // 128 KiB body size limit

/**
 * GET /webhooks/meta/instagram
 * Verifies webhook subscription challenge from Meta.
 * CPU: < 0.4 ms.
 */
webhookRoutes.get('/meta/instagram', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  const expectedToken = c.env.WEBHOOK_VERIFY_TOKEN || 'nexo_webhook_verify_secret';

  if (mode === 'subscribe' && token && constantTimeEqual(token, expectedToken)) {
    logger.info('Meta Instagram webhook challenge verified successfully');
    return c.text(challenge || '', 200);
  }

  logger.warn('Meta Instagram webhook challenge failed verification', {
    mode,
    hasToken: Boolean(token),
  });

  return c.text('Forbidden: Invalid verify token', 403);
});

/**
 * POST /webhooks/meta/instagram
 * Ingests inbound Meta Instagram events, checks HMAC signature, inserts to D1, enqueues to Queue.
 * Strict target: < 1.8 ms active CPU.
 */
webhookRoutes.post('/meta/instagram', async (c) => {
  const signatureHeader = c.req.header('x-hub-signature-256');
  const appSecret = c.env.META_APP_SECRET || 'dev_app_secret_123';

  // Read raw body once for HMAC verification
  const rawBody = await c.req.raw.text();

  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    logger.warn('Rejected oversized webhook payload', { sizeBytes: rawBody.length });
    return c.text('Payload too large', 413);
  }

  // Constant-time HMAC-SHA256 signature verification (< 0.3 ms CPU)
  const isValidSignature = await verifyMetaSignature(rawBody, signatureHeader, appSecret);
  if (!isValidSignature && c.env.ENVIRONMENT === 'production') {
    logger.error('Invalid Meta webhook signature', null, { hasHeader: Boolean(signatureHeader) });
    return c.text('Forbidden: Invalid signature', 403);
  }

  let parsedPayload: any;
  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    return c.text('Bad Request: Invalid JSON', 400);
  }

  const events = instagramWebhookAdapter.normalizeWebhookPayload(parsedPayload);
  if (events.length === 0) {
    // Acknowledge receipt of unknown or echo events without spending Queue operations
    return c.text('EVENT_RECEIVED', 200);
  }

  const now = Date.now();

  for (const event of events) {
    const eventId = crypto.randomUUID();

    try {
      // Find connection and tenant: try exact external_account_id, fallback to active provider connection
      let connection = await c.env.DB
        .prepare('SELECT id, tenant_id FROM integration_connections WHERE provider = ? AND external_account_id = ?')
        .bind('instagram', event.externalAccountId)
        .first<{ id: string; tenant_id: string }>();

      if (!connection) {
        connection = await c.env.DB
          .prepare('SELECT id, tenant_id FROM integration_connections WHERE provider = ? AND status = ? LIMIT 1')
          .bind('instagram', 'connected')
          .first<{ id: string; tenant_id: string }>();
      }

      const tenantId = connection?.tenant_id || null;
      const connectionId = connection?.id || null;

      // Durable D1 insert directly with status 'enqueued' (saves 1 round-trip)
      const ingested = await c.env.DB
        .prepare(
          `INSERT INTO webhook_events (
            id, tenant_id, connection_id, event_key, provider,
            event_type, status, attempts, payload_json, received_at
          ) VALUES (?, ?, ?, ?, 'instagram', 'message', 'enqueued', 0, ?, ?)
          ON CONFLICT(event_key) DO NOTHING`
        )
        .bind(eventId, tenantId, connectionId, event.eventKey, JSON.stringify(event), now)
        .run();

      // Meta redelivers webhooks; a known event_key was already ingested and enqueued.
      if (ingested.meta.changes === 0) continue;

      // Immediately persist conversation and message into D1 so inbox updates in real-time
      if (tenantId && connectionId) {
        let conversation = await c.env.DB
          .prepare('SELECT id FROM conversations WHERE connection_id = ? AND provider_convo_id = ?')
          .bind(connectionId, event.providerConvoId)
          .first<{ id: string }>();

        // Attempt to resolve real Instagram username via Graph API
        let customerName = 'Instagram User';
        let customerHandle: string | null = null;

        try {
          const connSecret = await c.env.DB
            .prepare('SELECT encrypted_token, key_nonce, key_version FROM integration_connections WHERE id = ?')
            .bind(connectionId)
            .first<{ encrypted_token: string; key_nonce: string; key_version: number }>();

          if (connSecret) {
            const masterKey = c.env.META_TOKEN_ENCRYPTION_KEY || 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
            const { decryptCredential } = await import('../lib/crypto');
            const token = await decryptCredential(
              connSecret.encrypted_token,
              connSecret.key_nonce,
              connSecret.key_version,
              masterKey
            );
            const userProfile = await instagramOAuthAdapter.fetchUserProfile(token, event.senderId);
            if (userProfile?.username) {
              customerHandle = userProfile.username;
              customerName = userProfile.name || `@${userProfile.username}`;
            }
          }
        } catch (err) {
          logger.warn('Could not resolve customer profile metadata', { senderId: event.senderId });
        }

        let conversationId: string;
        if (!conversation) {
          conversationId = crypto.randomUUID();
          await c.env.DB
            .prepare(
              `INSERT INTO conversations (
                id, tenant_id, connection_id, channel, provider_convo_id,
                customer_id, customer_name, customer_handle, ai_mode, human_takeover,
                unread_count, last_message_at, created_at, updated_at
              ) VALUES (?, ?, ?, 'instagram', ?, ?, ?, ?, 'INHERIT', 0, 1, ?, ?, ?)`
            )
            .bind(
              conversationId,
              tenantId,
              connectionId,
              event.providerConvoId,
              event.senderId,
              customerName,
              customerHandle,
              now,
              now,
              now
            )
            .run();
        } else {
          conversationId = conversation.id;
          await c.env.DB
            .prepare('UPDATE conversations SET last_message_at = ?, unread_count = unread_count + 1, customer_name = COALESCE(?, customer_name), customer_handle = COALESCE(?, customer_handle), updated_at = ? WHERE id = ?')
            .bind(now, customerName !== 'Instagram User' ? customerName : null, customerHandle, now, conversationId)
            .run();
        }

        await conversationRepository.insertInboundMessage(c.env.DB, {
          tenantId,
          conversationId,
          providerMessageId: event.providerMessageId,
          senderId: event.senderId,
          messageText: event.messageText,
          messageType: event.messageType,
          attachments: event.attachments,
          timestamp: event.timestamp,
        });
      }

      // Enqueue lightweight pointer to Cloudflare Queue for async AI qualification.
      // The delay groups rapidly consecutive messages into one turn (see queue consumer).
      await c.env.MESSAGING_QUEUE.send(
        {
          eventId,
          schemaVersion: 1,
          provider: 'instagram',
          timestamp: now,
        },
        { delaySeconds: inboundDebounceSeconds(c.env) }
      );
    } catch (err) {
      logger.error('Failed to durably ingest webhook event', err, {
        eventKey: event.eventKey,
      });
      // Continue processing other events in batch
    }
  }

  return c.text('EVENT_RECEIVED', 200);
});

/**
 * GET /webhooks/meta/whatsapp
 * Verifies webhook subscription challenge for WhatsApp from Meta.
 * CPU: < 0.4 ms.
 */
webhookRoutes.get('/meta/whatsapp', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  const expectedToken = c.env.WEBHOOK_VERIFY_TOKEN || 'nexo_webhook_verify_secret';

  if (mode === 'subscribe' && token && constantTimeEqual(token, expectedToken)) {
    logger.info('Meta WhatsApp webhook challenge verified successfully');
    return c.text(challenge || '', 200);
  }

  logger.warn('Meta WhatsApp webhook challenge failed verification', {
    mode,
    hasToken: Boolean(token),
  });

  return c.text('Forbidden: Invalid verify token', 403);
});

/**
 * POST /webhooks/meta/whatsapp
 * Ingests inbound Meta WhatsApp Cloud API events, checks HMAC signature, inserts to D1, enqueues to Queue.
 * Strict target: < 1.6 ms active CPU.
 */
webhookRoutes.post('/meta/whatsapp', async (c) => {
  const signatureHeader = c.req.header('x-hub-signature-256');
  const appSecret = c.env.META_APP_SECRET || 'dev_app_secret_123';

  const rawBody = await c.req.raw.text();

  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    logger.warn('Rejected oversized WhatsApp webhook payload', { sizeBytes: rawBody.length });
    return c.text('Payload too large', 413);
  }

  const isValidSignature = await verifyMetaSignature(rawBody, signatureHeader, appSecret);
  if (!isValidSignature && c.env.ENVIRONMENT === 'production') {
    logger.error('Invalid WhatsApp webhook signature', null, { hasHeader: Boolean(signatureHeader) });
    return c.text('Forbidden: Invalid signature', 403);
  }

  let parsedPayload: any;
  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    return c.text('Bad Request: Invalid JSON', 400);
  }

  const events = whatsappWebhookAdapter.normalizeWebhookPayload(parsedPayload);
  if (events.length === 0) {
    return c.text('EVENT_RECEIVED', 200);
  }

  const now = Date.now();

  for (const event of events) {
    const eventId = crypto.randomUUID();

    try {
      // Find WhatsApp connection by phone_number_id
      const connection = await c.env.DB
        .prepare('SELECT id, tenant_id FROM integration_connections WHERE provider = ? AND external_account_id = ?')
        .bind('whatsapp', event.phoneNumberId)
        .first<{ id: string; tenant_id: string }>();

      const tenantId = connection?.tenant_id || null;
      const connectionId = connection?.id || null;

      // Durable D1 insert directly with status 'enqueued' (saves 1 round-trip)
      const ingested = await c.env.DB
        .prepare(
          `INSERT INTO webhook_events (
            id, tenant_id, connection_id, event_key, provider,
            event_type, status, attempts, payload_json, received_at
          ) VALUES (?, ?, ?, ?, 'whatsapp', 'message', 'enqueued', 0, ?, ?)
          ON CONFLICT(event_key) DO NOTHING`
        )
        .bind(eventId, tenantId, connectionId, event.eventKey, JSON.stringify(event), now)
        .run();

      // Meta redelivers webhooks; a known event_key was already ingested and enqueued.
      if (ingested.meta.changes === 0) continue;

      // Enqueue to Cloudflare Queue (delayed so consecutive messages form one turn)
      await c.env.MESSAGING_QUEUE.send(
        {
          eventId,
          schemaVersion: 1,
          provider: 'whatsapp',
          timestamp: now,
        },
        { delaySeconds: inboundDebounceSeconds(c.env) }
      );
    } catch (err) {
      logger.error('Failed to durably ingest WhatsApp webhook event', err, {
        eventKey: event.eventKey,
      });
    }
  }

  return c.text('EVENT_RECEIVED', 200);
});
