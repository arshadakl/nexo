import { Hono } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import { expertRepository } from '../repositories/expertRepository';
import { leadRepository } from '../repositories/leadRepository';
import { CreateExpertSchema, UpdateExpertSchema, ExpertMatchCriteriaSchema } from '@shared/schemas/expert.schema';
import { resolveTenantId } from '../lib/authContext';
import type { WorkerEnv } from '../env';

export const expertRoutes = new Hono<{ Bindings: WorkerEnv }>();

/**
 * GET /api/experts
 * Lists verified business setup experts.
 */
expertRoutes.get('/', async (c) => {
  const tenantId = resolveTenantId(c);
  const sector = c.req.query('sector') || undefined;
  const language = c.req.query('language') || undefined;
  const emirate = c.req.query('emirate') || undefined;

  const experts = await expertRepository.listExperts(c.env.DB, tenantId, {
    sector,
    language,
    emirate,
  });

  return jsonOk(c, experts);
});

/**
 * GET /api/experts/:id
 * Retrieves expert profile.
 */
expertRoutes.get('/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const id = c.req.param('id');

  const expert = await expertRepository.getExpertById(c.env.DB, tenantId, id);
  if (!expert) {
    return jsonError(c, 'NOT_FOUND', 'Expert not found', 404);
  }

  return jsonOk(c, expert);
});

/**
 * POST /api/experts
 * Adds new verified business setup partner.
 */
expertRoutes.post('/', async (c) => {
  const tenantId = resolveTenantId(c);

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parsed = CreateExpertSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(c, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid payload', 400);
  }

  const created = await expertRepository.createExpert(c.env.DB, tenantId, parsed.data);
  return jsonOk(c, created, 201);
});

/**
 * PATCH /api/experts/:id
 * Updates expert profile or availability.
 */
expertRoutes.patch('/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const id = c.req.param('id');

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parsed = UpdateExpertSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(c, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid payload', 400);
  }

  const updated = await expertRepository.updateExpert(c.env.DB, tenantId, id, parsed.data);
  if (!updated) {
    return jsonError(c, 'NOT_FOUND', 'Expert not found', 404);
  }

  return jsonOk(c, updated);
});

/**
 * DELETE /api/experts/:id
 * Deletes an expert from directory.
 */
expertRoutes.delete('/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const id = c.req.param('id');

  const deleted = await expertRepository.deleteExpert(c.env.DB, tenantId, id);
  if (!deleted) {
    return jsonError(c, 'NOT_FOUND', 'Expert not found', 404);
  }

  return jsonOk(c, { deleted: true });
});

/**
 * POST /api/experts/match
 * Matches available verified experts based on sector, language, and emirate criteria.
 */
expertRoutes.post('/match', async (c) => {
  const tenantId = resolveTenantId(c);

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parsed = ExpertMatchCriteriaSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(c, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid payload', 400);
  }

  const matches = await expertRepository.matchExperts(c.env.DB, tenantId, parsed.data);
  return jsonOk(c, matches);
});

/**
 * POST /api/experts/assign
 * Links a verified expert to a lead, logs external sharing, and advances status to handed_over.
 */
expertRoutes.post('/assign', async (c) => {
  const tenantId = resolveTenantId(c);

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const leadId = rawBody.leadId;
  const expertId = rawBody.expertId;

  if (!leadId || !expertId) {
    return jsonError(c, 'VALIDATION_ERROR', 'leadId and expertId are required', 400);
  }

  const expert = await expertRepository.getExpertById(c.env.DB, tenantId, expertId);
  if (!expert) {
    return jsonError(c, 'NOT_FOUND', 'Expert not found', 404);
  }

  const updatedLead = await leadRepository.updateLead(c.env.DB, tenantId, leadId, {
    assignedExpertId: expertId,
    leadStatus: 'handed_over',
    statusReason: `Verified expert assigned: ${expert.fullName} (${expert.organizationName})`,
    nextAction: `Follow up on expert consultation with ${expert.fullName}`,
  });

  if (!updatedLead) {
    return jsonError(c, 'NOT_FOUND', 'Lead not found', 404);
  }

  return jsonOk(c, { lead: updatedLead, expert });
});
