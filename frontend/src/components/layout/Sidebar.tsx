import {
  LayoutDashboard,
  Inbox,
  Users,
  Bot,
  Zap,
  Settings,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type NavItemKey =
  | 'overview'
  | 'inbox'
  | 'leads'
  | 'experts'
  | 'ai-automation'
  | 'integrations'
  | 'settings';

interface SidebarProps {
  currentTab: NavItemKey;
  onTabChange: (tab: NavItemKey) => void;
  unreadCount?: number;
}

export function Sidebar({ currentTab, onTabChange, unreadCount = 0 }: SidebarProps) {
  const navItems = [
    { key: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    {
      key: 'inbox' as const,
      label: 'Inbox',
      icon: Inbox,
      badge: unreadCount > 0 ? String(unreadCount) : undefined,
    },
    { key: 'leads' as const, label: 'Leads Pipeline', icon: Users },
    { key: 'experts' as const, label: 'Verified Experts', icon: UserCheck },
    {
      key: 'ai-automation' as const,
      label: 'AI Automation',
      icon: Bot,
      highlight: true,
    },
    { key: 'integrations' as const, label: 'Integrations', icon: Zap },
    { key: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card/40 backdrop-blur-md flex flex-col justify-between shrink-0">
      <div>
        {/* Brand / Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-400 flex items-center justify-center text-primary-foreground font-bold shadow-md shadow-primary/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-foreground flex items-center gap-1.5">
              Resider
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                Concierge
              </span>
            </div>
            <p className="text-xs text-muted-foreground">UAE Residency & Setup</p>
          </div>
        </div>

        {/* Channel Status Quick Glance */}
        <div className="p-4 mx-3 my-3 rounded-lg bg-secondary/40 border border-border/50 text-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground font-medium">
            <span>Channels</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live
            </span>
          </div>
          <div className="flex gap-2">
            <Badge variant="instagram" className="text-[11px] py-0 px-2">
              Instagram DM
            </Badge>
            <Badge variant="whatsapp" className="text-[11px] py-0 px-2">
              WhatsApp
            </Badge>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onTabChange(item.key)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('w-4 h-4', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary text-primary-foreground'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tenant / Environment Footer */}
      <div className="p-4 border-t border-border/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border border-border">
            RA
          </div>
          <div className="truncate">
            <p className="text-xs font-medium text-foreground truncate">Resider Advisory</p>
            <p className="text-[10px] text-muted-foreground">Admin Workspace</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
