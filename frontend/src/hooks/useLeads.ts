import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type {
  Lead,
  LeadStatus,
  InternalNote,
  CreateNoteRequest,
} from '@shared/types/crm.types';
import type { UpdateLeadSchemaType, CreateLeadSchemaType } from '@shared/schemas/lead.schema';

export interface UseLeadsFilters {
  status?: LeadStatus | undefined;
  destinationCountry?: string | undefined;
  search?: string | undefined;
  minScore?: number | undefined;
  maxScore?: number | undefined;
  sortBy?: ('score' | 'recent') | undefined;
}

export function useLeads(filters: UseLeadsFilters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.destinationCountry) queryParams.set('country', filters.destinationCountry);
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.minScore !== undefined) queryParams.set('minScore', String(filters.minScore));
  if (filters.maxScore !== undefined) queryParams.set('maxScore', String(filters.maxScore));
  if (filters.sortBy) queryParams.set('sortBy', filters.sortBy);

  const queryString = queryParams.toString();
  const endpoint = `/api/leads${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: queryKeys.leads.list(filters as Record<string, unknown>),
    queryFn: () => apiFetch<Lead[]>(endpoint),
    staleTime: 30 * 1000,
  });
}

export function useLead(leadId: string | null) {
  return useQuery({
    queryKey: queryKeys.leads.detail(leadId || ''),
    queryFn: () => apiFetch<Lead & { linkedConversationIds: string[] }>(`/api/leads/${leadId}`),
    enabled: Boolean(leadId),
    staleTime: 15 * 1000,
  });
}

export function useUpdateLead(leadId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: UpdateLeadSchemaType) =>
      apiFetch<Lead>(`/api/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: (updatedLead) => {
      if (leadId) {
        queryClient.setQueryData(queryKeys.leads.detail(leadId), updatedLead);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newLead: CreateLeadSchemaType) =>
      apiFetch<Lead>('/api/leads', {
        method: 'POST',
        body: JSON.stringify(newLead),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}

export function useLeadNotes(leadId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.leads.detail(leadId || ''), 'notes'],
    queryFn: () => apiFetch<InternalNote[]>(`/api/leads/${leadId}/notes`),
    enabled: Boolean(leadId),
    staleTime: 10 * 1000,
  });
}

export function useAddLeadNote(leadId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateNoteRequest) =>
      apiFetch<InternalNote>(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (leadId) {
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.leads.detail(leadId), 'notes'],
        });
      }
    },
  });
}
