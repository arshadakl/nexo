import {
  MessageSquare,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function OverviewView() {
  const metricCards = [
    {
      title: 'Active Inbound DMs',
      value: '24',
      change: '+14% today',
      icon: MessageSquare,
      color: 'text-primary',
    },
    {
      title: 'Qualified Visa Leads',
      value: '18',
      change: '8 awaiting staff',
      icon: Users,
      color: 'text-emerald-400',
    },
    {
      title: 'AI Auto-Replies Sent',
      value: '86',
      change: '98.8% accuracy',
      icon: Sparkles,
      color: 'text-indigo-400',
    },
    {
      title: 'Needs Human Review',
      value: '2',
      change: 'Requires takeover',
      icon: AlertTriangle,
      color: 'text-amber-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-foreground">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <span>{card.change}</span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main operational panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Health Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Channel Integration Health</CardTitle>
                <CardDescription>Live Meta webhook status and delivery confirmation</CardDescription>
              </div>
              <Badge variant="success">All Systems Operational</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card/60">
              <div className="flex items-center gap-3">
                <Badge variant="instagram">Instagram</Badge>
                <div>
                  <p className="text-sm font-medium text-foreground">@visahorizon.official</p>
                  <p className="text-xs text-muted-foreground">Last inbound DM: 4m ago • Webhook Healthy</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-400 font-medium">Connected</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card/60">
              <div className="flex items-center gap-3">
                <Badge variant="whatsapp">WhatsApp</Badge>
                <div>
                  <p className="text-sm font-medium text-foreground">+1 (555) 019-2834 (Business Cloud)</p>
                  <p className="text-xs text-muted-foreground">Customer service window: Active • Tier 1</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-400 font-medium">Connected</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Engine Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Active AI Provider</CardTitle>
            <CardDescription>Pluggable OpenAI-compatible endpoint</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3.5 rounded-lg bg-secondary/30 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Groq Production</span>
                <Badge variant="success" className="text-[10px]">Active Default</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Model: llama-3.3-70b-versatile</p>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                <span className="text-muted-foreground">Latency:</span>
                <span className="font-mono text-emerald-400 font-medium">~320ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">CPU Cost:</span>
                <span className="font-mono text-foreground font-medium">&lt; 1.5ms V8</span>
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
              <span>Manage AI Providers</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
