import { useSyncExternalStore } from 'react';
import { parseRoute } from '@/lib/navigation';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener('workspace:navigate', onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener('workspace:navigate', onChange);
  };
}

export function useNavigation() {
  const location = useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search,
    () => '/inbox',
  );
  return parseRoute(location);
}
