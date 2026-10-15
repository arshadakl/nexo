import { ShieldCheck, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
    title: 'Visa Leads Pipeline',
    subtitle: 'AI-extracted applicant profiles, commercial readiness, and follow-ups',
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

  return (
    <header className="h-16 border-b border-border bg-card/20 backdrop-blur-md px-8 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-base font-bold text-foreground leading-none">{current.title}</h1>
        <p className="text-xs text-muted-foreground mt-1">{current.subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* System Health Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-xs">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-muted-foreground">Workers Edge:</span>
          <span className="font-semibold text-foreground">p95 &lt; 2.5ms</span>
        </div>

        {/* AI Master State Indicator */}
        <Badge variant="success" className="gap-1.5 py-1 px-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          AI Master ON
        </Badge>
      </div>
    </header>
  );
}
