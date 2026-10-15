import { Hono } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import type { WorkerEnv } from '../env';

export const healthRoutes = new Hono<{ Bindings: WorkerEnv }>();


// Liveness check (instant, 0 DB calls, < 0.2 ms CPU)
healthRoutes.get('/healthz', (c) => {
  return jsonOk(c, {
    status: 'healthy',
    timestamp: Date.now(),
  });
});

// Readiness check (validates D1 connection safely)
healthRoutes.get('/readyz', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT 1 as alive').first<{ alive: number }>();
    if (result?.alive === 1) {
      return jsonOk(c, {
        status: 'ready',
        database: 'connected',
        timestamp: Date.now(),
      });
    }
    return jsonError(c, 'DATABASE_NOT_READY', 'Database did not return expected check', 503);
  } catch (err) {
    return jsonError(c, 'DATABASE_UNAVAILABLE', 'Database check failed', 503);
  }
});
