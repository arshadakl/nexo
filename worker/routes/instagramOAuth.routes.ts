import { Hono } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import { instagramService } from '../services/instagramService';
import { connectionRepository } from '../repositories/connectionRepository';
import type { WorkerEnv } from '../env';

import { resolveTenantId, resolveUserId, getMasterKey } from '../lib/authContext';

export const integrationRoutes = new Hono<{ Bindings: WorkerEnv }>();

/**
 * GET /api/integrations
 * Lists active connections (Instagram & WhatsApp) for the tenant.
 */
integrationRoutes.get('/', async (c) => {
  const tenantId = resolveTenantId(c);
  const connections = await connectionRepository.listByTenant(c.env.DB, tenantId);
  return jsonOk(c, connections);
});

/**
 * POST /api/integrations/instagram/connect
 * Initiates the 1-click popup flow, returning the official Meta authorization URL.
 */
integrationRoutes.post('/instagram/connect', async (c) => {
  const tenantId = resolveTenantId(c);
  const userId = resolveUserId(c);

  const appId = c.env.INSTAGRAM_APP_ID || c.env.META_APP_ID || '123456789012345';
  const origin = new URL(c.req.url).origin;

  const result = await instagramService.initiateOAuth(
    c.env.DB,
    tenantId,
    userId,
    appId,
    origin
  );

  return jsonOk(c, result);
});

/**
 * GET /api/integrations/instagram/callback
 * Target of Meta's OAuth redirect inside the popup window.
 * Exchanges code for 60-day token, saves connection, and transmits success to parent window.
 */
integrationRoutes.get('/instagram/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const errorParam = c.req.query('error') || c.req.query('error_description');

  if (errorParam || !code || !state) {
    const errorMsg = errorParam || 'User cancelled authorization or invalid parameters.';
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Authorization Cancelled</title></head>
        <body style="background:#090d16;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:24px;">
            <h3 style="color:#ef4444;margin-bottom:8px;">Connection Cancelled</h3>
            <p style="color:#94a3b8;font-size:14px;max-width:320px;">${errorMsg}</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'NEXO_META_ERROR',
                error: ${JSON.stringify(errorMsg)}
              }, window.location.origin);
            }
            setTimeout(() => window.close(), 1500);
          </script>
        </body>
      </html>
    `);
  }

  try {
    const origin = new URL(c.req.url).origin;
    const appId = c.env.INSTAGRAM_APP_ID || c.env.META_APP_ID || '123456789012345';
    const appSecret = c.env.INSTAGRAM_APP_SECRET || c.env.META_APP_SECRET || 'dev_app_secret_123';
    const masterKey = getMasterKey(c);

    const result = await instagramService.completeOAuth(c.env.DB, {
      code,
      state,
      appId,
      appSecret,
      requestOrigin: origin,
      masterKeyBase64: masterKey,
    });

    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Instagram Connected</title></head>
        <body style="background:#090d16;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:24px;">
            <div style="width:48px;height:48px;background:rgba(16,185,129,0.2);color:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;">✓</div>
            <h3 style="margin-bottom:8px;font-size:18px;">Connected to @${result.username}!</h3>
            <p style="color:#94a3b8;font-size:14px;">Updating your dashboard...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'NEXO_META_CONNECTED',
                provider: 'instagram',
                connectionId: '${result.connectionId}',
                username: '${result.username}'
              }, window.location.origin);
            }
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
      </html>
    `);
  } catch (err: unknown) {
    const errText = err instanceof Error ? err.message : 'Authentication failure';
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Connection Failed</title></head>
        <body style="background:#090d16;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:24px;">
            <h3 style="color:#ef4444;margin-bottom:8px;">Connection Failed</h3>
            <p style="color:#94a3b8;font-size:14px;max-width:320px;">${errText}</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'NEXO_META_ERROR',
                error: ${JSON.stringify(errText)}
              }, window.location.origin);
            }
            setTimeout(() => window.close(), 2500);
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * POST /api/integrations/:id/disconnect
 * Safely disconnects account and purges encrypted token.
 */
integrationRoutes.post('/:id/disconnect', async (c) => {
  const tenantId = resolveTenantId(c);
  const connectionId = c.req.param('id');

  const disconnected = await connectionRepository.disconnect(c.env.DB, tenantId, connectionId);
  if (!disconnected) {
    return jsonError(c, 'NOT_FOUND', 'Connection not found or already disconnected', 404);
  }

  return jsonOk(c, { success: true, connectionId });
});
