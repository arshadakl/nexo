import { ShieldCheck, Activity, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import type { NavItemKey } from './Sidebar';

interface HeaderProps {
  currentTab: NavItemKey;
}

const titles: Record<NavItemKey, { title: string; subtitle: string }> = {
  overview: {
    title: 'Operations Overview',
    subtitle: 'Real-time DM conversations, qualification scores, and CRM pipeline',
  },
  inbox: {
    title: 'Omnichannel Inbox',
    subtitle: 'Unified Instagram DMs & WhatsApp customer threads with AI co-pilot',
  },
  leads: {
    title: 'Resider Leads Pipeline',
    subtitle: 'Customer profiles, UAE residency intents, and consulting readiness',
  },
  experts: {
    title: 'Verified Consulting Partners',
    subtitle: 'Expert directory for sector-specific business setup and mainland referrals',
  },
  'ai-automation': {
    title: 'AI Providers & Automation',
    subtitle: 'Configure dynamic OpenAI-compatible endpoints, models, and safety switches',
  },
  integrations: {
    title: 'Meta Channel Connections',
    subtitle: 'Official Instagram Login and WhatsApp Business Platform integration',
  },
  settings: {
    title: 'Workspace Settings',
    subtitle: 'Team permissions, data retention policies, and audit logs',
  },
};

export function Header({ currentTab }: HeaderProps) {
  const current = titles[currentTab] || { title: 'Dashboard', subtitle: '' };
  const { user, logout } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-card/20 backdrop-blur-md px-8 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-base font-bold text-foreground leading-none">{current.title}</h1>
        <p className="text-xs text-muted-foreground mt-1">{current.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* System Health Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-xs">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-muted-foreground">Edge CPU:</span>
          <span className="font-semibold text-foreground">&lt; 1.5ms</span>
        </div>

        {/* AI Master State Indicator */}
        <Badge variant="success" className="gap-1.5 py-1 px-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          AI Master ON
        </Badge>

        {/* User Info & Logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <span className="text-xs font-medium text-foreground hidden md:inline">
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              title="Sign Out"
              className="text-xs h-8 px-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
