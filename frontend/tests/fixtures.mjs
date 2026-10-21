/** In-memory test transport. Never calls Meta, D1, or any external service. */
export function createWorkspaceFixture() {
  const now = Date.now();
  const conversations = [
    {
      id: 'a',
      channel: 'whatsapp',
      customerName: 'Amina Rahman',
      customerId: 'customer-a',
      customerHandle: null,
      unreadCount: 2,
      humanTakeover: false,
      aiMode: 'INHERIT',
      status: 'open',
      lastMessageText: 'Can you explain the residency stages?',
      lastMessageAt: now - 120000,
      connectionId: 'connection-a',
      lead: null,
      createdAt: now - 86400000,
      updatedAt: now,
    },
    {
      id: 'b',
      channel: 'instagram',
      customerName: 'Omar Hassan',
      customerId: 'customer-b',
      customerHandle: '@omar.test',
      unreadCount: 0,
      humanTakeover: true,
      aiMode: 'OFF',
      status: 'open',
      lastMessageText: 'I would like to speak to your team.',
      lastMessageAt: now - 3600000,
      connectionId: 'connection-b',
      lead: null,
      createdAt: now - 86400000,
      updatedAt: now,
    },
  ];
  const messages = {
    a: [
      {
        id: 'message-a',
        tenantId: 'fixture',
        conversationId: 'a',
        direction: 'inbound',
        senderType: 'applicant',
        messageText: 'Can you explain the residency stages?',
        messageType: 'text',
        deliveryStatus: 'delivered',
        createdAt: now - 120000,
      },
    ],
    b: [
      {
        id: 'message-b',
        tenantId: 'fixture',
        conversationId: 'b',
        direction: 'inbound',
        senderType: 'applicant',
        messageText: 'I would like to speak to your team. مرحباً',
        messageType: 'text',
        deliveryStatus: 'delivered',
        createdAt: now - 3600000,
      },
    ],
  };
  const drafts = {
    a: {
      id: 'draft-a',
      tenantId: 'fixture',
      conversationId: 'a',
      suggestedText:
        'Our residency service includes six stages. Would you like permit and residency, or residency only?',
      rationale: 'Answer the customer before asking one follow-up question.',
      status: 'pending_review',
      createdAt: now - 60000,
    },
    b: null,
  };
  const requests = [];
  const state = { sendStatus: 'delivered', failSend: false, failList: false, beforeSend: null };
  const ok = (data) =>
    new Response(JSON.stringify({ success: true, data }), {
      headers: { 'Content-Type': 'application/json' },
    });
  const error = (status, message) =>
    new Response(
      JSON.stringify({
        success: false,
        error: { code: status === 409 ? 'CONFLICT' : 'FIXTURE_ERROR', message },
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  const append = (id, text, senderType = 'staff') => {
    const message = {
      id: `sent-${crypto.randomUUID()}`,
      tenantId: 'fixture',
      conversationId: id,
      direction: 'outbound',
      senderType,
      messageText: text,
      messageType: 'text',
      deliveryStatus: state.sendStatus,
      errorMessage: state.sendStatus === 'failed' ? 'Channel connection unavailable.' : null,
      createdAt: Date.now(),
    };
    messages[id].push(message);
    return message;
  };
  const fetcher = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, 'http://localhost');
    const method = options.method || 'GET';
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
    requests.push({ path: url.pathname, search: url.search, method, body });
    if (url.pathname === '/api/auth/me')
      return ok({
        user: {
          id: 'fixture-user',
          tenantId: 'fixture',
          name: 'Preview operator',
          email: 'operator@example.test',
          role: 'admin',
        },
      });
    if (url.pathname === '/api/auth/logout') return ok({ success: true });
    if (url.pathname === '/api/conversations') {
      if (state.failList) return error(503, 'Fixture service unavailable.');
      const q = (url.searchParams.get('search') || '').toLowerCase();
      return ok(
        conversations.filter(
          (conversation) =>
            (!url.searchParams.has('channel') ||
              conversation.channel === url.searchParams.get('channel')) &&
            (!url.searchParams.has('takeover') || conversation.humanTakeover) &&
            (!q ||
              `${conversation.customerName} ${conversation.lastMessageText}`
                .toLowerCase()
                .includes(q)),
        ),
      );
    }
    const thread = url.pathname.match(/^\/api\/conversations\/([^/]+)(?:\/(messages|takeover))?$/);
    if (thread) {
      const [, id, action] = thread;
      const conversation = conversations.find((item) => item.id === id);
      if (!conversation) return error(404, 'Conversation not found');
      if (!action) {
        conversation.unreadCount = 0;
        return ok(conversation);
      }
      if (action === 'takeover') {
        conversation.humanTakeover = body.takeover;
        return ok({ success: true, humanTakeover: body.takeover });
      }
      if (method === 'GET') return ok(messages[id]);
      if (method === 'DELETE') {
        messages[id] = [];
        drafts[id] = null;
        return ok({ success: true });
      }
      if (state.beforeSend) await state.beforeSend();
      if (state.failSend || body.messageText?.includes('[network]'))
        return error(503, 'Simulated request failure');
      if (body.messageText?.includes('[fail]')) state.sendStatus = 'failed';
      return ok(append(id, body.messageText));
    }
    const draftRead = url.pathname.match(/^\/api\/drafts\/conversation\/([^/]+)$/);
    if (draftRead) return ok(drafts[draftRead[1]] || null);
    const review = url.pathname.match(/^\/api\/drafts\/([^/]+)\/(approve|modify|reject)$/);
    if (review) {
      const [, draftId, action] = review;
      const id = Object.keys(drafts).find((id) => drafts[id]?.id === draftId);
      if (!id || drafts[id].status !== 'pending_review')
        return error(409, 'Draft already reviewed');
      if (state.beforeSend && action !== 'reject') await state.beforeSend();
      const draft = drafts[id];
      if (action !== 'reject')
        append(id, body.modifiedText || draft.suggestedText, action === 'approve' ? 'ai' : 'staff');
      draft.status =
        action === 'reject' ? 'rejected' : action === 'modify' ? 'modified_sent' : 'approved_sent';
      const result = { ...draft };
      drafts[id] = null;
      return ok(result);
    }
    if (
      url.pathname === '/api/leads' ||
      url.pathname === '/api/experts' ||
      url.pathname === '/api/integrations'
    )
      return ok([]);
    return error(404, 'Unsupported fixture endpoint');
  };
  return { fetcher, requests, state, conversations, drafts, messages };
}
