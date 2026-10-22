import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type { ActionQueueItem, AnalyticsOverviewResponse } from '@shared/types/analytics.types';

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: queryKeys.analytics.overview('default'),
    queryFn: () => apiFetch<AnalyticsOverviewResponse>('/api/analytics/overview'),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/** Conversations that need a person, with the reason and the next action. */
export function useActionQueue() {
  return useQuery({
    queryKey: queryKeys.analytics.actionQueue(),
    queryFn: () => apiFetch<ActionQueueItem[]>('/api/analytics/action-queue'),
    staleTime: 10 * 1000,
    refetchInterval: 20 * 1000,
  });
}
