export const queryKeys = {
  health: ['health'] as const,
  auth: {
    session: ['auth', 'session'] as const,
  },
  conversations: {
    all: ['conversations'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.conversations.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.conversations.all, 'detail', id] as const,
    messages: (id: string, cursor?: string) =>
      [...queryKeys.conversations.all, 'messages', id, cursor] as const,
  },
  leads: {
    all: ['leads'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.leads.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.leads.all, 'detail', id] as const,
  },
  aiProviders: {
    all: ['ai-providers'] as const,
    list: () => [...queryKeys.aiProviders.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.aiProviders.all, 'detail', id] as const,
    presets: ['ai-providers', 'presets'] as const,
  },
  integrations: {
    all: ['integrations'] as const,
    status: () => [...queryKeys.integrations.all, 'status'] as const,
  },
  analytics: {
    overview: (period: string) => ['analytics', 'overview', period] as const,
  },
  drafts: {
    all: ['drafts'] as const,
    pending: () => [...queryKeys.drafts.all, 'pending'] as const,
    conversation: (conversationId: string) =>
      [...queryKeys.drafts.all, 'conversation', conversationId] as const,
  },
  experts: {
    all: ['experts'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.experts.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.experts.all, 'detail', id] as const,
    match: (leadId: string) => [...queryKeys.experts.all, 'match', leadId] as const,
  },
  knowledge: {
    all: ['knowledge'] as const,
    list: () => [...queryKeys.knowledge.all, 'list'] as const,
    approved: () => [...queryKeys.knowledge.all, 'approved'] as const,
  },
};
