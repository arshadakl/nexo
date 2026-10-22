import { useState } from 'react';
import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/lib/AuthContext';
import type { NavItemKey } from './Sidebar';

const titles: Record<NavItemKey, string> = {
  inbox: 'Inbox',
  leads: 'Leads',
  overview: 'Overview',
  'ai-automation': 'AI & knowledge',
  integrations: 'Channels',
  settings: 'Settings',
};

export function Header({
  currentTab,
  onOpenNavigation,
}: {
  currentTab: NavItemKey;
  onOpenNavigation: () => void;
}) {
  const { user, logout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 lg:hidden"
          onClick={onOpenNavigation}
          aria-label="Open navigation"
        >
          <Menu aria-hidden="true" className="size-4" />
        </Button>
        <h1 className="truncate text-sm font-semibold">{titles[currentTab]}</h1>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <span className="hidden max-w-60 truncate text-xs text-muted-foreground sm:inline">
          {user?.email}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10"
          aria-label="Sign out"
          disabled={isSigningOut}
          onClick={async () => {
            setIsSigningOut(true);
            try {
              await logout();
            } catch {
              /* logout clears local session in finally */
            }
          }}
        >
          <LogOut aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
        </Button>
      </div>
    </header>
  );
}
