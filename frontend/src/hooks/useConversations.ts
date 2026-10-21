import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type {
  ConversationSummary,
  ConversationWithDetails,
  Message,
  SendMessageRequest,
  TakeoverRequest,
  SetAIModeRequest,
  InternalNote,
  CreateNoteRequest,
  ChannelType,
  ConversationStatus,
} from '@shared/types/crm.types';

export interface UseConversationsFilters {
  channel?: (ChannelType | 'all') | undefined;
  status?: ConversationStatus | undefined;
  takeover?: boolean | undefined;
  search?: string | undefined;
}

export function useConversations(filters: UseConversationsFilters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.channel && filters.channel !== 'all') queryParams.set('channel', filters.channel);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.takeover !== undefined) queryParams.set('takeover', String(filters.takeover));
  if (filters.search) queryParams.set('search', filters.search);

  const queryString = queryParams.toString();
  const endpoint = `/api/conversations${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: queryKeys.conversations.list(filters as Record<string, unknown>),
    queryFn: ({ signal }) => apiFetch<ConversationSummary[]>(endpoint, { signal }),
    staleTime: 15 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(conversationId || ''),
    queryFn: ({ signal }) =>
      apiFetch<ConversationWithDetails>(
        `/api/conversations/${encodeURIComponent(conversationId || '')}`,
        { signal },
      ),
    enabled: Boolean(conversationId),
    staleTime: 10 * 1000,
  });
}

export function useConversationMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.conversations.messages(conversationId || ''),
    queryFn: async ({ signal }) => {
      const messages = await apiFetch<Message[]>(
        `/api/conversations/${encodeURIComponent(conversationId || '')}/messages`,
        { signal },
      );
      // Keep optimistic rows visible while a poll overlaps a send request.
      const optimistic =
        queryClient
          .getQueryData<Message[]>(queryKeys.conversations.messages(conversationId || ''))
          ?.filter((message) => message.id.startsWith('optimistic_')) ?? [];
      return [...messages, ...optimistic];
    },
    enabled: Boolean(conversationId),
    staleTime: 5 * 1000,
    refetchInterval: 6 * 1000, // Background updates when thread is active
  });
}

export function useSendMessage(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SendMessageRequest) =>
      apiFetch<Message>(`/api/conversations/${encodeURIComponent(conversationId || '')}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onMutate: async (newMessage) => {
      if (!conversationId) return;

      await queryClient.cancelQueries({
        queryKey: queryKeys.conversations.messages(conversationId),
      });

      const optimisticMsg: Message = {
        id: `optimistic_${crypto.randomUUID()}`,
        tenantId: 'current',
        conversationId,
        direction: 'outbound',
        senderType: 'staff',
        messageText: newMessage.messageText,
        messageType: 'text',
        deliveryStatus: 'pending',
        createdAt: Date.now(),
      };

      queryClient.setQueryData<Message[]>(
        queryKeys.conversations.messages(conversationId),
        (old = []) => [...old, optimisticMsg],
      );

      return {
        optimisticId: optimisticMsg.id,
        query: queryClient
          .getQueryCache()
          .find({ queryKey: queryKeys.conversations.messages(conversationId) }),
      };
    },
    onSuccess: async (message, _vars, context) => {
      if (conversationId) {
        await queryClient.cancelQueries({
          queryKey: queryKeys.conversations.messages(conversationId),
        });
        if (
          queryClient.getQueryCache().find({ queryKey: queryKeys.conversations.messages(conversationId) }) !== context?.query
        ) return;
        queryClient.setQueryData<Message[]>(
          queryKeys.conversations.messages(conversationId),
          (old = []) => {
            const withoutOptimistic = old.filter(
              (item) => item.id !== context?.optimisticId && item.id !== message.id,
            );
            return [...withoutOptimistic, message];
          },
        );
      }
    },
    onError: (_err, _vars, context) => {
      if (
        conversationId &&
        context?.optimisticId &&
        queryClient
          .getQueryCache()
          .find({ queryKey: queryKeys.conversations.messages(conversationId) }) === context.query
      ) {
        queryClient.setQueryData<Message[]>(
          queryKeys.conversations.messages(conversationId),
          (old = []) => old.filter((message) => message.id !== context.optimisticId),
        );
      }
    },
    onSettled: () => {
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.messages(conversationId),
        });
      }
      queryClient.invalidateQueries({ queryKey: [...queryKeys.conversations.all, 'list'] });
    },
  });
}

export function useToggleTakeover(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: TakeoverRequest) =>
      apiFetch<{ success: boolean; humanTakeover: boolean }>(
        `/api/conversations/${conversationId}/takeover`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      ),
    onSuccess: (data) => {
      if (!conversationId) return;

      // Update detail query cache
      queryClient.setQueryData<ConversationWithDetails>(
        queryKeys.conversations.detail(conversationId),
        (old) => (old ? { ...old, humanTakeover: data.humanTakeover } : old),
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useSetAIMode(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SetAIModeRequest) =>
      apiFetch<{ success: boolean; aiMode: string }>(
        `/api/conversations/${conversationId}/ai-mode`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      ),
    onSuccess: (data) => {
      if (!conversationId) return;

      queryClient.setQueryData<ConversationWithDetails>(
        queryKeys.conversations.detail(conversationId),
        (old) => (old ? { ...old, aiMode: data.aiMode as any } : old),
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useAddConversationNote(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateNoteRequest) =>
      apiFetch<InternalNote>(`/api/conversations/${conversationId}/notes`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useClearConversationHistory(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; conversationId: string; message: string }>(
        `/api/conversations/${conversationId}/messages`,
        {
          method: 'DELETE',
        },
      ),
    onSuccess: () => {
      if (!conversationId) return;

      // Instantly clear messages in cache
      queryClient.setQueryData(queryKeys.conversations.messages(conversationId), []);

      // Invalidate detail and list to refresh lead context and preview
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
    },
  });
}
