import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sidebar, type NavItemKey } from './Sidebar';
import { Header } from './Header';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';

export function AppShell({
  currentTab,
  onTabChange,
  children,
}: {
  currentTab: NavItemKey;
  onTabChange: (tab: NavItemKey) => void;
  children: ReactNode;
}) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const isWorkspace = currentTab === 'inbox';
  const mainRef = useRef<HTMLElement>(null);
  const previousTab = useRef(currentTab);
  useEffect(() => {
    if (previousTab.current !== currentTab) mainRef.current?.focus();
    previousTab.current = currentTab;
  }, [currentTab]);
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <a
        href="#workspace-main"
        className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <div className="hidden shrink-0 border-r border-border lg:block">
        <Sidebar currentTab={currentTab} onTabChange={onTabChange} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header currentTab={currentTab} onOpenNavigation={() => setIsNavigationOpen(true)} />
        <main
          ref={mainRef}
          id="workspace-main"
          tabIndex={-1}
          className={cn(
            'min-h-0 min-w-0 flex-1 focus-visible:-outline-offset-2',
            isWorkspace ? 'flex overflow-hidden' : 'overflow-y-auto p-4 sm:p-6',
          )}
        >
          {isWorkspace ? (
            children
          ) : (
            <div
              className={cn(
                'mx-auto w-full',
                currentTab === 'settings' || currentTab === 'ai-automation'
                  ? 'max-w-5xl'
                  : 'max-w-screen-2xl',
              )}
            >
              {children}
            </div>
          )}
        </main>
      </div>
      {isNavigationOpen && (
        <Dialog
          title="Navigation"
          onClose={() => setIsNavigationOpen(false)}
          className="ml-0 mr-auto h-dvh max-h-dvh w-64 max-w-[90vw] rounded-none"
        >
          <div className="h-[calc(100dvh_-_4rem)]">
            <Sidebar
              currentTab={currentTab}
              onTabChange={onTabChange}
              onNavigate={() => setIsNavigationOpen(false)}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
