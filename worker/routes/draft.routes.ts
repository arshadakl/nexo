import { Hono } from 'hono';
import type { Context } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import { draftRepository } from '../repositories/draftRepository';
import { resolveTenantId, resolveUserId, getMasterKey } from '../lib/authContext';
import { sendDraft, rejectDraft, type SendDraftOutcome } from '../services/draftLifecycle';
import { ApproveDraftSchema, ModifyDraftSchema, RejectDraftSchema } from '@shared/schemas/draft.schema';
import type { WorkerEnv } from '../env';

export const draftRoutes = new Hono<{ Bindings: WorkerEnv }>();

async function readJson(c: Context<{ Bindings: WorkerEnv }>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

function respondToSend(c: Context<{ Bindings: WorkerEnv }>, outcome: SendDraftOutcome) {
  switch (outcome.kind) {
    case 'sent':
      return jsonOk(c, outcome.draft);
    case 'not_found':
      return jsonError(c, 'NOT_FOUND', 'Draft not found', 404);
    case 'conflict':
      return jsonError(c, 'CONFLICT', `Draft is already in status '${outcome.status}'`, 409);
    case 'empty':
      return jsonError(c, 'VALIDATION_ERROR', 'This draft has no reply text. Edit it before sending.', 400);
    case 'stale':
      return jsonError(
        c,
        'STALE_DRAFT',
        'The customer sent new messages after this draft was written. Review them before sending.',
        409,
        { draft: outcome.draft, newInboundMessages: outcome.newInboundMessages }
      );
    case 'failed':
      return jsonError(c, 'SEND_FAILED', `The reply was not delivered: ${outcome.error}`, 502, { draft: outcome.draft });
  }
}

/**
 * GET /api/drafts/pending
 * Lists all drafts awaiting human review, being sent, or failed to send.
 */
draftRoutes.get('/pending', async (c) => {
  const tenantId = resolveTenantId(c);
  const drafts = await draftRepository.listPendingDrafts(c.env.DB, tenantId);
  return jsonOk(c, drafts);
});

/**
 * GET /api/drafts/conversation/:id
 * Retrieves the latest unresolved draft for a conversation, with messages that arrived after it.
 */
draftRoutes.get('/conversation/:id', async (c) => {
  const tenantId = resolveTenantId(c);
  const conversationId = c.req.param('id');

  const draft = await draftRepository.getPendingDraft(c.env.DB, tenantId, conversationId);
  return jsonOk(c, draft);
});

/**
 * POST /api/drafts/:id/approve
 * Approves a staged AI draft and dispatches it. The AI resumes only after delivery is confirmed.
 */
draftRoutes.post('/:id/approve', async (c) => {
  const body = ApproveDraftSchema.safeParse(await readJson(c));
  const outcome = await sendDraft(c.env, {
    tenantId: resolveTenantId(c),
    draftId: c.req.param('id'),
    userId: resolveUserId(c),
    masterKey: getMasterKey(c),
    acknowledgeNewMessages: body.success ? body.data.acknowledgeNewMessages : false,
    mode: 'approve',
  });
  return respondToSend(c, outcome);
});

/**
 * POST /api/drafts/:id/modify
 * Sends reviewer-edited text in place of the draft (also valid for a draft whose send failed).
 */
draftRoutes.post('/:id/modify', async (c) => {
  const body = ModifyDraftSchema.safeParse(await readJson(c));
  if (!body.success) {
    return jsonError(c, 'VALIDATION_ERROR', 'modifiedText is required', 400);
  }
  const tenantId = resolveTenantId(c);
  const draftId = c.req.param('id');
  const current = await draftRepository.getDraftById(c.env.DB, tenantId, draftId);
  const outcome = await sendDraft(c.env, {
    tenantId,
    draftId,
    userId: resolveUserId(c),
    masterKey: getMasterKey(c),
    modifiedText: body.data.modifiedText,
    acknowledgeNewMessages: body.data.acknowledgeNewMessages,
    mode: current?.status === 'send_failed' ? 'retry' : 'approve',
  });
  return respondToSend(c, outcome);
});

/**
 * POST /api/drafts/:id/retry
 * Retries dispatch of an approved reply whose send failed.
 */
draftRoutes.post('/:id/retry', async (c) => {
  const body = ApproveDraftSchema.safeParse(await readJson(c));
  const outcome = await sendDraft(c.env, {
    tenantId: resolveTenantId(c),
    draftId: c.req.param('id'),
    userId: resolveUserId(c),
    masterKey: getMasterKey(c),
    acknowledgeNewMessages: body.success ? body.data.acknowledgeNewMessages : false,
    mode: 'retry',
  });
  return respondToSend(c, outcome);
});

/**
 * POST /api/drafts/:id/reject
 * Rejects a draft without sending it. Body: { nextAction: 'take_over' | 'resume_ai' }.
 */
draftRoutes.post('/:id/reject', async (c) => {
  const body = RejectDraftSchema.safeParse(await readJson(c));
  const outcome = await rejectDraft(c.env, {
    tenantId: resolveTenantId(c),
    draftId: c.req.param('id'),
    userId: resolveUserId(c),
    nextAction: body.success ? body.data.nextAction : 'take_over',
  });
  if (outcome.kind === 'not_found') return jsonError(c, 'NOT_FOUND', 'Draft not found', 404);
  if (outcome.kind === 'conflict') {
    return jsonError(c, 'CONFLICT', `Draft is already in status '${outcome.status}'`, 409);
  }
  return jsonOk(c, outcome.draft);
});
