import { QueryClient, focusManager } from '@tanstack/react-query';

// Connect browser tab visibility to TanStack Query focus manager
// When tab is hidden, all background refetches/polling are automatically suspended
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    focusManager.setFocused(document.visibilityState === 'visible');
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute default
      gcTime: 15 * 60 * 1000, // 15 minutes cache garbage collection
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
