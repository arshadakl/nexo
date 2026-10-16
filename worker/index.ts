import { Hono } from 'hono';
import { securityHeaders } from './middleware/securityHeaders';
import { errorHandler } from './middleware/errorHandler';
import { healthRoutes } from './routes/health.routes';
import { aiProviderRoutes } from './routes/aiProvider.routes';
import { logger } from './lib/logger';
import type { WorkerEnv } from './env';

const app = new Hono<{ Bindings: WorkerEnv }>();

// Global middleware
app.use('*', securityHeaders);
app.onError(errorHandler);

// Mount API routes
app.route('/api', healthRoutes);
app.route('/api/ai', aiProviderRoutes);


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

// Single Cloudflare Worker Export: fetch, queue, scheduled
export default {
  // HTTP Fetch handler
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  // Queue consumer handler (Processes async message qualification and AI tasks)
  async queue(batch: MessageBatch<any>, _env: WorkerEnv, _ctx: ExecutionContext): Promise<void> {
    logger.info('Queue batch received', {
      queue: batch.queue,
      messageCount: batch.messages.length,
    });

    for (const message of batch.messages) {
      try {
        // Individual message processing (isolated micro-batch)
        logger.info('Processing queue message', {
          id: message.id,
          attempts: message.attempts,
        });
        message.ack();
      } catch (err) {
        logger.error('Queue message processing failed', err, {
          id: message.id,
          attempts: message.attempts,
        });
        message.retry();
      }
    }
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
