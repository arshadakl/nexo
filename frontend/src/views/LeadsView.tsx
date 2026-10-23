import * as React from 'react';
import {
  Search,
  ArrowUpDown,
  RefreshCw,
  ChevronRight,
  Flame,
  Users,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  MessageCircle,
  CalendarClock,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { useLeads } from '@/hooks/useLeads';
import { LeadModal } from '@/components/leads/LeadModal';
import { leadLabels, qualificationLabels } from '@/lib/leadPresentation';
import { relativeTime, absoluteTime } from '@/lib/formatDate';
import { leadsHref, navigate, type WorkspaceRoute } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { Lead, LeadStatus } from '@shared/types/crm.types';

interface LeadsViewProps {
  route?: WorkspaceRoute;
  onNavigateToInbox?: (conversationId?: string) => void;
}

const serviceOptions = [
  { value: 'all', label: 'All services' },
  { value: 'residency', label: 'Residency' },
  { value: 'business_setup', label: 'Business setup' },
  { value: 'both', label: 'Residency + setup' },
  { value: 'unspecified', label: 'Not yet clear' },
];

const serviceChip: Record<string, { label: string; className: string }> = {
  residency: { label: 'Residency', className: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  business_setup: { label: 'Business setup', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  both: { label: 'Residency + setup', className: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300' },
  unspecified: { label: 'Service not clear', className: 'bg-surface-hover text-content-secondary' },
};

const qualificationStyle: Record<string, string> = {
  hot: 'bg-rose-500 text-white',
  warm: 'bg-amber-400 text-amber-950',
  cold: 'bg-sky-500 text-white',
  unknown: 'bg-surface-hover text-content-secondary',
  outside_scope: 'bg-surface-hover text-content-muted',
};

function statusStyle(status: LeadStatus) {
  if (status === 'ready_for_team' || status === 'handed_over') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (status === 'handover_requested' || status === 'support_enquiry') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  if (status === 'outside_scope_request' || status === 'outside_scope_spam') return 'bg-surface-hover text-content-muted';
  return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300';
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
    isFetching,
    refetch,
  } = useLeads({
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    serviceVertical: serviceVertical === 'all' ? undefined : serviceVertical,
    search: debouncedSearch || undefined,
    sortBy,
  });

  const handleSelectLead = (id: string | null) => {
    navigate(leadsHref({ leadId: id, status: selectedStatus, search: debouncedSearch }));
  };

  const handleStatusFilterChange = (newStatus: string) => {
    navigate(leadsHref({ leadId: selectedLeadId, status: newStatus, search: debouncedSearch }));
  };

  const list = leads ?? [];
  const stats = [
    { label: 'Leads', value: list.length, Icon: Users, className: 'from-indigo-500 to-violet-500' },
    { label: 'Hot', value: list.filter((l) => l.qualification === 'hot').length, Icon: Flame, className: 'from-rose-500 to-orange-400' },
    { label: 'Ready for team', value: list.filter((l) => l.leadStatus === 'ready_for_team').length, Icon: CheckCircle2, className: 'from-emerald-500 to-teal-400' },
    {
      label: 'Needs a person',
      value: list.filter((l) => l.leadStatus === 'handover_requested' || l.leadStatus === 'support_enquiry').length,
      Icon: AlertTriangle,
      className: 'from-amber-500 to-yellow-400',
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-content-primary">Leads</h2>
          <p className="text-xs text-content-secondary">
            Everyone who messaged Resider, with what they need and what to do next.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 rounded-full"
          onClick={() => {
            void refetch();
          }}
          aria-label="Refresh leads"
        >
          <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Summary cards (counts of the leads currently shown) */}
      <div className="grid shrink-0 grid-cols-2 gap-2.5 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn('flex items-center gap-3 rounded-2xl bg-gradient-to-br p-3 text-white shadow-sm', stat.className)}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <stat.Icon aria-hidden="true" className="size-4.5" />
            </span>
            <div className="min-w-0">
              <div className="text-xl font-bold leading-6 tabular-nums">{isLoading ? '…' : stat.value}</div>
              <div className="truncate text-[11px] font-medium text-white/85">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search, service and sort */}
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, activity, country…"
            className="h-10 rounded-full border-transparent bg-surface-hover pl-10 text-sm"
            aria-label="Search leads"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={serviceVertical}
            onChange={(e) => setServiceVertical(e.target.value)}
            className="h-10 rounded-full border border-border bg-surface-panel px-3 text-xs font-medium text-content-primary"
            aria-label="Filter by service"
          >
            {serviceOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            className="h-10 gap-1.5 rounded-full text-xs"
            onClick={() => setSortBy((prev) => (prev === 'recent' ? 'status' : 'recent'))}
          >
            <ArrowUpDown className="size-3.5" aria-hidden="true" />
            {sortBy === 'recent' ? 'Most recent' : 'By status'}
          </Button>
        </div>
      </div>

      {/* Status chips */}
      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by status">
        {[['all', 'All'] as const, ...Object.entries(leadLabels)].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={selectedStatus === value}
            onClick={() => handleStatusFilterChange(value)}
            className={cn(
              'h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors',
              selectedStatus === value
                ? 'brand-gradient text-white shadow-sm'
                : 'bg-surface-hover text-content-secondary hover:text-content-primary',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lead cards */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {isLoading ? (
          <div className="space-y-2" role="status">
            <span className="sr-only">Loading leads</span>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-sm text-danger">
            Could not load leads. Please check your connection and retry.
          </div>
        ) : list.length > 0 ? (
          <ul className="space-y-2">
            {list.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onOpen={() => handleSelectLead(lead.id)} />
            ))}
          </ul>
        ) : (
          <div className="brand-gradient-soft rounded-2xl p-10 text-center">
            <span className="brand-gradient mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl text-white">
              <Users aria-hidden="true" className="size-6" />
            </span>
            <p className="text-sm font-semibold text-content-primary">No leads match these filters</p>
            <p className="mt-1 text-xs text-content-secondary">
              As customers message on Instagram or WhatsApp, Resider qualifies them and lists them here.
            </p>
          </div>
        )}
      </div>

      <LeadModal leadId={selectedLeadId} onClose={() => handleSelectLead(null)} onNavigateToInbox={onNavigateToInbox} />
    </div>
  );
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const qualification = lead.qualification || 'unknown';
  const service = serviceChip[lead.serviceVertical] ?? serviceChip.unspecified!;
  const location = [lead.currentCity, lead.currentCountry].filter(Boolean).join(', ') || lead.currentLocation;
  const phone = lead.phoneOrEmail || lead.phoneNumber;
  const whatsapp = lead.whatsappSameAsPhone && phone ? phone : lead.whatsappNumber;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-start gap-3 rounded-2xl border border-border bg-surface-panel p-3.5 text-left shadow-sm transition hover:border-violet-400/50 hover:shadow-md sm:items-center sm:gap-4"
      >
        <Avatar name={lead.fullName} size="md" />
        <div className="min-w-0 flex-1 space-y-2 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-4 lg:space-y-0">
          {/* Who */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[15px] font-semibold text-content-primary">
                {lead.fullName || 'Name not shared yet'}
              </span>
              {qualification !== 'unknown' && (
                <span
                  className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', qualificationStyle[qualification])}
                  title={lead.qualificationReason || undefined}
                >
                  {qualificationLabels[qualification]}
                </span>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-content-secondary">
              <Briefcase aria-hidden="true" className="size-3 shrink-0" />
              {lead.profession || lead.workBusinessActivity || 'Work not shared yet'}
              {lead.nationality ? ` · ${lead.nationality}` : ''}
            </p>
          </div>

          {/* What they need */}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', service.className)}>{service.label}</span>
            <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', statusStyle(lead.leadStatus))}>
              {leadLabels[lead.leadStatus]}
            </span>
            {lead.summary && (
              <p className="basis-full truncate text-xs text-content-secondary" title={lead.summary}>
                {lead.summary}
              </p>
            )}
          </div>

          {/* Where, when, contact */}
          <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 text-xs text-content-secondary sm:grid-cols-2 lg:grid-cols-1">
            <span className="flex min-w-0 items-center gap-1">
              <MapPin aria-hidden="true" className="size-3 shrink-0 text-rose-500" />
              <span className="truncate">
                {location || 'Location unknown'}
                {lead.targetEmirate ? ` → ${lead.targetEmirate}` : ''}
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <CalendarClock aria-hidden="true" className="size-3 shrink-0 text-violet-500" />
              <span className="truncate">{lead.timeline || 'Timing not set'}</span>
            </span>
            {phone ? (
              <span className="flex min-w-0 items-center gap-1 font-mono">
                {whatsapp ? (
                  <MessageCircle aria-hidden="true" className="size-3 shrink-0 text-[#25D366]" />
                ) : (
                  <Phone aria-hidden="true" className="size-3 shrink-0 text-sky-500" />
                )}
                <span className="truncate">{phone}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Phone aria-hidden="true" className="size-3 shrink-0" />
                {lead.contactPending ? 'Contact declined' : 'No number yet'}
              </span>
            )}
          </div>

          {/* Next step */}
          <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-end">
            <span className="truncate text-[11px] text-content-muted lg:max-w-[12rem]" title={lead.nextAction || undefined}>
              {lead.nextAction ? `Next: ${lead.nextAction}` : ''}
            </span>
            <time
              dateTime={new Date(lead.updatedAt).toISOString()}
              title={absoluteTime(lead.updatedAt)}
              className="shrink-0 text-[11px] text-content-muted"
            >
              {relativeTime(lead.updatedAt)}
            </time>
          </div>
        </div>
        <ChevronRight
          className="mt-3 size-4 shrink-0 text-content-muted transition group-hover:translate-x-0.5 group-hover:text-violet-500 sm:mt-0"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}
