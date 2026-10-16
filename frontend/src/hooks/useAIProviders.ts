import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type {
  MaskedAIProvider,
  CreateAIProviderInput,
  AIProviderPreset,
  AIHealthCheckResult,
} from '@shared/types/ai.types';

export function useAIProviders() {
  return useQuery({
    queryKey: queryKeys.aiProviders.list(),
    queryFn: () => apiFetch<MaskedAIProvider[]>('/api/ai/providers'),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useAIProviderPresets() {
  return useQuery({
    queryKey: queryKeys.aiProviders.presets,
    queryFn: () => apiFetch<AIProviderPreset[]>('/api/ai/presets'),
    staleTime: 10 * 60 * 1000, // 10 minutes (static catalogue)
  });
}

export function useCreateAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAIProviderInput) =>
      apiFetch<MaskedAIProvider>('/api/ai/providers', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
    },
  });
}

export function useTestAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) =>
      apiFetch<AIHealthCheckResult>(`/api/ai/providers/${providerId}/test`, {
        method: 'POST',
      }),
    onSuccess: (result, providerId) => {
      // Optimistically update the provider's health status in cache
      queryClient.setQueryData<MaskedAIProvider[]>(
        queryKeys.aiProviders.list(),
        (old) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === providerId
              ? {
                  ...p,
                  lastHealthStatus: result.healthStatus,
                  lastHealthLatencyMs: result.latencyMs,
                  lastHealthCheckAt: Date.now(),
                }
              : p
          );
        }
      );
    },
  });
}

export function useSetDefaultAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) =>
      apiFetch<{ success: boolean; isDefault: boolean }>(
        `/api/ai/providers/${providerId}/set-default`,
        { method: 'POST' }
      ),
    onMutate: async (providerId: string) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: queryKeys.aiProviders.list() });
      const previousProviders = queryClient.getQueryData<MaskedAIProvider[]>(
        queryKeys.aiProviders.list()
      );

      // Optimistic update: set target as default and all others as non-default
      queryClient.setQueryData<MaskedAIProvider[]>(
        queryKeys.aiProviders.list(),
        (old) => {
          if (!old) return old;
          return old.map((p) => ({
            ...p,
            isDefault: p.id === providerId,
            isActive: p.id === providerId ? true : p.isActive,
          }));
        }
      );

      return { previousProviders };
    },
    onError: (_err, _providerId, context) => {
      if (context?.previousProviders) {
        queryClient.setQueryData(
          queryKeys.aiProviders.list(),
          context.previousProviders
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.list() });
    },
  });
}

export function useDeleteAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) =>
      apiFetch<{ success: boolean; deletedId: string }>(
        `/api/ai/providers/${providerId}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.all });
    },
  });
}
