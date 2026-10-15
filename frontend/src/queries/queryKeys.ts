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
};
