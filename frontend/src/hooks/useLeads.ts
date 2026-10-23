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
  serviceVertical?: string | undefined;
  search?: string | undefined;
  sortBy?: ('recent' | 'status') | undefined;
}

export function useLeads(filters: UseLeadsFilters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.serviceVertical) queryParams.set('vertical', filters.serviceVertical);
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.sortBy) queryParams.set('sortBy', filters.sortBy);

  const queryString = queryParams.toString();
  const endpoint = `/api/leads${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: queryKeys.leads.list(filters as Record<string, unknown>),
    queryFn: ({ signal }) => apiFetch<Lead[]>(endpoint, { signal }),
    staleTime: 30 * 1000,
  });
}

export function useLead(leadId: string | null) {
  return useQuery({
    queryKey: queryKeys.leads.detail(leadId || ''),
    queryFn: ({ signal }) => apiFetch<Lead & { linkedConversationIds: string[] }>(`/api/leads/${encodeURIComponent(leadId || '')}`, { signal }),
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
        queryClient.setQueryData(queryKeys.leads.detail(leadId), (old: (Lead & { linkedConversationIds?: string[] }) | undefined) => ({ ...old, ...updatedLead }));
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

/** Moves a lead to another stage (Kanban). Updates every cached lead list immediately and rolls back on failure. */
export function useMoveLeadStage() {
  const queryClient = useQueryClient();
  const listKey = [...queryKeys.leads.all, 'list'];

  return useMutation({
    mutationFn: ({ leadId, leadStatus }: { leadId: string; leadStatus: LeadStatus }) =>
      apiFetch<Lead>(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ leadStatus }),
      }),
    onMutate: async ({ leadId, leadStatus }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueriesData<Lead[]>({ queryKey: listKey });
      queryClient.setQueriesData<Lead[]>({ queryKey: listKey }, (old) =>
        old?.map((lead) => (lead.id === leadId ? { ...lead, leadStatus } : lead)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
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
    queryFn: ({ signal }) => apiFetch<InternalNote[]>(`/api/leads/${encodeURIComponent(leadId || '')}/notes`, { signal }),
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
