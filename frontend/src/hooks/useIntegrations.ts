import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/queries/queryKeys';
import type { MetaConnectionSummary, OAuthConnectResponse } from '@shared/types/meta.types';

export function useIntegrations() {
  return useQuery({
    queryKey: queryKeys.integrations.all,
    queryFn: () => apiFetch<MetaConnectionSummary[]>('/api/integrations'),
    staleTime: 2 * 60 * 1000,
  });
}

export function useConnectInstagram() {
  const queryClient = useQueryClient();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [lastNotification, setLastNotification] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    // Listen for postMessage from Meta OAuth callback in popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'NEXO_META_CONNECTED') {
        setIsPopupOpen(false);
        setLastNotification({
          success: true,
          message: `Successfully connected Instagram professional account (@${event.data.username || 'connected'})!`,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      } else if (event.data?.type === 'NEXO_META_ERROR') {
        setIsPopupOpen(false);
        setLastNotification({
          success: false,
          message: event.data.error || 'Instagram connection cancelled or failed.',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<OAuthConnectResponse>('/api/integrations/instagram/connect', {
        method: 'POST',
      }),
    onSuccess: (data) => {
      // Open centered popup window
      const width = 600;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      setIsPopupOpen(true);
      const popup = window.open(
        data.authUrl,
        'MetaInstagramOAuth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=no`
      );

      // Periodically check if popup was closed by user
      const checkTimer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkTimer);
          setIsPopupOpen(false);
        }
      }, 1000);
    },
  });

  return {
    connect: mutation.mutate,
    isConnecting: mutation.isPending || isPopupOpen,
    notification: lastNotification,
    dismissNotification: () => setLastNotification(null),
  };
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) =>
      apiFetch<{ success: boolean; connectionId: string }>(
        `/api/integrations/${connectionId}/disconnect`,
        { method: 'POST' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
    },
  });
}
