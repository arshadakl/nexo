import { Hono } from 'hono';
import { constantTimeEqual, verifyMetaSignature } from '../lib/crypto';
import { instagramWebhookAdapter } from '../adapters/meta/instagramWebhook';
import { whatsappWebhookAdapter } from '../adapters/meta/whatsappWebhook';
import { logger } from '../lib/logger';
import type { WorkerEnv } from '../env';

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
      // Find connection and tenant
      const connection = await c.env.DB
        .prepare('SELECT id, tenant_id FROM integration_connections WHERE provider = ? AND external_account_id = ?')
        .bind('instagram', event.externalAccountId)
        .first<{ id: string; tenant_id: string }>();

      const tenantId = connection?.tenant_id || null;
      const connectionId = connection?.id || null;

      // Durable D1 insert with UNIQUE event_key constraint
      await c.env.DB
        .prepare(
          `INSERT INTO webhook_events (
            id, tenant_id, connection_id, event_key, provider,
            event_type, status, attempts, payload_json, received_at
          ) VALUES (?, ?, ?, ?, 'instagram', 'message', 'received', 0, ?, ?)
          ON CONFLICT(event_key) DO NOTHING`
        )
        .bind(eventId, tenantId, connectionId, event.eventKey, JSON.stringify(event), now)
        .run();

      // Enqueue lightweight pointer to Cloudflare Queue
      await c.env.MESSAGING_QUEUE.send({
        eventId,
        schemaVersion: 1,
        provider: 'instagram',
        timestamp: now,
      });

      // Update event status to enqueued
      await c.env.DB
        .prepare("UPDATE webhook_events SET status = 'enqueued' WHERE id = ?")
        .bind(eventId)
        .run();
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

      // Durable D1 insert with UNIQUE event_key constraint
      await c.env.DB
        .prepare(
          `INSERT INTO webhook_events (
            id, tenant_id, connection_id, event_key, provider,
            event_type, status, attempts, payload_json, received_at
          ) VALUES (?, ?, ?, ?, 'whatsapp', 'message', 'received', 0, ?, ?)
          ON CONFLICT(event_key) DO NOTHING`
        )
        .bind(eventId, tenantId, connectionId, event.eventKey, JSON.stringify(event), now)
        .run();

      // Enqueue to Cloudflare Queue
      await c.env.MESSAGING_QUEUE.send({
        eventId,
        schemaVersion: 1,
        provider: 'whatsapp',
        timestamp: now,
      });

      await c.env.DB
        .prepare("UPDATE webhook_events SET status = 'enqueued' WHERE id = ?")
        .bind(eventId)
        .run();
    } catch (err) {
      logger.error('Failed to durably ingest WhatsApp webhook event', err, {
        eventKey: event.eventKey,
      });
    }
  }

  return c.text('EVENT_RECEIVED', 200);
});
