import { describe, it, expect, vi } from 'vitest';
import { analyticsService } from '../worker/services/analyticsService';

describe('AnalyticsService Overview Metrics', () => {
  it('queries D1 correctly with lead_status and produces formatted overview response', async () => {
    const executedQueries: string[] = [];

    const mockDb = {
      prepare: vi.fn((sql: string) => {
        executedQueries.push(sql);
        return {
          bind: vi.fn(() => ({
            first: vi.fn(async () => {
              if (sql.includes('conversations')) {
                return { total_convos: 10, takeover_convos: 2, unread_convos: 1 };
              }
              if (sql.includes('leads')) {
                return {
                  total_leads: 5,
                  qualified_leads: 2,
                  review_leads: 1,
                  clarification_leads: 1,
                  exploring_leads: 1,
                  ready_leads: 2,
                  handed_over_leads: 0,
                  support_leads: 1,
                };
              }
              if (sql.includes('messages')) {
                return { ai_count: 25 };
              }
              return null;
            }),
            all: vi.fn(async () => {
              if (sql.includes('target_emirate')) {
                return {
                  results: [
                    { category: 'Dubai', cnt: 3 },
                    { category: 'residency', cnt: 2 },
                  ],
                };
              }
              if (sql.includes('channel')) {
                return {
                  results: [
                    { channel: 'instagram', convo_cnt: 7 },
                    { channel: 'whatsapp', convo_cnt: 3 },
                  ],
                };
              }
              if (sql.includes('recentLeads') || sql.includes('ORDER BY updated_at')) {
                return {
                  results: [
                    {
                      id: 'lead_1',
                      full_name: 'Zayed',
                      service_vertical: 'residency',
                      lead_status: 'ready_for_team',
                      updated_at: 1700000000000,
                    },
                  ],
                };
              }
              return { results: [] };
            }),
          })),
        };
      }),
    } as any;

    const metrics = await analyticsService.getOverviewMetrics(mockDb, 'tenant_1');

    // Verify no leads query uses standalone 'status' as a column
    const leadsQueries = executedQueries.filter((q) => q.includes('FROM leads'));
    expect(leadsQueries.length).toBe(3);
    for (const query of leadsQueries) {
      expect(query).not.toMatch(/\bstatus\s*IN\b/);
      expect(query).not.toMatch(/\bstatus\s*=\b/);
      expect(query).not.toMatch(/,\s*status\s*,/);
    }
    expect(leadsQueries[0]).toContain('lead_status');
    expect(leadsQueries[2]).toContain('lead_status');

    // Verify KPIs
    expect(metrics.kpis.activeConversations.value).toBe(10);
    expect(metrics.kpis.qualifiedLeads.value).toBe(2);
    expect(metrics.kpis.aiAutoReplies.value).toBe(25);
    expect(metrics.kpis.needsHumanReview.value).toBe(3); // review_leads (1) + takeoverConvos (2)

    // Verify Funnel
    expect(metrics.conversionFunnel).toHaveLength(5);
    expect(metrics.recentActivity[0].type).toBe('qualified');
    expect(metrics.recentActivity[0].title).toContain('ready for team');
  });
});
