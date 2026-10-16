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

// Mount API routes
app.route('/api', healthRoutes);
app.route('/api/ai', aiProviderRoutes);
app.route('/api/integrations', integrationRoutes);
app.route('/api/conversations', conversationRoutes);
app.route('/api/leads', leadRoutes);
app.route('/webhooks', webhookRoutes);




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

// Single Cloudflare Worker Export: fetch, queue, scheduled
export default {
  // HTTP Fetch handler
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  // Queue consumer handler (Processes async message qualification and AI tasks)
  async queue(batch: MessageBatch<any>, env: WorkerEnv, _ctx: ExecutionContext): Promise<void> {
    await processQueueBatch(batch, env);
  },


  // Scheduled cron sweeper (Runs every 5 minutes to recover pending outbox jobs)
  async scheduled(event: ScheduledEvent, _env: WorkerEnv, _ctx: ExecutionContext): Promise<void> {
    logger.info('Scheduled recovery sweep triggered', {
      cron: event.cron,
      scheduledTime: event.scheduledTime,
    });
    // In Phase 2/3: executes bounded indexed sweep on outbox_jobs
  },
};
