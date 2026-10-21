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
    queryFn: () => apiFetch<ConversationSummary[]>(endpoint),
    staleTime: 15 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(conversationId || ''),
    queryFn: () => apiFetch<ConversationWithDetails>(`/api/conversations/${conversationId}`),
    enabled: Boolean(conversationId),
    staleTime: 10 * 1000,
  });
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(conversationId || ''),
    queryFn: () => apiFetch<Message[]>(`/api/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
    staleTime: 5 * 1000,
    refetchInterval: 6 * 1000, // Background updates when thread is active
  });
}

export function useSendMessage(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SendMessageRequest) =>
      apiFetch<Message>(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onMutate: async (newMessage) => {
      if (!conversationId) return;

      await queryClient.cancelQueries({
        queryKey: queryKeys.conversations.messages(conversationId),
      });

      const previousMessages = queryClient.getQueryData<Message[]>(
        queryKeys.conversations.messages(conversationId)
      );

      const optimisticMsg: Message = {
        id: `optimistic_${Date.now()}`,
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
        (old = []) => [...old, optimisticMsg]
      );

      return { previousMessages };
    },
    onError: (_err, _vars, context) => {
      if (conversationId && context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.conversations.messages(conversationId),
          context.previousMessages
        );
      }
    },
    onSettled: () => {
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.messages(conversationId),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
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
        }
      ),
    onSuccess: (data) => {
      if (!conversationId) return;

      // Update detail query cache
      queryClient.setQueryData<ConversationWithDetails>(
        queryKeys.conversations.detail(conversationId),
        (old) => (old ? { ...old, humanTakeover: data.humanTakeover } : old)
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
        }
      ),
    onSuccess: (data) => {
      if (!conversationId) return;

      queryClient.setQueryData<ConversationWithDetails>(
        queryKeys.conversations.detail(conversationId),
        (old) => (old ? { ...old, aiMode: data.aiMode as any } : old)
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
        }
      ),
    onSuccess: () => {
      if (!conversationId) return;

      // Instantly clear messages in cache
      queryClient.setQueryData(queryKeys.conversations.messages(conversationId), []);

      // Invalidate detail and list to refresh lead context and preview
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}
