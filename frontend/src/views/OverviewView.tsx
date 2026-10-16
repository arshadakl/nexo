import {
  MessageSquare,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsOverview } from '@/hooks/useAnalytics';

export function OverviewView() {
  const { data: analytics, isLoading, refetch } = useAnalyticsOverview();

  const kpis = analytics?.kpis;

  const metricCards = [
    {
      title: 'Active Inbound Inquiries',
      value: kpis?.activeConversations.value !== undefined ? String(kpis.activeConversations.value) : '0',
      change: kpis?.activeConversations.changeText || 'Live D1 sync',
      icon: MessageSquare,
      color: 'text-primary',
    },
    {
      title: 'Qualified Hot Leads',
      value: kpis?.qualifiedLeads.value !== undefined ? String(kpis.qualifiedLeads.value) : '0',
      change: kpis?.qualifiedLeads.changeText || 'Awaiting consultation',
      icon: Users,
      color: 'text-emerald-400',
    },
    {
      title: 'AI Auto-Replies Sent',
      value: kpis?.aiAutoReplies.value !== undefined ? String(kpis.aiAutoReplies.value) : '0',
      change: kpis?.aiAutoReplies.changeText || 'Structured output',
      icon: Sparkles,
      color: 'text-indigo-400',
    },
    {
      title: 'Staff Review / Takeover',
      value: kpis?.needsHumanReview.value !== undefined ? String(kpis.needsHumanReview.value) : '0',
      change: kpis?.needsHumanReview.changeText || 'AI paused',
      icon: AlertTriangle,
      color: 'text-amber-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Executive Overview</h2>
          <p className="text-xs text-muted-foreground">
            Live omnichannel CRM metrics, visa applicant pipeline, and AI inference telemetry
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 gap-1.5"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Top metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="hover:border-primary/40 transition-colors shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mb-1" />
                ) : (
                  <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
                    {card.value}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <span>{card.change}</span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main operational panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Destination Countries */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Top Visa Destination Countries
                </CardTitle>
                <CardDescription className="text-xs">
                  Applicant demand breakdown extracted by Nexo AI
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Live Pipeline
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : analytics && analytics.countryDistribution.length > 0 ? (
              analytics.countryDistribution.map((item) => (
                <div key={item.country} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{item.country}</span>
                    <span className="text-muted-foreground font-mono">
                      {item.leadCount} leads ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-secondary/50 rounded-full h-2 overflow-hidden border border-border/40">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(item.percentage, 6)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-muted-foreground text-xs space-y-1">
                <Globe className="w-6 h-6 mx-auto opacity-30 mb-2" />
                <p className="font-medium">No destination metrics yet</p>
                <p className="text-[11px] opacity-70">
                  As inbound Instagram and WhatsApp applicants mention countries, they appear here.
                </p>
              </div>
            )}

            {/* Omnichannel Distribution row */}
            <div className="pt-4 border-t border-border/60 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/30 border border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="instagram">Instagram</Badge>
                  <span className="text-xs font-semibold text-foreground">
                    {analytics?.channelBreakdown.find((c) => c.channel === 'instagram')?.conversationCount || 0} chats
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">Active</span>
              </div>

              <div className="p-3 rounded-lg bg-secondary/30 border border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="whatsapp">WhatsApp</Badge>
                  <span className="text-xs font-semibold text-foreground">
                    {analytics?.channelBreakdown.find((c) => c.channel === 'whatsapp')?.conversationCount || 0} chats
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">Active</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lead Conversion Funnel */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Qualification Funnel</CardTitle>
            <CardDescription className="text-xs">Applicant lifecycle progression</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : analytics?.conversionFunnel && analytics.conversionFunnel.length > 0 ? (
              analytics.conversionFunnel.map((step, idx) => (
                <div
                  key={step.stage}
                  className="p-2.5 rounded-lg bg-secondary/25 border border-border/60 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-foreground truncate font-medium text-[11px]">{step.stage}</span>
                  </div>
                  <span className="font-mono font-semibold text-foreground text-xs shrink-0">
                    {step.count}
                  </span>
                </div>
              ))
            ) : null}

            <div className="pt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5"
                onClick={() => window.location.hash = '#leads'}
              >
                <span>View Full Leads Pipeline</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
