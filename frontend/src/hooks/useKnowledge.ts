import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type {
  BusinessKnowledgeItem,
  CreateKnowledgeItemInput,
  UpdateKnowledgeItemInput,
} from '@shared/types/knowledge.types';

export function useKnowledgeItems() {
  return useQuery({
    queryKey: queryKeys.knowledge.list(),
    queryFn: () => apiFetch<BusinessKnowledgeItem[]>('/api/knowledge'),
    staleTime: 60 * 1000,
  });
}

export function useApprovedKnowledgeItems() {
  return useQuery({
    queryKey: queryKeys.knowledge.approved(),
    queryFn: () => apiFetch<BusinessKnowledgeItem[]>('/api/knowledge/approved'),
    staleTime: 60 * 1000,
  });
}

export function useTogglePriceApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      isApproved,
      notes,
    }: {
      id: string;
      isApproved: boolean;
      notes?: string;
    }) =>
      apiFetch<BusinessKnowledgeItem>(`/api/knowledge/${id}/approval`, {
        method: 'PATCH',
        body: JSON.stringify({ isApproved, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
    },
  });
}

export function useCreateKnowledgeItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateKnowledgeItemInput) =>
      apiFetch<BusinessKnowledgeItem>('/api/knowledge', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
    },
  });
}

export function useUpdateKnowledgeItem(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateKnowledgeItemInput) =>
      apiFetch<BusinessKnowledgeItem>(`/api/knowledge/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
    },
  });
}

export function useDeleteKnowledgeItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/knowledge/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
    },
  });
}
