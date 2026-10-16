import * as React from 'react';
import {
  ArrowUpDown,
  ChevronRight,
  Search,
  Globe,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

function getScoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
}

function getStatusBadgeVariant(status: LeadStatus) {
  switch (status) {
    case 'qualified':
    case 'converted':
      return 'success';
    case 'needs_human_review':
      return 'warning';
    case 'unqualified':
    case 'closed_lost':
      return 'destructive';
    default:
      return 'secondary';
  }
}

interface LeadsViewProps {
  onNavigateToInbox?: (conversationId?: string) => void;
}

export function LeadsView({ onNavigateToInbox }: LeadsViewProps = {}) {
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = React.useState<LeadStatus | 'all'>('all');
  const [destinationCountry, setDestinationCountry] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'score' | 'recent'>('score');

  const {
    data: leads,
    isLoading,
    refetch,
  } = useLeads({
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    destinationCountry: destinationCountry === 'all' ? undefined : destinationCountry,
    search: searchQuery || undefined,
    sortBy,
  });

  const toggleSort = () => {
    setSortBy((prev) => (prev === 'score' ? 'recent' : 'score'));
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
              placeholder="Search leads, countries..."
              className="pl-8 h-8 text-xs bg-card"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Stages</option>
            <option value="new">New Inquiry</option>
            <option value="collecting_information">Collecting Details</option>
            <option value="qualified">Qualified Hot Lead</option>
            <option value="consultation_booked">Consultation Booked</option>
            <option value="converted">Client Converted</option>
            <option value="needs_human_review">Needs Review</option>
            <option value="unqualified">Unqualified</option>
          </select>

          {/* Country Filter */}
          <select
            value={destinationCountry}
            onChange={(e) => setDestinationCountry(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Destinations</option>
            <option value="Germany">Germany</option>
            <option value="Canada">Canada</option>
            <option value="UK">United Kingdom</option>
            <option value="Australia">Australia</option>
            <option value="USA">United States</option>
          </select>

          {/* Sort By Score Toggle */}
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5 bg-card"
            onClick={toggleSort}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort: {sortBy === 'score' ? 'Top Score' : 'Most Recent'}</span>
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
                <th className="px-6 py-3 font-semibold">Applicant</th>
                <th className="px-6 py-3 font-semibold">Destination & Category</th>
                <th className="px-6 py-3 font-semibold">Commercial Score</th>
                <th className="px-6 py-3 font-semibold">Pipeline Stage</th>
                <th className="px-6 py-3 font-semibold">Budget & Timeline</th>
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
                      <Skeleton className="h-4 w-16" />
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
                        {lead.fullName || 'Anonymous Applicant'}
                      </div>
                      {lead.phoneOrEmail && (
                        <div className="text-[10px] text-muted-foreground">{lead.phoneOrEmail}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-primary/80" />
                        <span>{lead.destinationCountry || 'Not Specified'}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {lead.visaCategory || 'Consultation Inquiry'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] border ${getScoreBadgeClass(
                          lead.leadScore
                        )}`}
                      >
                        {lead.leadScore} / 100
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={getStatusBadgeVariant(lead.leadStatus) as any}
                        className="text-[10px] capitalize"
                      >
                        {lead.leadStatus.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-foreground">{lead.budgetRange || '—'}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {lead.timeline || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatRelativeTime(lead.updatedAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 group-hover:bg-primary/10">
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <Sparkles className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    <p className="text-xs font-medium">No leads found</p>
                    <p className="text-[11px] opacity-70">
                      As inbound conversations are qualified by Nexo AI, leads will populate here with scores.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Slide-over Lead Detail Drawer */}
      {selectedLeadId && (
        <LeadDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onNavigateToInbox={onNavigateToInbox}
        />
      )}
    </div>
  );
}
