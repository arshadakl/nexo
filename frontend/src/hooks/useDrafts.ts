import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type { MessageDraft } from '@shared/types/draft.types';

export function usePendingDrafts() {
  return useQuery({
    queryKey: queryKeys.drafts.pending(),
    queryFn: () => apiFetch<MessageDraft[]>('/api/drafts/pending'),
    refetchInterval: 10 * 1000, // Staged drafts refresh every 10s
    staleTime: 5 * 1000,
  });
}

export function useConversationDraft(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.drafts.conversation(conversationId || ''),
    queryFn: () =>
      apiFetch<MessageDraft | null>(`/api/drafts/conversation/${conversationId}`),
    enabled: Boolean(conversationId),
    refetchInterval: 8 * 1000,
    staleTime: 4 * 1000,
  });
}

export function useApproveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draftId: string) =>
      apiFetch<MessageDraft>(`/api/drafts/${draftId}/approve`, {
        method: 'POST',
      }),
    onSuccess: (draft) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(draft.conversationId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useModifyDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftId, modifiedText }: { draftId: string; modifiedText: string }) =>
      apiFetch<MessageDraft>(`/api/drafts/${draftId}/modify`, {
        method: 'POST',
        body: JSON.stringify({ modifiedText }),
      }),
    onSuccess: (draft) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(draft.conversationId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useRejectDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draftId: string) =>
      apiFetch<MessageDraft>(`/api/drafts/${draftId}/reject`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
    },
  });
}
