import { Hono } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import { leadRepository } from '../repositories/leadRepository';
import { UpdateLeadSchema, CreateLeadSchema, LeadPageQuerySchema, BulkLeadStatusSchema } from '@shared/schemas/lead.schema';
import { CreateNoteSchema } from '@shared/schemas/conversation.schema';
import type { WorkerEnv } from '../env';
import type { LeadStatus } from '@shared/types/crm.types';

import { resolveTenantId, resolveUserId } from '../lib/authContext';

export const leadRoutes = new Hono<{ Bindings: WorkerEnv }>();

/**
 * GET /api/leads
 * Lists leads with status, country, and score filters.
 * CPU: < 1.0 ms.
 */
leadRoutes.get('/', async (c) => {
  const tenantId = resolveTenantId(c);
  const status = c.req.query('status') as LeadStatus | undefined;
  const serviceVertical = c.req.query('vertical') as any;
  const search = c.req.query('search') || undefined;
  const sortByParam = c.req.query('sortBy');
  const sortBy = (sortByParam === 'status' ? 'status' : 'recent') as 'status' | 'recent' | undefined;

  const leads = await leadRepository.listLeads(c.env.DB, tenantId, {
    status,
    serviceVertical,
    search,
    sortBy,
  });

  return jsonOk(c, leads);
});

/**
 * GET /api/leads/search
 * Paged, sortable lead search for the Leads table: returns { items, total, page, pageSize }.
 */
leadRoutes.get('/search', async (c) => {
  const tenantId = resolveTenantId(c);
  const parsed = LeadPageQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return jsonError(c, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid query', 400);
  }
  const page = await leadRepository.listLeadsPage(c.env.DB, tenantId, parsed.data);
  return jsonOk(c, page);
});

/**
 * POST /api/leads/bulk-status
 * Moves selected leads to one stage. Body: { leadIds: string[], leadStatus }.
 */
leadRoutes.post('/bulk-status', async (c) => {
  const tenantId = resolveTenantId(c);
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }
  const parsed = BulkLeadStatusSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(c, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid payload', 400);
  }
  const updated = await leadRepository.bulkUpdateStatus(c.env.DB, tenantId, parsed.data.leadIds, parsed.data.leadStatus);
  return jsonOk(c, { updated });
});

/**
 * GET /api/leads/:id
 * Retrieves full lead profile with linked conversations.
 */
leadRoutes.get('/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const leadId = c.req.param('id');

  const lead = await leadRepository.getLeadById(c.env.DB, tenantId, leadId);
  if (!lead) {
    return jsonError(c, 'NOT_FOUND', 'Lead profile not found', 404);
  }

  return jsonOk(c, lead);
});

/**
 * PATCH /api/leads/:id
 * Updates lead qualification attributes, status, or owner.
 */
leadRoutes.patch('/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const leadId = c.req.param('id');

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parseResult = UpdateLeadSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return jsonError(c, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid payload', 400);
  }

  const updated = await leadRepository.updateLead(c.env.DB, tenantId, leadId, parseResult.data);
  if (!updated) {
    return jsonError(c, 'NOT_FOUND', 'Lead not found', 404);
  }

  return jsonOk(c, updated);
});

/**
 * POST /api/leads
 * Manually creates a new lead.
 */
leadRoutes.post('/', async (c) => {
  const tenantId = resolveTenantId(c);

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parseResult = CreateLeadSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return jsonError(c, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid payload', 400);
  }

  const lead = await leadRepository.createLead(c.env.DB, tenantId, parseResult.data);
  return jsonOk(c, lead, 201);
});

/**
 * GET /api/leads/:id/notes
 * Retrieves internal notes attached to lead.
 */
leadRoutes.get('/:id/notes', async (c) => {
  const tenantId = resolveTenantId(c);
  const leadId = c.req.param('id');

  const notes = await leadRepository.listNotes(c.env.DB, tenantId, leadId);
  return jsonOk(c, notes);
});

/**
 * POST /api/leads/:id/notes
 * Adds internal staff note to lead profile.
 */
leadRoutes.post('/:id/notes', async (c) => {
  const tenantId = resolveTenantId(c);
  const userId = resolveUserId(c);
  const leadId = c.req.param('id');

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parseResult = CreateNoteSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return jsonError(c, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid note', 400);
  }

  const note = await leadRepository.createNote(c.env.DB, {
    tenantId,
    leadId,
    authorId: userId,
    content: parseResult.data.content,
  });

  return jsonOk(c, note);
});
