import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type {
  Lead,
  LeadPage,
  LeadPageQuery,
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

/** One page of leads for the Leads table/board; keeps the previous page on screen while loading. */
export function useLeadsPage(query: LeadPageQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  return useQuery({
    queryKey: queryKeys.leads.list({ ...query, view: 'page' } as Record<string, unknown>),
    queryFn: ({ signal }) => apiFetch<LeadPage>(`/api/leads/search?${params.toString()}`, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

/** Fetches every lead matching the filters (for CSV export), page by page. */
export async function fetchAllLeads(query: LeadPageQuery): Promise<Lead[]> {
  const all: Lead[] = [];
  for (let page = 1; page <= 50; page++) {
    const params = new URLSearchParams();
    Object.entries({ ...query, page, pageSize: 200 }).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    });
    const result = await apiFetch<LeadPage>(`/api/leads/search?${params.toString()}`);
    all.push(...result.items);
    if (all.length >= result.total || result.items.length === 0) break;
  }
  return all;
}

/** Bulk action: move selected leads to one stage. */
export function useBulkLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { leadIds: string[]; leadStatus: LeadStatus }) =>
      apiFetch<{ updated: number }>('/api/leads/bulk-status', { method: 'POST', body: JSON.stringify(body) }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
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
      const previous = queryClient.getQueriesData<Lead[] | LeadPage>({ queryKey: listKey });
      const moveIn = (items: Lead[]) => items.map((lead) => (lead.id === leadId ? { ...lead, leadStatus } : lead));
      queryClient.setQueriesData<Lead[] | LeadPage>({ queryKey: listKey }, (old) =>
        !old ? old : Array.isArray(old) ? moveIn(old) : { ...old, items: moveIn(old.items) },
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
