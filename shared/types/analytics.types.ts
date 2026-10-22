export interface KPIMetric {
  value: number;
  changeText: string;
}

export interface CountryDistributionItem {
  country: string;
  leadCount: number;
  percentage: number;
}

export interface ChannelBreakdownItem {
  channel: 'instagram' | 'whatsapp';
  conversationCount: number;
  messageCount: number;
}

export interface ConversionFunnelStage {
  stage: string;
  count: number;
}

export interface RecentActivityItem {
  id: string;
  type: 'new_lead' | 'ai_reply' | 'takeover' | 'qualified';
  title: string;
  description: string;
  timestamp: number;
}

export interface AnalyticsOverviewResponse {
  kpis: {
    activeConversations: KPIMetric;
    qualifiedLeads: KPIMetric;
    aiAutoReplies: KPIMetric;
    needsHumanReview: KPIMetric;
  };
  countryDistribution: CountryDistributionItem[];
  channelBreakdown: ChannelBreakdownItem[];
  conversionFunnel: ConversionFunnelStage[];
  recentActivity: RecentActivityItem[];
}

export type ActionQueueKind =
  | 'approval_pending'
  | 'human_requested'
  | 'send_failed'
  | 'qualified_awaiting_contact'
  | 'unanswered';

/** A conversation someone on the team needs to act on, with why and what to do next. */
export interface ActionQueueItem {
  id: string;
  kind: ActionQueueKind;
  conversationId: string;
  customerName: string;
  customerHandle?: string | null;
  channel: 'instagram' | 'whatsapp';
  reason: string;
  nextAction: string;
  at: number;
  qualification?: string | null;
  automationState: string;
}
