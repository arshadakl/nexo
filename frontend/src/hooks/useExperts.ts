import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type {
  VerifiedExpert,
  CreateExpertInput,
  UpdateExpertInput,
  ExpertMatchCriteria,
} from '@shared/types/expert.types';
import type { Lead } from '@shared/types/crm.types';

export interface UseExpertsFilters {
  sector?: string | undefined;
  language?: string | undefined;
  emirate?: string | undefined;
}

export function useExperts(filters: UseExpertsFilters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.sector) queryParams.set('sector', filters.sector);
  if (filters.language) queryParams.set('language', filters.language);
  if (filters.emirate) queryParams.set('emirate', filters.emirate);

  const qs = queryParams.toString();
  const endpoint = `/api/experts${qs ? `?${qs}` : ''}`;

  return useQuery({
    queryKey: queryKeys.experts.list(filters as Record<string, unknown>),
    queryFn: () => apiFetch<VerifiedExpert[]>(endpoint),
    staleTime: 60 * 1000,
  });
}

export function useExpert(id: string | null) {
  return useQuery({
    queryKey: queryKeys.experts.detail(id || ''),
    queryFn: () => apiFetch<VerifiedExpert>(`/api/experts/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateExpert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpertInput) =>
      apiFetch<VerifiedExpert>('/api/experts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experts.all });
    },
  });
}

export function useUpdateExpert(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateExpertInput) =>
      apiFetch<VerifiedExpert>(`/api/experts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experts.all });
    },
  });
}

export function useDeleteExpert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/experts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experts.all });
    },
  });
}

export function useMatchExperts(criteria: ExpertMatchCriteria) {
  return useQuery({
    queryKey: ['experts', 'match', criteria],
    queryFn: () =>
      apiFetch<VerifiedExpert[]>('/api/experts/match', {
        method: 'POST',
        body: JSON.stringify(criteria),
      }),
    enabled: Boolean(criteria.sector || criteria.language || criteria.emirate),
    staleTime: 30 * 1000,
  });
}

export function useAssignExpert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, expertId }: { leadId: string; expertId: string }) =>
      apiFetch<{ lead: Lead; expert: VerifiedExpert }>('/api/experts/assign', {
        method: 'POST',
        body: JSON.stringify({ leadId, expertId }),
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(vars.leadId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}
