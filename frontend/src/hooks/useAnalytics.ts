import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type { AnalyticsOverviewResponse } from '@shared/types/analytics.types';

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: queryKeys.analytics.overview('default'),
    queryFn: () => apiFetch<AnalyticsOverviewResponse>('/api/analytics/overview'),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}
