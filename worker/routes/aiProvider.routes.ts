import { Hono } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import { aiProviderRepository } from '../repositories/aiProviderRepository';
import { aiHealthCheckService, AI_PROVIDER_PRESETS } from '../services/aiHealthCheckService';
import { CreateAIProviderSchema } from '@shared/schemas/ai.schema';
import type { WorkerEnv } from '../env';

import { resolveTenantId, getMasterKey } from '../lib/authContext';

export const aiProviderRoutes = new Hono<{ Bindings: WorkerEnv }>();

/**
 * GET /api/ai/presets
 * Returns quick-select presets (Groq, OpenRouter, OpenAI, DeepSeek, Together, Custom).
 * Highly cachable: Cache-Control: max-age=600.
 */
aiProviderRoutes.get('/presets', (c) => {
  c.header('Cache-Control', 'public, max-age=600');
  return jsonOk(c, AI_PROVIDER_PRESETS);
});

/**
 * GET /api/ai/providers
 * Lists all configured AI providers for the authenticated tenant with masked keys.
 */
aiProviderRoutes.get('/providers', async (c) => {
  const tenantId = resolveTenantId(c);
  const providers = await aiProviderRepository.listByTenant(c.env.DB, tenantId);
  return jsonOk(c, providers);
});

/**
 * POST /api/ai/providers
 * Configures and securely stores a new OpenAI-compatible AI provider.
 */
aiProviderRoutes.post('/providers', async (c) => {
  const tenantId = resolveTenantId(c);
  const body = await c.req.json().catch(() => null);

  const validated = CreateAIProviderSchema.parse(body);
  const masterKey = getMasterKey(c);

  const created = await aiProviderRepository.create(
    c.env.DB,
    tenantId,
    {
      name: validated.name,
      baseUrl: validated.baseUrl,
      apiKey: validated.apiKey,
      defaultModel: validated.defaultModel,
      temperature: validated.temperature,
      maxTokens: validated.maxTokens,
      isActive: validated.isActive,
      isDefault: validated.isDefault,
      ...(validated.customHeaders ? { customHeaders: validated.customHeaders } : {}),
    },
    masterKey
  );

  return jsonOk(c, created, 201);
});

/**
 * POST /api/ai/providers/:id/test
 * Executes a real-time verification ping against the provider endpoint,
 * measuring latency in ms and validating JSON schema parsing.
 */
aiProviderRoutes.post('/providers/:id/test', async (c) => {
  const tenantId = resolveTenantId(c);
  const providerId = c.req.param('id');
  const masterKey = getMasterKey(c);

  const testResult = await aiHealthCheckService.testProvider(
    c.env.DB,
    tenantId,
    providerId,
    masterKey
  );

  if (!testResult.success) {
    return jsonOk(c, testResult, 200); // 200 with success: false so frontend can display error details nicely
  }

  return jsonOk(c, testResult);
});

/**
 * POST /api/ai/providers/:id/set-default
 * Sets the specified provider as the single active default for automated DM replies.
 */
aiProviderRoutes.post('/providers/:id/set-default', async (c) => {
  const tenantId = resolveTenantId(c);
  const providerId = c.req.param('id');

  const updated = await aiProviderRepository.setDefault(c.env.DB, tenantId, providerId);
  if (!updated) {
    return jsonError(c, 'UPDATE_FAILED', 'Could not set provider as default', 400);
  }

  return jsonOk(c, { success: true, isDefault: true });
});

/**
 * DELETE /api/ai/providers/:id
 * Removes an AI provider configuration.
 */
aiProviderRoutes.delete('/providers/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const providerId = c.req.param('id');

  const deleted = await aiProviderRepository.delete(c.env.DB, tenantId, providerId);
  if (!deleted) {
    return jsonError(c, 'NOT_FOUND', 'Provider not found or already deleted', 404);
  }

  return jsonOk(c, { success: true, deletedId: providerId });
});
