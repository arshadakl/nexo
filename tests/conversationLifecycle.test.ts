import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMigration, createTestD1 } from './helpers/testD1';
import { processQueueBatch } from '../worker/queue/consumer';
import { webhookRoutes } from '../worker/routes/webhook.routes';
import { draftRoutes } from '../worker/routes/draft.routes';
import { conversationRoutes } from '../worker/routes/conversation.routes';
import { leadRoutes } from '../worker/routes/lead.routes';
import { aiProviderRepository } from '../worker/repositories/aiProviderRepository';
import { connectionRepository } from '../worker/repositories/connectionRepository';
import { openAiCompatibleAdapter } from '../worker/adapters/ai/openAiCompatible';
import { instagramSendApiAdapter } from '../worker/adapters/meta/instagramSendApi';
import { getAutomationSnapshot, sweepUnprocessedConversations } from '../worker/services/conversationAutomation';
import { analyticsService } from '../worker/services/analyticsService';
import type { AIQualificationResult } from '../shared/types/ai.types';
import type { PromptMessage } from '../worker/adapters/ai/adapter.interface';

/**
 * Scenario tests for turn processing and the approval lifecycle. Routes, repositories and the queue
 * consumer run against an in-memory SQLite database with all migrations applied. Only the AI model,
 * the Meta Send API and the queue transport are replaced.
 */

const TENANT = 'tenant_visa_horizon_default';
const IG_ACCOUNT = '17841400000000';
const CUSTOMER = '990001';
const CONNECTION = 'conn_ig_test';

let env: any;
let sqlite: any;
let queued: any[];
let aiCalls: PromptMessage[][];
let aiScript: Array<Partial<AIQualificationResult> | ((messages: PromptMessage[]) => Promise<Partial<AIQualificationResult>>)>;
let sendMock: ReturnType<typeof vi.fn>;
let clock: number;

function aiResult(partial: Partial<AIQualificationResult>): AIQualificationResult {
  return {
    intent: 'general_enquiry',
    language: 'en',
    replyText: 'Hey! 👋 What can we help you with?',
    rationale: 'test',
    extractedFields: {},
    fieldConfidence: {},
    missingFields: [],
    leadStatus: 'exploring',
    statusReason: 'test',
    humanReviewRequired: false,
    safetyFlags: [],
    ...partial,
  } as AIQualificationResult;
}

beforeEach(() => {
  const t = createTestD1();
  sqlite = t.sqlite;
  const db = t.db;
  queued = [];
  aiCalls = [];
  aiScript = [];
  // Provider timestamps sit just before real time, as they do in production.
  clock = Date.now() - 5 * 60 * 1000;

  sqlite
    .prepare(
      `INSERT INTO integration_connections (id, tenant_id, provider, external_account_id, granted_scopes,
        encrypted_token, key_nonce, status, created_at, updated_at)
       VALUES (?, ?, 'instagram', ?, '[]', 'x', 'x', 'connected', 1, 1)`
    )
    .run(CONNECTION, TENANT, IG_ACCOUNT);
  sqlite
    .prepare(`INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES ('user_reviewer', 'r@test', 'Reviewer', 1, 1)`)
    .run();

  env = {
    DB: db,
    ENVIRONMENT: 'development',
    MESSAGING_QUEUE: { send: vi.fn(async (body: unknown) => void queued.push(body)) },
  };

  vi.spyOn(aiProviderRepository, 'getDefaultDecrypted').mockResolvedValue({
    id: 'ai_1',
    tenantId: TENANT,
    name: 'test',
    baseUrl: 'https://ai.invalid/v1',
    apiKey: 'k',
    defaultModel: 'm',
    temperature: 0,
    maxTokens: 600,
  });
  vi.spyOn(openAiCompatibleAdapter, 'generateQualification').mockImplementation(async (_cfg, messages) => {
    aiCalls.push(messages);
    const next = aiScript.shift();
    if (!next) throw new Error('Unexpected AI call');
    return aiResult(typeof next === 'function' ? await next(messages) : next);
  });
  vi.spyOn(connectionRepository, 'getByIdDecrypted').mockResolvedValue({
    id: CONNECTION,
    tenantId: TENANT,
    provider: 'instagram',
    externalAccountId: IG_ACCOUNT,
    accessToken: 'token',
    status: 'connected',
    grantedScopes: [],
    webhookSubscribed: true,
  });
  let sent = 0;
  sendMock = vi.fn(async (p: { recipientId: string }) => ({ messageId: `out_${++sent}`, recipientId: p.recipientId }));
  vi.spyOn(instagramSendApiAdapter, 'sendMessage').mockImplementation(sendMock as any);
});

afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

async function webhook(mid: string, text?: string, attachments?: { type: string }[]) {
  clock += 1000;
  const payload = {
    object: 'instagram',
    entry: [
      {
        id: IG_ACCOUNT,
        messaging: [
          {
            sender: { id: CUSTOMER },
            recipient: { id: IG_ACCOUNT },
            timestamp: clock,
            message: {
              mid,
              ...(text ? { text } : {}),
              ...(attachments ? { attachments: attachments.map((a) => ({ ...a, payload: { url: 'https://cdn.invalid/a' } })) } : {}),
            },
          },
        ],
      },
    ],
  };
  const res = await webhookRoutes.fetch(
    new Request('http://test/meta/instagram', { method: 'POST', body: JSON.stringify(payload) }),
    env
  );
  expect(res.status).toBe(200);
}

/** Delivers queued jobs to the consumer in order until the queue is empty. */
async function drain() {
  const outcomes: string[] = [];
  for (let i = 0; i < 20 && queued.length > 0; i++) {
    const body = queued.shift();
    let outcome = 'none';
    await processQueueBatch(
      { messages: [{ id: String(i), body, ack: () => (outcome = 'ack'), retry: () => (outcome = 'retry') }] } as any,
      env
    );
    outcomes.push(outcome);
  }
  return outcomes;
}

const conversationId = () =>
  (sqlite.prepare('SELECT id FROM conversations LIMIT 1').get() as { id: string }).id;
const outbound = () =>
  sqlite
    .prepare("SELECT * FROM messages WHERE direction = 'outbound' ORDER BY created_at, id")
    .all() as any[];
const inbound = () =>
  sqlite.prepare("SELECT * FROM messages WHERE direction = 'inbound' ORDER BY created_at, id").all() as any[];
const drafts = () => sqlite.prepare('SELECT * FROM message_drafts ORDER BY created_at').all() as any[];
const lead = () => sqlite.prepare('SELECT * FROM leads LIMIT 1').get() as any;
const state = async () => (await getAutomationSnapshot(env.DB, conversationId()))!.state;
const systemPrompt = (call: number) => aiCalls[call]![0]!.content;

async function post(routes: any, path: string, body?: unknown) {
  const res = await routes.fetch(
    new Request(`http://test${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': TENANT, 'X-User-Id': 'user_reviewer' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env
  );
  return { status: res.status, json: (await res.json()) as any };
}

const priceReview: Partial<AIQualificationResult> = {
  intent: 'residency',
  replyText: 'The team will confirm the exact cost for your free zone. Shall I share your enquiry with them?',
  leadStatus: 'exploring',
  humanReviewRequired: true,
  humanReviewReason: 'Price enquiry',
  reviewKind: 'business_confirmation',
  reviewerMustConfirm: 'Confirmed cost for a freelance residency permit',
  customerQuestion: 'How much does the residency package cost?',
};

async function startPendingApproval() {
  aiScript.push(priceReview);
  await webhook('m_price', 'How much does the residency package cost?');
  await drain();
  return drafts()[0];
}

// ---------------------------------------------------------------------------------------------
// C. Consecutive messages
// ---------------------------------------------------------------------------------------------

describe('C. consecutive messages form one turn', () => {
  it('reads both messages in one AI call and does not ask for the name again', async () => {
    await webhook('m1', 'What is the living cost in Dubai?');
    await webhook('m2', 'My name is Adinan.');
    aiScript.push({
      replyText:
        "Thanks, Adinan. I don't have a verified living-cost estimate to share. For your business enquiry, what activity are you planning?",
      extractedFields: { fullName: 'Adinan' },
      fieldConfidence: { fullName: 0.95 },
    });

    await drain();

    expect(aiCalls).toHaveLength(1);
    const turn = systemPrompt(0);
    expect(turn).toContain('What is the living cost in Dubai?');
    expect(turn).toContain('My name is Adinan.');
    const userHistory = aiCalls[0]!.filter((m) => m.role === 'user').map((m) => m.content);
    expect(userHistory).toEqual(['What is the living cost in Dubai?', 'My name is Adinan.']);

    expect(outbound()).toHaveLength(1);
    expect(outbound()[0].delivery_status).toBe('delivered');
    expect(outbound()[0].created_at).toBeGreaterThan(inbound()[1].created_at);
    expect(inbound().every((m) => m.ai_processed_at !== null)).toBe(true);
    expect(lead().full_name).toBe('Adinan');
  });

  it('regenerates instead of sending when a new message arrives during generation', async () => {
    await webhook('m1', 'What is the living cost in Dubai?');
    aiScript.push(async () => {
      await webhook('m2', 'My name is Adinan.'); // arrives while the model is still answering m1
      return { replyText: 'What is your name?' };
    });
    aiScript.push({ replyText: "Thanks, Adinan. I don't have a verified living-cost estimate to share." });

    await drain();

    expect(aiCalls).toHaveLength(2);
    expect(systemPrompt(1)).toContain('My name is Adinan.');
    expect(outbound().map((m) => m.message_text)).toEqual([
      "Thanks, Adinan. I don't have a verified living-cost estimate to share.",
    ]);
  });

  it('retries later instead of processing in parallel when another worker holds the conversation', async () => {
    await webhook('m1', 'Hi');
    sqlite
      .prepare('UPDATE conversations SET lease_owner = ?, lease_expires_at = ?')
      .run('other-worker', Date.now() + 60_000);
    const outcomes = await drain();
    expect(outcomes).toEqual(['retry']);
    expect(aiCalls).toHaveLength(0);
    expect(inbound()[0].ai_processed_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// D. Location extraction through the pipeline
// ---------------------------------------------------------------------------------------------

describe('D. location fields are stored separately', () => {
  it('Indian, currently in Brazil, planning Dubai next month', async () => {
    await webhook('m1', 'I am Indian, currently in Brazil, and planning to start in Dubai next month.');
    aiScript.push({
      extractedFields: { nationality: 'Indian', currentCountry: 'Brazil', targetEmirate: 'Dubai', timeline: 'next month' },
      fieldConfidence: { nationality: 0.95, currentCountry: 0.95, targetEmirate: 0.9, timeline: 0.9 },
      replyText: 'Great! Are you looking for help setting up the company, residency for yourself, or both?',
    });
    await drain();

    const l = lead();
    expect(l.nationality).toBe('Indian');
    expect(l.current_country).toBe('Brazil');
    expect(l.target_emirate).toBe('Dubai');
    expect(l.timeline).toBe('next month');
    expect(l.timeline_stated_at).toBe(inbound()[0].created_at);
    expect(l.uae_location_context).toBe('outside_uae');
  });
});

// ---------------------------------------------------------------------------------------------
// F. Voice notes
// ---------------------------------------------------------------------------------------------

describe('F. unsupported voice notes', () => {
  it('sends one text-request fallback without calling the model, even on redelivery', async () => {
    await webhook('v1', undefined, [{ type: 'audio' }]);
    await webhook('v1', undefined, [{ type: 'audio' }]); // Meta redelivery
    await drain();

    expect(aiCalls).toHaveLength(0);
    expect(inbound()).toHaveLength(1);
    expect(inbound()[0].message_type).toBe('audio');
    expect(outbound().map((m) => m.message_text)).toEqual([
      'I can’t listen to voice notes here yet. Could you send that as text so I can help?',
    ]);

    await webhook('v2', undefined, [{ type: 'audio' }]);
    await drain();
    expect(outbound()).toHaveLength(1); // not repeated while still waiting for text
  });

  it('replies in Malayalam when the customer writes Malayalam', async () => {
    aiScript.push({ replyText: 'ഹായ് 👋 എന്താണ് അറിയേണ്ടത്?', language: 'ml' });
    await webhook('t1', 'ഹായ്');
    await drain();
    await webhook('v1', undefined, [{ type: 'audio' }]);
    await drain();
    expect(outbound().at(-1).message_text).toBe('ഇവിടെ voice note കേൾക്കാൻ ഇപ്പോൾ പറ്റുന്നില്ല. ഒന്ന് text ആയി അയക്കാമോ?');
  });

  it('answers text in the same turn and flags the unreadable audio to the model', async () => {
    await webhook('v1', undefined, [{ type: 'audio' }]);
    await webhook('t1', 'I want residency for myself');
    aiScript.push({ replyText: 'Got it! Could you type what your voice note said?' });
    await drain();

    expect(aiCalls).toHaveLength(1);
    expect(systemPrompt(0)).toContain('"unreadableVoiceNoteOrAttachment": true');
    expect(aiCalls[0]!.some((m) => m.content.includes('voice note. It cannot be listened to'))).toBe(true);
    expect(outbound()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------
// G. Approval recovery
// ---------------------------------------------------------------------------------------------

describe('G. approval recovery', () => {
  it('price question -> approval pending -> approved and sent -> AI resumes for the next enquiry', async () => {
    const draft = await startPendingApproval();
    expect(draft.status).toBe('pending_review');
    expect(draft.review_kind).toBe('business_confirmation');
    expect(draft.review_reason).toBe('Confirmed cost for a freelance residency permit');
    expect(outbound()).toHaveLength(0);
    expect(await state()).toBe('approval_pending');
    // Approval pending is not a human takeover.
    expect((sqlite.prepare('SELECT human_takeover FROM conversations').get() as any).human_takeover).toBe(0);

    const approved = await post(draftRoutes, `/${draft.id}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.json.data.status).toBe('approved_sent');
    expect(outbound()).toHaveLength(1);
    expect(outbound()[0].delivery_status).toBe('delivered');
    expect(await state()).toBe('ai_active');
    // Nothing was waiting, so approval alone does not trigger another reply.
    expect(queued).toHaveLength(0);

    aiScript.push({ replyText: 'Nice! What kind of work do you do?' });
    await webhook('m_next', 'Thanks. I am a software developer.');
    await drain();
    expect(aiCalls).toHaveLength(2);
    expect(outbound().map((m) => m.message_text).at(-1)).toBe('Nice! What kind of work do you do?');
  });

  it('a reviewer-confirmed figure may be repeated for this customer, unapproved figures may not', async () => {
    const draft = await startPendingApproval();
    await post(draftRoutes, `/${draft.id}/modify`, { modifiedText: 'For your activity the confirmed cost is AED 15000.' });

    aiScript.push({ replyText: 'As confirmed, the cost is AED 15000. When would you like to start?' });
    await webhook('m2', 'Can you remind me of the cost?');
    await drain();
    expect(outbound().at(-1).message_text).toContain('AED 15000');

    aiScript.push({ replyText: 'Renewal is AED 9000.' });
    await webhook('m3', 'And renewal?');
    await drain();
    expect(outbound().at(-1).message_text).not.toContain('AED 9000');
    expect(drafts().at(-1).status).toBe('pending_review');
    expect(drafts().at(-1).review_kind).toBe('policy_block');
  });
});

// ---------------------------------------------------------------------------------------------
// H. Send failure
// ---------------------------------------------------------------------------------------------

describe('H. approved send fails', () => {
  it('shows the failure, never marks it sent, and recovers on retry', async () => {
    const draft = await startPendingApproval();
    sendMock.mockRejectedValueOnce(new Error('Instagram Send API error (500)'));

    const failed = await post(draftRoutes, `/${draft.id}/approve`);
    expect(failed.status).toBe(502);
    expect(failed.json.error.code).toBe('SEND_FAILED');
    expect(drafts()[0].status).toBe('send_failed');
    expect(drafts()[0].last_error).toContain('500');
    expect(outbound()).toHaveLength(1);
    expect(outbound()[0].delivery_status).toBe('failed');
    expect(await state()).toBe('send_failed');

    // While the failure is unresolved the AI stays paused; the message is kept for later.
    await webhook('m_wait', 'Hello?');
    await drain();
    expect(aiCalls).toHaveLength(1);

    const queue = await analyticsService.getActionQueue(env.DB, TENANT);
    expect(queue[0]).toMatchObject({ kind: 'send_failed', conversationId: conversationId() });

    const retried = await post(draftRoutes, `/${draft.id}/retry`, { acknowledgeNewMessages: true });
    expect(retried.status).toBe(200);
    expect(drafts()[0].status).toBe('approved_sent');
    expect(outbound()).toHaveLength(1); // same message row, now delivered
    expect(outbound()[0].delivery_status).toBe('delivered');

    aiScript.push({ replyText: 'Hi again! Anything else you would like to know?' });
    await drain(); // follow-up job processes the waiting "Hello?" once
    expect(aiCalls).toHaveLength(2);
    expect(outbound()).toHaveLength(2);
  });

  it('treats a missing channel connection as a failure, not a send', async () => {
    const draft = await startPendingApproval();
    vi.mocked(connectionRepository.getByIdDecrypted).mockResolvedValueOnce(null);
    const res = await post(draftRoutes, `/${draft.id}/approve`);
    expect(res.status).toBe(502);
    expect(outbound()[0].delivery_status).toBe('failed');
  });
});

// ---------------------------------------------------------------------------------------------
// I. Human takeover
// ---------------------------------------------------------------------------------------------

describe('I. human takeover', () => {
  it('stays paused until explicitly resumed, then answers waiting messages once', async () => {
    aiScript.push({ replyText: 'Hey! 👋 What can we help you with?' });
    await webhook('m1', 'hi');
    await drain();

    const id = conversationId();
    expect((await post(conversationRoutes, `/${id}/takeover`, { takeover: true })).status).toBe(200);
    await webhook('m2', 'Can someone call me?');
    await webhook('m3', 'Still there?');
    await drain();
    expect(aiCalls).toHaveLength(1);
    expect(await state()).toBe('human_takeover');

    aiScript.push({ replyText: 'Sure, what number can the team reach you on, including country code?' });
    const resumed = await post(conversationRoutes, `/${id}/resume`, {});
    expect(resumed.status).toBe(200);
    await drain();
    expect(aiCalls).toHaveLength(2);
    expect(outbound()).toHaveLength(2);
  });

  it('Resume AI refuses while an approval is unresolved unless the draft is explicitly discarded', async () => {
    const draft = await startPendingApproval();
    const id = conversationId();
    const blocked = await post(conversationRoutes, `/${id}/resume`, {});
    expect(blocked.status).toBe(409);
    expect(blocked.json.error.code).toBe('PENDING_APPROVALS');

    const resumed = await post(conversationRoutes, `/${id}/resume`, { discardPendingDrafts: true });
    expect(resumed.status).toBe(200);
    expect(drafts().find((d) => d.id === draft.id).status).toBe('superseded');
    expect(outbound()).toHaveLength(0); // discarded draft was never sent
    expect(await state()).toBe('ai_active');
  });

  it('rejecting a draft sends nothing and applies the chosen next action', async () => {
    const draft = await startPendingApproval();
    const rejected = await post(draftRoutes, `/${draft.id}/reject`, { nextAction: 'take_over' });
    expect(rejected.status).toBe(200);
    expect(sendMock).not.toHaveBeenCalled();
    expect(await state()).toBe('human_takeover');
  });
});

// ---------------------------------------------------------------------------------------------
// J. Duplicate webhook / approval events
// ---------------------------------------------------------------------------------------------

describe('J. duplicate events', () => {
  it('a redelivered webhook creates one message, one job and one reply', async () => {
    aiScript.push({ replyText: 'Hey! 👋 What can we help you with?' });
    await webhook('m1', 'hi');
    await webhook('m1', 'hi');
    expect(queued).toHaveLength(1);
    await drain();
    expect(inbound()).toHaveLength(1);
    expect(outbound()).toHaveLength(1);
  });

  it('duplicate and concurrent approvals dispatch once', async () => {
    const draft = await startPendingApproval();
    const [a, b] = await Promise.all([
      post(draftRoutes, `/${draft.id}/approve`),
      post(draftRoutes, `/${draft.id}/approve`),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await post(draftRoutes, `/${draft.id}/approve`)).status).toBe(409);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(outbound()).toHaveLength(1);
  });

  it('ignores echoes of our own outgoing messages', async () => {
    const payload = {
      object: 'instagram',
      entry: [{ id: IG_ACCOUNT, messaging: [{ sender: { id: IG_ACCOUNT }, recipient: { id: CUSTOMER }, timestamp: 1, message: { mid: 'e1', text: 'echo', is_echo: true } }] }],
    };
    await webhookRoutes.fetch(new Request('http://test/meta/instagram', { method: 'POST', body: JSON.stringify(payload) }), env);
    expect(queued).toHaveLength(0);
    expect(inbound()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// K. New message during approval
// ---------------------------------------------------------------------------------------------

describe('K. new message while approval is pending', () => {
  it('surfaces the message to the reviewer and blocks blindly sending the stale draft', async () => {
    const draft = await startPendingApproval();
    await webhook('m_new', 'Actually, is it different for Sharjah?');
    await drain();
    expect(aiCalls).toHaveLength(1); // no AI reply while pending
    expect(inbound().at(-1).ai_processed_at).toBeNull(); // preserved for after resolution

    const res = await draftRoutes.fetch(
      new Request(`http://test/conversation/${conversationId()}`, { headers: { 'X-Tenant-Id': TENANT } }),
      env
    );
    const pending = ((await res.json()) as any).data;
    expect(pending.newInboundMessages.map((m: any) => m.messageText)).toEqual(['Actually, is it different for Sharjah?']);

    const stale = await post(draftRoutes, `/${draft.id}/approve`);
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe('STALE_DRAFT');
    expect(sendMock).not.toHaveBeenCalled();

    const sent = await post(draftRoutes, `/${draft.id}/modify`, {
      modifiedText: 'The team will confirm costs for Dubai and Sharjah. Which do you prefer?',
      acknowledgeNewMessages: true,
    });
    expect(sent.status).toBe(200);
    expect(sent.json.data.status).toBe('modified_sent');

    aiScript.push({ replyText: null });
    await drain(); // the waiting message is processed once with the reviewer's reply in history
    expect(aiCalls).toHaveLength(2);
    expect(aiCalls[1]!.at(-1)!.content).toContain('Dubai and Sharjah');
    expect(outbound()).toHaveLength(1); // model had nothing to add
  });
});

// ---------------------------------------------------------------------------------------------
// L. Manual corrections
// ---------------------------------------------------------------------------------------------

describe('L. dashboard corrections are preserved', () => {
  it('keeps confirmed fields when the AI later extracts a different value', async () => {
    aiScript.push({ extractedFields: { nationality: 'Pakistani' }, fieldConfidence: { nationality: 0.9 } });
    await webhook('m1', 'Hi, I am from Pakistan');
    await drain();
    const leadId = lead().id;

    const patched = await leadRoutes.fetch(
      new Request(`http://test/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': TENANT },
        body: JSON.stringify({ nationality: 'Indian', currentCountry: 'Pakistan' }),
      }),
      env
    );
    expect(patched.status).toBe(200);
    expect(JSON.parse(lead().confirmed_fields_json)).toEqual(expect.arrayContaining(['nationality', 'currentCountry']));

    aiScript.push({ extractedFields: { nationality: 'Pakistani', profession: 'Designer' }, fieldConfidence: { nationality: 0.95 } });
    await webhook('m2', 'I work as a designer');
    await drain();

    expect(lead().nationality).toBe('Indian');
    expect(lead().profession).toBe('Designer');
    const suggestions = JSON.parse(lead().ai_suggestions_json);
    expect(suggestions).toContainEqual(expect.objectContaining({ field: 'nationality', value: 'Pakistani', keptValue: 'Indian' }));
  });
});

// ---------------------------------------------------------------------------------------------
// Migration and recovery
// ---------------------------------------------------------------------------------------------

describe('recovery', () => {
  it('the cron sweep re-enqueues an active conversation whose messages were never processed', async () => {
    await webhook('m1', 'hi');
    queued.length = 0; // simulate the job exhausting its retries
    const n = await sweepUnprocessedConversations(env, clock + 10 * 60 * 1000);
    expect(n).toBe(1);
    expect(queued[0]).toMatchObject({ kind: 'process_conversation', conversationId: conversationId() });
  });

  it('migration 0009 releases pauses set by the old AI pipeline but keeps staff takeovers', () => {
    const { sqlite: old } = createTestD1({ before: '0009' });
    old.prepare(`INSERT INTO integration_connections (id, tenant_id, provider, external_account_id, granted_scopes,
      encrypted_token, key_nonce, status, created_at, updated_at) VALUES ('c1', ?, 'instagram', 'x', '[]', 'x', 'x', 'connected', 1, 1)`).run(TENANT);
    old.prepare(`INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES ('u1', 'a@b.c', 'A', 1, 1)`).run();
    const insert = old.prepare(`INSERT INTO conversations (id, tenant_id, connection_id, channel, provider_convo_id, customer_id,
      human_takeover, takeover_user_id, takeover_at, last_message_at, created_at, updated_at)
      VALUES (?, ?, 'c1', 'instagram', ?, 'cust', 1, ?, 5, 1, 1, 1)`);
    insert.run('stuck_by_ai', TENANT, 'p1', null);
    insert.run('staff_takeover', TENANT, 'p2', 'u1');
    old.prepare(`INSERT INTO message_drafts (id, tenant_id, conversation_id, suggested_text, status, created_at)
      VALUES ('d1', ?, 'stuck_by_ai', 'Price reply', 'approved_sent', 1)`).run(TENANT);

    applyMigration(old, '0009_conversation_lifecycle.sql');

    const rows = old.prepare('SELECT id, human_takeover FROM conversations ORDER BY id').all() as any[];
    expect(rows).toEqual([
      { id: 'staff_takeover', human_takeover: 1 },
      { id: 'stuck_by_ai', human_takeover: 0 },
    ]);
    expect((old.prepare("SELECT status FROM message_drafts WHERE id = 'd1'").get() as any).status).toBe('approved_sent');
  });
});
