import * as React from 'react';
import {
  ArrowUpDown,
  ChevronRight,
  Search,
  Briefcase,
  RefreshCw,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeads } from '@/hooks/useLeads';
import { LeadDrawer } from '@/components/leads/LeadDrawer';
import type { LeadStatus } from '@shared/types/crm.types';

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function getResiderStatusBadgeClass(status: LeadStatus): string {
  switch (status) {
    case 'ready_for_team':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'handed_over':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    case 'handover_requested':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'exploring':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'needs_clarification':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'support_enquiry':
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    case 'outside_scope_spam':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

interface LeadsViewProps {
  onNavigateToInbox?: (conversationId?: string) => void;
}

export function LeadsView({ onNavigateToInbox }: LeadsViewProps = {}) {
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = React.useState<LeadStatus | 'all'>('all');
  const [serviceVertical, setServiceVertical] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'recent' | 'status'>('recent');

  const {
    data: leads,
    isLoading,
    refetch,
  } = useLeads({
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    serviceVertical: serviceVertical === 'all' ? undefined : serviceVertical,
    search: searchQuery || undefined,
    sortBy,
  });

  const toggleSort = () => {
    setSortBy((prev) => (prev === 'recent' ? 'status' : 'recent'));
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search enquiries, activities..."
              className="pl-8 h-8 text-xs bg-card"
            />
          </div>

          {/* Canonical Resider Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="ready_for_team">Ready for Team</option>
            <option value="handover_requested">Handover Requested</option>
            <option value="handed_over">Handed Over</option>
            <option value="exploring">Exploring Options</option>
            <option value="needs_clarification">Needs Clarification</option>
            <option value="support_enquiry">Support Enquiry</option>
            <option value="outside_scope_spam">Outside Scope / Spam</option>
          </select>

          {/* Service Vertical Filter */}
          <select
            value={serviceVertical}
            onChange={(e) => setServiceVertical(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Verticals</option>
            <option value="residency">UAE Residency</option>
            <option value="business_setup">Business Setup</option>
            <option value="both">Residency + Setup</option>
            <option value="unspecified">Unspecified</option>
          </select>

          {/* Sort By Toggle */}
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5 bg-card"
            onClick={toggleSort}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort: {sortBy === 'recent' ? 'Most Recent' : 'By Status'}</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">
            {leads ? `${leads.length} leads` : 'Loading...'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground"
            onClick={() => refetch()}
            title="Refresh Leads"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Leads Table */}
      <Card className="overflow-hidden shadow-xl border-border/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-3 font-semibold">Customer</th>
                <th className="px-6 py-3 font-semibold">Vertical & Intent</th>
                <th className="px-6 py-3 font-semibold">Activity & Location</th>
                <th className="px-6 py-3 font-semibold">Resider Status</th>
                <th className="px-6 py-3 font-semibold">Missing Details</th>
                <th className="px-6 py-3 font-semibold">Last Active</th>
                <th className="px-6 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Skeleton className="h-4 w-8 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : leads && leads.length > 0 ? (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className="hover:bg-secondary/20 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {lead.fullName || 'Anonymous Customer'}
                      </div>
                      {(lead.phoneOrEmail || lead.phoneNumber) && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {lead.phoneOrEmail || lead.phoneNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground flex items-center gap-1.5 capitalize">
                        <Briefcase className="w-3.5 h-3.5 text-primary/80" />
                        <span>{lead.serviceVertical.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground capitalize">
                        {lead.residencyIntent ? lead.residencyIntent.replace(/_/g, ' ') : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>{lead.workBusinessActivity || 'Pending'}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground capitalize">
                        {lead.targetEmirate || lead.uaeLocationContext.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border capitalize ${getResiderStatusBadgeClass(
                          lead.leadStatus
                        )}`}
                      >
                        {lead.leadStatus.replace(/_/g, ' ')}
                      </span>
                      {lead.statusReason && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[160px] mt-0.5" title={lead.statusReason}>
                          {lead.statusReason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {lead.missingDetails && lead.missingDetails.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {lead.missingDetails.slice(0, 2).map((item) => (
                            <span
                              key={item}
                              className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 capitalize"
                            >
                              {item.replace(/_/g, ' ')}
                            </span>
                          ))}
                          {lead.missingDetails.length > 2 && (
                            <span className="text-[9px] text-muted-foreground">
                              +{lead.missingDetails.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Complete
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatRelativeTime(lead.updatedAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <p className="font-medium text-xs">No leads found matching your criteria</p>
                    <p className="text-[11px] opacity-70 mt-1">
                      As inbound customer conversations occur, Resider AI automatically qualifies and lists profiles here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Slide-out Lead Drawer */}
      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onNavigateToInbox={onNavigateToInbox}
      />
    </div>
  );
}
