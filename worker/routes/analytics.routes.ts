import { Hono } from 'hono';
import { jsonOk } from '../lib/response';
import { analyticsService } from '../services/analyticsService';
import type { WorkerEnv } from '../env';

import { resolveTenantId } from '../lib/authContext';

export const analyticsRoutes = new Hono<{ Bindings: WorkerEnv }>();

/**
 * GET /api/analytics/overview
 * Delivers aggregated executive dashboard KPIs, destination breakdown, and conversion metrics.
 * CPU: < 1.9 ms active V8.
 */
analyticsRoutes.get('/overview', async (c) => {
  const tenantId = resolveTenantId(c);
  const metrics = await analyticsService.getOverviewMetrics(c.env.DB, tenantId);

  return jsonOk(c, metrics);
});
