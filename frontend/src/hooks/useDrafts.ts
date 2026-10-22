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
    queryFn: ({ signal }) =>
      apiFetch<MessageDraft | null>(
        `/api/drafts/conversation/${encodeURIComponent(conversationId || '')}`,
        { signal },
      ),
    enabled: Boolean(conversationId),
    refetchInterval: 8 * 1000,
    staleTime: 4 * 1000,
  });
}

export function useApproveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: string | { draftId: string; acknowledgeNewMessages?: boolean }) => {
      const { draftId, acknowledgeNewMessages } = typeof input === 'string' ? { draftId: input } : input;
      return apiFetch<MessageDraft>(`/api/drafts/${draftId}/approve`, {
        method: 'POST',
        ...(acknowledgeNewMessages ? { body: JSON.stringify({ acknowledgeNewMessages }) } : {}),
      });
    },
    onSuccess: (draft) => {
      queryClient.setQueryData<MessageDraft | null>(
        queryKeys.drafts.conversation(draft.conversationId),
        (old) => (old?.id === draft.id ? null : old),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(draft.conversationId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.conversations.all, 'messages'] });
    },
  });
}

export function useModifyDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      draftId,
      modifiedText,
      acknowledgeNewMessages,
    }: {
      draftId: string;
      modifiedText: string;
      acknowledgeNewMessages?: boolean;
    }) =>
      apiFetch<MessageDraft>(`/api/drafts/${draftId}/modify`, {
        method: 'POST',
        body: JSON.stringify(acknowledgeNewMessages ? { modifiedText, acknowledgeNewMessages } : { modifiedText }),
      }),
    onSuccess: (draft) => {
      queryClient.setQueryData<MessageDraft | null>(
        queryKeys.drafts.conversation(draft.conversationId),
        (old) => (old?.id === draft.id ? null : old),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(draft.conversationId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'conversations' && query.queryKey[1] === 'messages',
      });
    },
  });
}

export function useRejectDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: string | { draftId: string; nextAction?: 'take_over' | 'resume_ai' }) => {
      const { draftId, nextAction } = typeof input === 'string' ? { draftId: input } : input;
      return apiFetch<MessageDraft>(`/api/drafts/${draftId}/reject`, {
        method: 'POST',
        ...(nextAction ? { body: JSON.stringify({ nextAction }) } : {}),
      });
    },
    onSuccess: (draft) => {
      queryClient.setQueryData<MessageDraft | null>(
        queryKeys.drafts.conversation(draft.conversationId),
        (old) => (old?.id === draft.id ? null : old),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

/** Retries dispatch of an approved reply whose send failed. */
export function useRetryDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftId, acknowledgeNewMessages }: { draftId: string; acknowledgeNewMessages?: boolean }) =>
      apiFetch<MessageDraft>(`/api/drafts/${draftId}/retry`, {
        method: 'POST',
        body: JSON.stringify({ acknowledgeNewMessages: Boolean(acknowledgeNewMessages) }),
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}
