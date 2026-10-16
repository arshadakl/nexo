import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type { ConnectWhatsAppRequest } from '@shared/types/whatsapp.types';

export function useConnectWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ConnectWhatsAppRequest) =>
      apiFetch<{ success: boolean; connectionId: string; displayName: string }>(
        '/api/integrations/whatsapp/connect',
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
    },
  });
}
