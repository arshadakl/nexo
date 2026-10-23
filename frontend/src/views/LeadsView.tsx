import * as React from 'react';
import {
  Search,
  ArrowUpDown,
  RefreshCw,
  Users,
  List,
  KanbanSquare,
  SlidersHorizontal,
  MessageCircle,
  Phone,
  ChevronDown,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { useLeads, useMoveLeadStage } from '@/hooks/useLeads';
import { LeadModal } from '@/components/leads/LeadModal';
import { humanize, leadLabels, qualificationLabels } from '@/lib/leadPresentation';
import { relativeTime, absoluteTime } from '@/lib/formatDate';
import { leadsHref, navigate, type WorkspaceRoute } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { Lead, LeadQualification, LeadStatus } from '@shared/types/crm.types';

interface LeadsViewProps {
  route?: WorkspaceRoute;
  onNavigateToInbox?: (conversationId?: string) => void;
}

type SortKey = 'updated' | 'name' | 'stage' | 'qualification';
type ViewMode = 'list' | 'kanban';

const sortLabels: Record<SortKey, string> = {
  updated: 'Last activity · newest',
  name: 'Name · A–Z',
  stage: 'Stage',
  qualification: 'Lead · hot first',
};

/** Stage order used for sorting and Kanban columns. */
const STAGES: LeadStatus[] = [
  'needs_clarification',
  'exploring',
  'ready_for_team',
  'handover_requested',
  'support_enquiry',
  'handed_over',
  'outside_scope_request',
  'outside_scope_spam',
];

const stageDot: Record<LeadStatus, string> = {
  needs_clarification: 'bg-orange-500',
  exploring: 'bg-sky-500',
  ready_for_team: 'bg-emerald-500',
  handover_requested: 'bg-rose-500',
  support_enquiry: 'bg-cyan-500',
  handed_over: 'bg-violet-500',
  outside_scope_request: 'bg-slate-400',
  outside_scope_spam: 'bg-slate-400',
};

const qualificationDot: Record<LeadQualification, string> = {
  hot: 'bg-rose-500',
  warm: 'bg-amber-400',
  cold: 'bg-sky-400',
  unknown: 'bg-slate-300 dark:bg-slate-600',
  outside_scope: 'bg-slate-300 dark:bg-slate-600',
};
const qualificationRank: Record<string, number> = { hot: 0, warm: 1, cold: 2, unknown: 3, outside_scope: 4 };

const serviceLabels: Record<string, string> = {
  residency: 'Residency',
  business_setup: 'Business setup',
  both: 'Residency + setup',
  unspecified: '—',
};

const selectClass =
  'h-9 max-w-[11.5rem] cursor-pointer appearance-none truncate rounded-lg border border-border bg-surface-panel pl-3 pr-8 text-[13px] font-medium text-content-primary hover:bg-surface-hover';

function Dropdown({
  label,
  value,
  onChange,
  children,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <label className="relative inline-flex shrink-0 items-center">
      {icon && <span className="pointer-events-none absolute left-2.5 text-content-secondary">{icon}</span>}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(selectClass, icon && 'pl-8')}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 size-3.5 text-content-muted" />
    </label>
  );
}

function StageBadge({ status }: { status: LeadStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-content-primary">
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-[3px]', stageDot[status])} />
      {leadLabels[status]}
    </span>
  );
}

function QualificationBadge({ value, reason }: { value: LeadQualification; reason?: string | null | undefined }) {
  if (value === 'unknown') return <span className="text-[13px] text-content-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium" title={reason || undefined}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', qualificationDot[value])} />
      {qualificationLabels[value]}
    </span>
  );
}

function ContactCell({ lead }: { lead: Lead }) {
  const phone = lead.phoneOrEmail || lead.phoneNumber;
  if (!phone) {
    return <span className="text-content-muted">{lead.contactPending ? 'Declined' : '—'}</span>;
  }
  const onWhatsApp = Boolean(lead.whatsappSameAsPhone || lead.whatsappNumber);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      {onWhatsApp ? (
        <MessageCircle aria-label="On WhatsApp" className="size-3.5 text-[#25D366]" />
      ) : (
        <Phone aria-hidden="true" className="size-3.5 text-content-muted" />
      )}
      {phone}
    </span>
  );
}

export function LeadsView({ route, onNavigateToInbox }: LeadsViewProps = {}) {
  const selectedLeadId = route?.leadId ?? null;
  const selectedStatus = (route?.leadStatus as LeadStatus | 'all') || 'all';
  const [view, setView] = React.useState<ViewMode>(() => {
    try {
      return localStorage.getItem('resider-leads-view') === 'kanban' ? 'kanban' : 'list';
    } catch {
      return 'list';
    }
  });
  const [serviceVertical, setServiceVertical] = React.useState<string>('all');
  const [qualification, setQualification] = React.useState<string>('all');
  const [sortKey, setSortKey] = React.useState<SortKey>('updated');
  const [searchQuery, setSearchQuery] = React.useState(route?.search || '');
  const [debouncedSearch, setDebouncedSearch] = React.useState(route?.search || '');
  const [showFilters, setShowFilters] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem('resider-leads-view', next);
    } catch {}
  };

  const { data: leads, isLoading, isError, isFetching, refetch } = useLeads({
    // Kanban shows every stage as a column, so the stage filter applies to the list only.
    status: view === 'list' && selectedStatus !== 'all' ? selectedStatus : undefined,
    serviceVertical: serviceVertical === 'all' ? undefined : serviceVertical,
    search: debouncedSearch || undefined,
    sortBy: 'recent',
  });

  const rows = React.useMemo(() => {
    const filtered = (leads ?? []).filter(
      (lead) => qualification === 'all' || (lead.qualification || 'unknown') === qualification,
    );
    const sorted = [...filtered];
    if (sortKey === 'name') sorted.sort((a, b) => (a.fullName || '~').localeCompare(b.fullName || '~'));
    else if (sortKey === 'stage') sorted.sort((a, b) => STAGES.indexOf(a.leadStatus) - STAGES.indexOf(b.leadStatus));
    else if (sortKey === 'qualification')
      sorted.sort((a, b) => (qualificationRank[a.qualification || 'unknown'] ?? 9) - (qualificationRank[b.qualification || 'unknown'] ?? 9));
    else sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted;
  }, [leads, qualification, sortKey]);

  const openLead = (id: string | null) =>
    navigate(leadsHref({ leadId: id, status: selectedStatus, search: debouncedSearch }));
  const setStage = (status: string) =>
    navigate(leadsHref({ leadId: selectedLeadId, status, search: debouncedSearch }));

  const activeFilters =
    (selectedStatus !== 'all' && view === 'list' ? 1 : 0) + (serviceVertical !== 'all' ? 1 : 0) + (qualification !== 'all' ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-surface-panel">
      {/* Title + view tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-4 sm:px-6">
        <h2 className="mr-3 flex items-center gap-2 py-3 text-[15px] font-semibold text-content-primary">
          <span className="brand-gradient flex size-6 items-center justify-center rounded-md text-white">
            <Users aria-hidden="true" className="size-3.5" />
          </span>
          Leads
        </h2>
        <div role="tablist" aria-label="Leads view" className="flex items-stretch self-stretch">
          {(
            [
              { key: 'list', label: 'All leads', Icon: List, color: 'text-emerald-600 dark:text-emerald-400' },
              { key: 'kanban', label: 'Kanban', Icon: KanbanSquare, color: 'text-amber-600 dark:text-amber-400' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={view === tab.key}
              onClick={() => changeView(tab.key)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 text-[13px] font-medium',
                view === tab.key ? 'text-content-primary' : 'text-content-secondary hover:text-content-primary',
              )}
            >
              <tab.Icon aria-hidden="true" className={cn('size-4', tab.color)} />
              {tab.label}
              {view === tab.key && (
                <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-content-primary" />
              )}
            </button>
          ))}
        </div>
        <span className="ml-auto hidden text-xs text-content-secondary sm:inline">
          {leads ? `${rows.length} of ${leads.length}` : ''}
        </span>
        <button
          type="button"
          onClick={() => void refetch()}
          aria-label="Refresh leads"
          className="ml-2 flex size-9 items-center justify-center rounded-lg text-content-secondary hover:bg-surface-hover sm:ml-3"
        >
          <RefreshCw aria-hidden="true" className={cn('size-4', isFetching && 'animate-spin')} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 sm:px-6">
        <div className="relative w-full sm:w-56">
          <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-content-muted" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search leads"
            className="h-9 w-full rounded-lg border border-border bg-surface-panel pl-8 pr-3 text-[13px] text-content-primary placeholder:text-content-muted"
          />
        </div>
        <Dropdown
          label="Sort leads"
          value={sortKey}
          onChange={(v) => setSortKey(v as SortKey)}
          icon={<ArrowUpDown className="size-3.5 text-emerald-600 dark:text-emerald-400" />}
        >
          {Object.entries(sortLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Dropdown>
        <button
          type="button"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium',
            activeFilters > 0
              ? 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300'
              : 'border-border bg-surface-panel text-content-primary hover:bg-surface-hover',
          )}
        >
          <SlidersHorizontal aria-hidden="true" className="size-3.5" />
          Filters{activeFilters > 0 ? ` · ${activeFilters}` : ''}
        </button>
        <div className={cn('flex flex-wrap items-center gap-2', !showFilters && 'hidden md:flex')}>
          {view === 'list' && (
            <Dropdown label="Filter by stage" value={selectedStatus} onChange={setStage}>
              <option value="all">Stage: all</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {leadLabels[s]}
                </option>
              ))}
            </Dropdown>
          )}
          <Dropdown label="Filter by service" value={serviceVertical} onChange={setServiceVertical}>
            <option value="all">Service: all</option>
            <option value="residency">Residency</option>
            <option value="business_setup">Business setup</option>
            <option value="both">Residency + setup</option>
            <option value="unspecified">Not yet clear</option>
          </Dropdown>
          <Dropdown label="Filter by lead qualification" value={qualification} onChange={setQualification}>
            <option value="all">Lead: all</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
            <option value="unknown">Unknown</option>
          </Dropdown>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={() => {
                setServiceVertical('all');
                setQualification('all');
                if (selectedStatus !== 'all') setStage('all');
              }}
              className="h-9 rounded-lg px-2 text-[13px] text-content-secondary hover:text-content-primary"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div role="status" className="space-y-px p-4 sm:px-6">
            <span className="sr-only">Loading leads</span>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p role="alert" className="m-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            Could not load leads. Please check your connection and retry.
          </p>
        ) : view === 'kanban' ? (
          <KanbanBoard leads={rows} onOpen={openLead} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="brand-gradient flex size-11 items-center justify-center rounded-xl text-white">
              <Users aria-hidden="true" className="size-5" />
            </span>
            <p className="text-sm font-semibold text-content-primary">No leads match these filters</p>
            <p className="max-w-sm text-xs text-content-secondary">
              As customers message on Instagram or WhatsApp, Resider qualifies them and lists them here.
            </p>
          </div>
        ) : (
          <>
            <LeadTable leads={rows} onOpen={openLead} />
            <LeadMobileList leads={rows} onOpen={openLead} />
          </>
        )}
      </div>

      <LeadModal leadId={selectedLeadId} onClose={() => openLead(null)} onNavigateToInbox={onNavigateToInbox} />
    </div>
  );
}

const th = 'whitespace-nowrap border-b border-r border-border px-3 py-2.5 text-left text-[12px] font-medium text-content-secondary last:border-r-0';
const td = 'whitespace-nowrap border-b border-r border-border px-3 py-2.5 text-[13px] text-content-primary last:border-r-0';

function LeadTable({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  return (
    <table className="hidden w-full min-w-[1100px] border-separate border-spacing-0 md:table">
      <thead className="sticky top-0 z-10 bg-surface-panel">
        <tr>
          <th className={cn(th, 'w-12 text-center')}>No</th>
          <th className={cn(th, 'sticky left-0 z-10 min-w-56 bg-surface-panel')}>Name</th>
          <th className={th}>Title</th>
          <th className={th}>Stage</th>
          <th className={th}>Lead</th>
          <th className={th}>Service</th>
          <th className={th}>Mobile</th>
          <th className={th}>Location</th>
          <th className={th}>Emirate</th>
          <th className={th}>Timing</th>
          <th className={th}>Next action</th>
          <th className={th}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead, index) => {
          const location = [lead.currentCity, lead.currentCountry].filter(Boolean).join(', ') || lead.currentLocation;
          return (
            <tr
              key={lead.id}
              onClick={() => onOpen(lead.id)}
              className="group cursor-pointer hover:bg-surface-hover/60"
            >
              <td className={cn(td, 'text-center tabular-nums text-content-muted')}>{leads.length - index}</td>
              <td className={cn(td, 'sticky left-0 bg-surface-panel group-hover:bg-surface-hover')}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(lead.id);
                  }}
                  className="flex max-w-64 items-center gap-2.5 text-left font-medium hover:underline"
                >
                  <Avatar name={lead.fullName} size="sm" />
                  <span className="truncate">{lead.fullName || 'Name not shared'}</span>
                </button>
              </td>
              <td className={cn(td, 'max-w-48 truncate')}>{lead.profession || lead.workBusinessActivity || <span className="text-content-muted">—</span>}</td>
              <td className={td}>
                <StageBadge status={lead.leadStatus} />
              </td>
              <td className={td}>
                <QualificationBadge value={lead.qualification || 'unknown'} reason={lead.qualificationReason} />
              </td>
              <td className={td}>{serviceLabels[lead.serviceVertical] ?? humanize(lead.serviceVertical)}</td>
              <td className={td}>
                <ContactCell lead={lead} />
              </td>
              <td className={cn(td, 'max-w-44 truncate')}>{location || <span className="text-content-muted">—</span>}</td>
              <td className={td}>{lead.targetEmirate || <span className="text-content-muted">—</span>}</td>
              <td className={cn(td, 'max-w-36 truncate')}>{lead.timeline || <span className="text-content-muted">—</span>}</td>
              <td className={cn(td, 'max-w-60 truncate text-content-secondary')} title={lead.nextAction || undefined}>
                {lead.nextAction || <span className="text-content-muted">—</span>}
              </td>
              <td className={cn(td, 'text-content-secondary')}>
                <time dateTime={new Date(lead.updatedAt).toISOString()} title={absoluteTime(lead.updatedAt)}>
                  {relativeTime(lead.updatedAt)}
                </time>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LeadMobileList({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  return (
    <ul className="divide-y divide-border md:hidden">
      {leads.map((lead) => (
        <li key={lead.id}>
          <button
            type="button"
            onClick={() => onOpen(lead.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover/60"
          >
            <Avatar name={lead.fullName} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[14px] font-semibold text-content-primary">
                  {lead.fullName || 'Name not shared'}
                </span>
                <span className="shrink-0 text-[11px] text-content-muted">{relativeTime(lead.updatedAt)}</span>
              </div>
              <p className="truncate text-xs text-content-secondary">
                {lead.profession || lead.workBusinessActivity || serviceLabels[lead.serviceVertical]}
                {lead.targetEmirate ? ` · ${lead.targetEmirate}` : ''}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <StageBadge status={lead.leadStatus} />
                <QualificationBadge value={lead.qualification || 'unknown'} reason={lead.qualificationReason} />
                {(lead.phoneOrEmail || lead.phoneNumber) && (
                  <span className="text-xs text-content-secondary">
                    <ContactCell lead={lead} />
                  </span>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function KanbanBoard({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  const move = useMoveLeadStage();
  const [dragOver, setDragOver] = React.useState<LeadStatus | null>(null);
  const columns = STAGES.filter(
    (stage) => stage !== 'outside_scope_spam' || leads.some((l) => l.leadStatus === stage),
  );

  return (
    <div className="flex h-full min-h-[420px] gap-3 overflow-x-auto p-4 sm:px-6">
      {columns.map((stage) => {
        const items = leads.filter((l) => l.leadStatus === stage);
        return (
          <section
            key={stage}
            aria-label={`${leadLabels[stage]} column`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(stage);
            }}
            onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const leadId = e.dataTransfer.getData('text/lead-id');
              const lead = leads.find((l) => l.id === leadId);
              if (lead && lead.leadStatus !== stage) move.mutate({ leadId, leadStatus: stage });
            }}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-xl bg-surface-base p-2 transition-colors',
              dragOver === stage && 'bg-violet-500/10 ring-2 ring-violet-500/40',
            )}
          >
            <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
              <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', stageDot[stage])} />
              <h3 className="text-[13px] font-semibold text-content-primary">{leadLabels[stage]}</h3>
              <span className="ml-auto rounded-full bg-surface-hover px-2 text-[11px] font-medium text-content-secondary">
                {items.length}
              </span>
            </header>
            <ul className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto">
              {items.map((lead) => (
                <li
                  key={lead.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/lead-id', lead.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(lead.id)}
                    className="w-full cursor-grab rounded-lg border border-border bg-surface-panel p-3 text-left shadow-sm transition hover:border-violet-400/50 hover:shadow active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={lead.fullName} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-content-primary">
                        {lead.fullName || 'Name not shared'}
                      </span>
                      <QualificationBadge value={lead.qualification || 'unknown'} reason={lead.qualificationReason} />
                    </div>
                    <p className="mt-1.5 truncate text-xs text-content-secondary">
                      {lead.profession || lead.workBusinessActivity || '—'}
                      {lead.nationality ? ` · ${lead.nationality}` : ''}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-content-secondary">
                      <span className="truncate rounded-md bg-surface-hover px-1.5 py-0.5">
                        {serviceLabels[lead.serviceVertical] === '—' ? 'Service not clear' : serviceLabels[lead.serviceVertical]}
                        {lead.targetEmirate ? ` · ${lead.targetEmirate}` : ''}
                      </span>
                      <span className="shrink-0">{relativeTime(lead.updatedAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
              {items.length === 0 && (
                <li className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-content-muted">
                  Drop a lead here
                </li>
              )}
            </ul>
          </section>
        );
      })}
      {move.isError && (
        <p role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-danger px-3 py-2 text-xs text-white shadow-lg">
          Could not move the lead. It was put back.
        </p>
      )}
    </div>
  );
}
