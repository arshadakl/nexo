import { Hono } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import { knowledgeRepository } from '../repositories/knowledgeRepository';
import { CreateKnowledgeItemSchema, UpdateKnowledgeItemSchema } from '@shared/schemas/knowledge.schema';
import { resolveTenantId } from '../lib/authContext';
import type { WorkerEnv } from '../env';

export const knowledgeRoutes = new Hono<{ Bindings: WorkerEnv }>();

/**
 * GET /api/knowledge
 * Lists all business knowledge items with approval status flags.
 */
knowledgeRoutes.get('/', async (c) => {
  const tenantId = resolveTenantId(c);
  const items = await knowledgeRepository.listAllKnowledge(c.env.DB, tenantId);
  return jsonOk(c, items);
});

/**
 * GET /api/knowledge/approved
 * Lists only approved business knowledge items (the active prompt source).
 */
knowledgeRoutes.get('/approved', async (c) => {
  const tenantId = resolveTenantId(c);
  const items = await knowledgeRepository.listApprovedKnowledge(c.env.DB, tenantId);
  return jsonOk(c, items);
});

/**
 * POST /api/knowledge
 * Adds new knowledge base item.
 */
knowledgeRoutes.post('/', async (c) => {
  const tenantId = resolveTenantId(c);

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parsed = CreateKnowledgeItemSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(c, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid payload', 400);
  }

  const created = await knowledgeRepository.createKnowledgeItem(c.env.DB, tenantId, parsed.data);
  return jsonOk(c, created, 201);
});

/**
 * PATCH /api/knowledge/:id
 * Updates knowledge item details.
 */
knowledgeRoutes.patch('/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const id = c.req.param('id');

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parsed = UpdateKnowledgeItemSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(c, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid payload', 400);
  }

  const updated = await knowledgeRepository.updateKnowledgeItem(c.env.DB, tenantId, id, parsed.data);
  if (!updated) {
    return jsonError(c, 'NOT_FOUND', 'Knowledge item not found', 404);
  }

  return jsonOk(c, updated);
});

/**
 * PATCH /api/knowledge/:id/approval
 * Sets client approval status (e.g. unlocks pricing for AI quotation).
 */
knowledgeRoutes.patch('/:id/approval', async (c) => {
  const tenantId = resolveTenantId(c);
  const id = c.req.param('id');

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  if (typeof rawBody.isApproved !== 'boolean') {
    return jsonError(c, 'VALIDATION_ERROR', 'isApproved (boolean) is required', 400);
  }

  const updated = await knowledgeRepository.setApprovalStatus(
    c.env.DB,
    tenantId,
    id,
    rawBody.isApproved,
    rawBody.notes
  );

  if (!updated) {
    return jsonError(c, 'NOT_FOUND', 'Knowledge item not found', 404);
  }

  return jsonOk(c, updated);
});

/**
 * DELETE /api/knowledge/:id
 * Deletes knowledge item.
 */
knowledgeRoutes.delete('/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const id = c.req.param('id');

  const deleted = await knowledgeRepository.deleteKnowledgeItem(c.env.DB, tenantId, id);
  if (!deleted) {
    return jsonError(c, 'NOT_FOUND', 'Knowledge item not found', 404);
  }

  return jsonOk(c, { deleted: true });
});
