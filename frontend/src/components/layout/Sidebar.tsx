import type { MouseEvent } from 'react';
import {
  LayoutDashboard,
  Inbox,
  Users,
  Bot,
  Zap,
  Settings,
  UserCheck,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { screenPaths, type NavItemKey } from '@/lib/navigation';
export type { NavItemKey } from '@/lib/navigation';

export function Sidebar({
  currentTab,
  onTabChange,
  onNavigate,
}: {
  currentTab: NavItemKey;
  onTabChange: (tab: NavItemKey) => void;
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const groups = [
    {
      label: 'Workspace',
      items: [
        { key: 'inbox' as const, label: 'Inbox', icon: Inbox },
        { key: 'leads' as const, label: 'Leads', icon: Users },
        { key: 'experts' as const, label: 'Partners', icon: UserCheck },
        { key: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Manage',
      items: [
        { key: 'ai-automation' as const, label: 'AI & knowledge', icon: Bot },
        { key: 'integrations' as const, label: 'Channels', icon: Zap },
        { key: 'settings' as const, label: 'Settings', icon: Settings },
      ],
    },
  ];
  const handleNavigate = (event: MouseEvent<HTMLAnchorElement>, key: NavItemKey) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onTabChange(key);
    onNavigate?.();
  };
  return (
    <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col bg-surface-sidebar">
      <div className="flex h-14 shrink-0 items-center gap-3 px-5">
        <img src="/resider.svg" alt="" className="size-7" />
        <span className="text-sm font-semibold">Resider</span>
      </div>
      <nav
        aria-label="Workspace navigation"
        className="min-h-0 flex-1 space-y-8 overflow-y-auto px-3 py-5"
      >
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">{group.label}</p>
            <div className="space-y-1">
              {group.items.map(({ key, label, icon: Icon }) => (
                <a
                  key={key}
                  href={screenPaths[key]}
                  aria-current={currentTab === key ? 'page' : undefined}
                  onClick={(event) => handleNavigate(event, key)}
                  className={cn(
                    'flex min-h-9 items-center gap-3 rounded-md px-2 py-2 text-[13px] leading-5',
                    currentTab === key
                      ? 'bg-surface-selected font-medium text-foreground'
                      : 'text-content-secondary hover:bg-surface-hover hover:text-foreground',
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-4 border-t border-border p-4">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          UAE residency & business setup <ArrowUpRight aria-hidden="true" className="size-3" />
        </p>
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised text-xs font-medium"
          >
            {(user?.name || user?.email || 'R').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{user?.name || user?.email}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {user?.role || 'Workspace member'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
