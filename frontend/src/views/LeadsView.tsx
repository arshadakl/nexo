import * as React from 'react';
import {
  Search,
  ArrowUpDown,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeads } from '@/hooks/useLeads';
import { LeadDrawer } from '@/components/leads/LeadDrawer';
import { humanize, leadLabels } from '@/lib/leadPresentation';
import { absoluteTime } from '@/lib/formatDate';
import { leadsHref, navigate, type WorkspaceRoute } from '@/lib/navigation';
import type { LeadStatus } from '@shared/types/crm.types';

interface LeadsViewProps {
  route?: WorkspaceRoute;
  onNavigateToInbox?: (conversationId?: string) => void;
}

export function LeadsView({ route, onNavigateToInbox }: LeadsViewProps = {}) {
  const selectedLeadId = route?.leadId ?? null;
  const selectedStatus = (route?.leadStatus as LeadStatus | 'all') || 'all';
  const [serviceVertical, setServiceVertical] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState(route?.search || '');
  const [debouncedSearch, setDebouncedSearch] = React.useState(route?.search || '');
  const [sortBy, setSortBy] = React.useState<'recent' | 'status'>('recent');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data: leads,
    isLoading,
    isError,
    refetch,
  } = useLeads({
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    serviceVertical: serviceVertical === 'all' ? undefined : serviceVertical,
    search: debouncedSearch || undefined,
    sortBy,
  });

  const handleSelectLead = (id: string | null) => {
    navigate(
      leadsHref({
        leadId: id,
        status: selectedStatus,
        search: debouncedSearch,
      }),
    );
  };

  const handleStatusFilterChange = (newStatus: string) => {
    navigate(
      leadsHref({
        leadId: selectedLeadId,
        status: newStatus,
        search: debouncedSearch,
      }),
    );
  };

  const toggleSort = () => {
    setSortBy((prev) => (prev === 'recent' ? 'status' : 'recent'));
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      {/* Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" aria-hidden="true" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search enquiries, activities..."
              className="pl-8 h-8 text-xs bg-surface-panel border-border"
              aria-label="Search leads"
            />
          </div>

          {/* Canonical Resider Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface-panel px-2.5 text-xs text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {Object.entries(leadLabels).map(([statusKey, label]) => (
              <option key={statusKey} value={statusKey}>
                {label}
              </option>
            ))}
          </select>

          {/* Service Vertical Filter */}
          <select
            value={serviceVertical}
            onChange={(e) => setServiceVertical(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface-panel px-2.5 text-xs text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label="Filter by service"
          >
            <option value="all">All verticals</option>
            <option value="residency">UAE Residency</option>
            <option value="business_setup">Business Setup</option>
            <option value="both">Residency + Setup</option>
            <option value="unspecified">Unspecified</option>
          </select>

          {/* Sort By Toggle */}
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5 bg-surface-panel border-border"
            onClick={toggleSort}
          >
            <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sort: {sortBy === 'recent' ? 'Most recent' : 'By status'}</span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-content-secondary">
            {leads ? `${leads.length} leads` : 'Loading…'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-content-secondary hover:text-content-primary"
            onClick={() => { void refetch(); }}
            title="Refresh leads"
            aria-label="Refresh leads"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Leads Table Container */}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-surface-panel">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-surface-base border-b border-border text-content-secondary text-[11px] uppercase tracking-wider font-medium">
            <tr>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Vertical & intent</th>
              <th className="px-4 py-2.5">Activity & location</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Missing details</th>
              <th className="px-4 py-2.5">Last active</th>
              <th className="px-4 py-2.5 text-right"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-danger">
                  Could not load leads. Please check your connection and retry.
                </td>
              </tr>
            ) : leads && leads.length > 0 ? (
              leads.map((lead) => {
                const missingCount = lead.missingDetails?.filter(Boolean).length || 0;
                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-surface-hover/70 transition-colors group cursor-pointer"
                    onClick={() => handleSelectLead(lead.id)}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectLead(lead.id);
                        }}
                        className="font-medium text-content-primary hover:text-accent hover:underline text-left block focus:outline-none focus:ring-1 focus:ring-accent rounded"
                      >
                        {lead.fullName || 'Anonymous customer'}
                      </button>
                      {(lead.phoneOrEmail || lead.phoneNumber) && (
                        <div className="text-[11px] text-content-secondary font-mono mt-0.5">
                          {lead.phoneOrEmail || lead.phoneNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-content-primary">
                        {humanize(lead.serviceVertical)}
                      </div>
                      <div className="text-[11px] text-content-secondary">
                        {lead.residencyIntent ? humanize(lead.residencyIntent) : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-content-primary">
                        {lead.workBusinessActivity || 'Pending'}
                      </div>
                      <div className="text-[11px] text-content-secondary">
                        {lead.targetEmirate || humanize(lead.uaeLocationContext)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center text-xs font-medium text-content-primary">
                        {leadLabels[lead.leadStatus]}
                      </span>
                      {lead.statusReason && (
                        <div className="text-[11px] text-content-secondary truncate max-w-[160px] mt-0.5" title={lead.statusReason}>
                          {lead.statusReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {missingCount > 0 ? (
                        <span className="text-[11px] text-warning font-medium">
                          {missingCount} detail{missingCount > 1 ? 's' : ''} missing
                        </span>
                      ) : (
                        <span className="text-[11px] text-success">
                          Complete
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-content-secondary text-[11px]">
                      <time dateTime={new Date(lead.updatedAt).toISOString()}>
                        {absoluteTime(lead.updatedAt)}
                      </time>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-content-secondary group-hover:text-content-primary ml-auto" aria-hidden="true" />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-content-secondary">
                  <p className="font-medium text-sm text-content-primary">No leads found matching your criteria</p>
                  <p className="text-xs mt-1">
                    As inbound customer conversations occur, Resider automatically qualifies and lists profiles here.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-out Lead Drawer */}
      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => handleSelectLead(null)}
        onNavigateToInbox={onNavigateToInbox}
      />
    </div>
  );
}
