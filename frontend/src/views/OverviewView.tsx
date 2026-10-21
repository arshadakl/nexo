import {
  MessageSquare,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsOverview } from '@/hooks/useAnalytics';
import { navigate, screenPaths, type NavItemKey } from '@/lib/navigation';

interface OverviewViewProps {
  onNavigateTab?: (tab: NavItemKey) => void;
}

export function OverviewView({ onNavigateTab }: OverviewViewProps = {}) {
  const { data: analytics, isLoading, isError, refetch } = useAnalyticsOverview();

  const kpis = analytics?.kpis;

  const metricCards = [
    {
      title: 'Active conversations',
      value: kpis?.activeConversations.value !== undefined ? String(kpis.activeConversations.value) : '0',
      description: 'Loaded workspace inquiries',
      icon: MessageSquare,
      color: 'text-accent',
    },
    {
      title: 'Qualified leads',
      value: kpis?.qualifiedLeads.value !== undefined ? String(kpis.qualifiedLeads.value) : '0',
      description: 'Ready for team consultation',
      icon: Users,
      color: 'text-success',
    },
    {
      title: 'AI auto-replies dispatched',
      value: kpis?.aiAutoReplies.value !== undefined ? String(kpis.aiAutoReplies.value) : '0',
      description: 'Structured automated responses',
      icon: Sparkles,
      color: 'text-accent',
    },
    {
      title: 'Review / human takeover',
      value: kpis?.needsHumanReview.value !== undefined ? String(kpis.needsHumanReview.value) : '0',
      description: 'Conversations requiring attention',
      icon: AlertTriangle,
      color: 'text-warning',
    },
  ];

  const handleNavigate = (tab: NavItemKey) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else {
      navigate(screenPaths[tab]);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-content-primary">
            Overview
          </h2>
          <p className="text-xs text-content-secondary mt-0.5">
            Operational summary across conversations, lead pipeline stages, and connected channels.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 gap-1.5 bg-surface-panel border-border"
          onClick={() => { void refetch(); }}
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Refresh</span>
        </Button>
      </div>

      {isError && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-xs text-danger">
          Could not load analytics summary. Please check your connection and retry.
        </div>
      )}

      {/* Top metrics strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="bg-surface-panel border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-content-secondary">
                  {card.title}
                </CardTitle>
                <Icon className={`w-4 h-4 ${card.color}`} aria-hidden="true" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-7 w-16 mb-1" />
                ) : (
                  <div className="text-2xl font-bold tracking-tight text-content-primary font-mono">
                    {card.value}
                  </div>
                )}
                <p className="text-[11px] text-content-secondary mt-1">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main operational panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Destination Countries / Service Distribution */}
        <Card className="lg:col-span-2 bg-surface-panel border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-content-primary">
                  Service demand & jurisdictions
                </CardTitle>
                <CardDescription className="text-xs text-content-secondary mt-0.5">
                  Residency and business setup demand extracted from inquiries
                </CardDescription>
              </div>
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
                    <span className="font-medium text-content-primary">{item.country}</span>
                    <span className="text-content-secondary font-mono">
                      {item.leadCount} leads ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-base rounded-full h-1.5 overflow-hidden border border-border">
                    <div
                      className="bg-accent h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(item.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-content-secondary text-xs">
                <p className="font-medium text-content-primary">No jurisdiction breakdown yet</p>
                <p className="text-[11px] mt-1">
                  As inbound applicants mention countries and emirates, distributions appear here.
                </p>
              </div>
            )}

            {/* Omnichannel Distribution row */}
            <div className="pt-4 border-t border-border grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-surface-base border border-border flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-content-secondary block">Instagram DM</span>
                  <span className="text-xs font-semibold text-content-primary font-mono">
                    {analytics?.channelBreakdown.find((c) => c.channel === 'instagram')?.conversationCount || 0} chats
                  </span>
                </div>
                <span className="text-[11px] text-success font-medium">Active</span>
              </div>

              <div className="p-3 rounded-md bg-surface-base border border-border flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-content-secondary block">WhatsApp Business</span>
                  <span className="text-xs font-semibold text-content-primary font-mono">
                    {analytics?.channelBreakdown.find((c) => c.channel === 'whatsapp')?.conversationCount || 0} chats
                  </span>
                </div>
                <span className="text-[11px] text-success font-medium">Active</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lead Stages Distribution */}
        <Card className="bg-surface-panel border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-content-primary">
              Lead stages distribution
            </CardTitle>
            <CardDescription className="text-xs text-content-secondary mt-0.5">
              Current lead population across canonical qualification stages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : analytics?.conversionFunnel && analytics.conversionFunnel.length > 0 ? (
              analytics.conversionFunnel.map((step) => (
                <div
                  key={step.stage}
                  className="p-2.5 rounded-md bg-surface-base border border-border flex items-center justify-between"
                >
                  <span className="text-content-primary truncate font-medium text-[11px]">
                    {step.stage}
                  </span>
                  <span className="font-mono font-semibold text-content-primary text-xs shrink-0">
                    {step.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-content-secondary text-xs p-4 text-center">No stage distribution recorded.</p>
            )}

            <div className="pt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5 bg-surface-panel border-border"
                onClick={() => handleNavigate('leads')}
              >
                <span>View leads directory</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
