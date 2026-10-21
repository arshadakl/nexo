import { Hono } from 'hono';
import { securityHeaders } from './middleware/securityHeaders';
import { errorHandler } from './middleware/errorHandler';
import { healthRoutes } from './routes/health.routes';
import { aiProviderRoutes } from './routes/aiProvider.routes';
import { integrationRoutes } from './routes/instagramOAuth.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { logger } from './lib/logger';
import type { WorkerEnv } from './env';

import { conversationRoutes } from './routes/conversation.routes';
import { leadRoutes } from './routes/lead.routes';

const app = new Hono<{ Bindings: WorkerEnv }>();

// Global middleware
app.use('*', securityHeaders);
app.onError(errorHandler);

import { whatsappRoutes } from './routes/whatsapp.routes';
import { analyticsRoutes } from './routes/analytics.routes';
import { authRoutes } from './routes/auth.routes';
import { privacyRoutes } from './routes/privacy.routes';

// Mount public and API routes
app.route('/api/auth', authRoutes);
app.route('/api', healthRoutes);
app.route('/api/ai', aiProviderRoutes);
app.route('/api/integrations/whatsapp', whatsappRoutes);
app.route('/api/integrations', integrationRoutes);
app.route('/api/conversations', conversationRoutes);
app.route('/api/leads', leadRoutes);
app.route('/api/analytics', analyticsRoutes);
app.route('/webhooks', webhookRoutes);
app.route('/', privacyRoutes);

// Fallback 404 for unknown API endpoints
app.all('/api/*', (c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `API endpoint ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

import { processQueueBatch } from './queue/consumer';
import { tokenRefreshService } from './services/tokenRefreshService';

// Single Cloudflare Worker Export: fetch, queue, scheduled
export default {
  // HTTP Fetch handler: routes API, webhooks & privacy pages to Hono, all else to Workers Static Assets (React SPA)
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (
      url.pathname.startsWith('/api') ||
      url.pathname.startsWith('/webhooks') ||
      url.pathname === '/privacy-policy' ||
      url.pathname === '/terms'
    ) {
      return app.fetch(request, env, ctx);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return app.fetch(request, env, ctx);
  },

  // Queue consumer handler (Processes async message qualification and AI tasks)
  async queue(batch: MessageBatch<any>, env: WorkerEnv, _ctx: ExecutionContext): Promise<void> {
    await processQueueBatch(batch, env);
  },


  // Scheduled cron handler (Runs token auto-refresh and dead-letter webhook sweep)
  async scheduled(event: ScheduledEvent, env: WorkerEnv, _ctx: ExecutionContext): Promise<void> {
    logger.info('Scheduled cron execution triggered', {
      cron: event.cron,
      scheduledTime: event.scheduledTime,
    });

    const masterKey = env.META_TOKEN_ENCRYPTION_KEY || 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

    try {
      // 1. Auto-refresh Instagram 60-day tokens within 14 days of expiry
      const { refreshedCount, errors } = await tokenRefreshService.refreshExpiringTokens(
        env.DB,
        masterKey
      );

      // 2. Sweep stuck/unacknowledged webhook events
      const recoveredCount = await tokenRefreshService.sweepStuckWebhooks(
        env.DB,
        env.MESSAGING_QUEUE
      );

      logger.info('Scheduled cron execution completed', {
        refreshedTokens: refreshedCount,
        recoveredWebhooks: recoveredCount,
        errorCount: errors.length,
      });
    } catch (err) {
      logger.error('Error during scheduled cron execution', err);
    }
  },
};
