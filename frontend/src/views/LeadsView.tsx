import * as React from 'react';
import {
  Search,
  ArrowUpDown,
  RefreshCw,
  Users,
  List,
  KanbanSquare,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { fetchAllLeads, useBulkLeadStatus, useLeadsPage } from '@/hooks/useLeads';
import { LeadModal } from '@/components/leads/LeadModal';
import { LeadKanban } from '@/components/leads/LeadKanban';
import {
  COLUMNS,
  ColumnPicker,
  DEFAULT_COLUMNS,
  Dropdown,
  LeadMobileList,
  STAGES,
  SortHeader,
  type SortState,
  td,
  th,
} from '@/components/leads/leadTableParts';
import { leadLabels } from '@/lib/leadPresentation';
import { downloadCsv, leadsToCsv } from '@/lib/leadCsv';
import { leadsHref, navigate, type WorkspaceRoute } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { Lead, LeadPageQuery, LeadQualification, LeadSortKey, LeadStatus, ServiceVertical } from '@shared/types/crm.types';

interface LeadsViewProps {
  route?: WorkspaceRoute;
  onNavigateToInbox?: (conversationId?: string) => void;
}

type ViewMode = 'list' | 'kanban';

/** Natural first direction when a column header is clicked. */
const defaultDirection: Record<LeadSortKey, 'asc' | 'desc'> = {
  updated: 'desc',
  created: 'desc',
  name: 'asc',
  stage: 'asc',
  qualification: 'asc',
};

const sortOptions = [
  { value: 'updated:desc', label: 'Last activity · newest' },
  { value: 'updated:asc', label: 'Last activity · oldest' },
  { value: 'created:desc', label: 'Created · newest' },
  { value: 'name:asc', label: 'Name · A–Z' },
  { value: 'name:desc', label: 'Name · Z–A' },
  { value: 'stage:asc', label: 'Stage · pipeline order' },
  { value: 'qualification:asc', label: 'Lead · hot first' },
];

const PAGE_SIZES = [25, 50, 100];

function readStored<T>(key: string, fallback: T, valid: (value: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return valid(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const toolButton =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-panel px-3 text-[13px] font-medium hover:bg-surface-hover disabled:opacity-50';

export function LeadsView({ route, onNavigateToInbox }: LeadsViewProps = {}) {
  const selectedLeadId = route?.leadId ?? null;
  const selectedStatus = (route?.leadStatus as LeadStatus | 'all') || 'all';
  const [view, setView] = React.useState<ViewMode>(() =>
    readStored<ViewMode>('resider-leads-view-v2', 'list', (v) => v === 'list' || v === 'kanban'),
  );
  const [serviceVertical, setServiceVertical] = React.useState('all');
  const [qualification, setQualification] = React.useState('all');
  const [sort, setSort] = React.useState<SortState>({ key: 'updated', direction: 'desc' });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(() =>
    readStored('resider-leads-page-size', 25, (v) => PAGE_SIZES.includes(Number(v))),
  );
  const [visibleColumns, setVisibleColumns] = React.useState<string[]>(() =>
    readStored('resider-leads-columns', DEFAULT_COLUMNS, (v) => Array.isArray(v)),
  );
  const [selected, setSelected] = React.useState<Map<string, Lead>>(new Map());
  const [searchQuery, setSearchQuery] = React.useState(route?.search || '');
  const [debouncedSearch, setDebouncedSearch] = React.useState(route?.search || '');
  const [showFilters, setShowFilters] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filters: LeadPageQuery = {
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    serviceVertical: serviceVertical === 'all' ? undefined : (serviceVertical as ServiceVertical),
    qualification: qualification === 'all' ? undefined : (qualification as LeadQualification),
    search: debouncedSearch || undefined,
  };

  // New filters, sorting or page size start again from page 1.
  const filterKey = JSON.stringify([filters, sort, pageSize]);
  React.useEffect(() => setPage(1), [filterKey]);

  const listQuery = useLeadsPage(
    view === 'kanban'
      ? { ...filters, status: undefined, sort: 'updated', direction: 'desc', page: 1, pageSize: 200 }
      : { ...filters, sort: sort.key, direction: sort.direction, page, pageSize },
  );
  const rows = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const bulk = useBulkLeadStatus();

  const changeView = (next: ViewMode) => {
    setView(next);
    writeStored('resider-leads-view-v2', next);
  };
  const changePageSize = (size: number) => {
    setPageSize(size);
    writeStored('resider-leads-page-size', size);
  };
  const toggleColumn = (key: string) =>
    setVisibleColumns((old) => {
      const next = old.includes(key) ? old.filter((k) => k !== key) : [...old, key];
      writeStored('resider-leads-columns', next);
      return next;
    });
  const sortBy = (key: LeadSortKey) =>
    setSort((old) =>
      old.key === key ? { key, direction: old.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: defaultDirection[key] },
    );

  const openLead = (id: string | null) => navigate(leadsHref({ leadId: id, status: selectedStatus, search: debouncedSearch }));
  const setStage = (status: string) => navigate(leadsHref({ leadId: selectedLeadId, status, search: debouncedSearch }));

  const toggleRow = (lead: Lead) =>
    setSelected((old) => {
      const next = new Map(old);
      if (next.has(lead.id)) next.delete(lead.id);
      else next.set(lead.id, lead);
      return next;
    });
  const pageAllSelected = rows.length > 0 && rows.every((l) => selected.has(l.id));
  const pageSomeSelected = rows.some((l) => selected.has(l.id));
  const togglePage = () =>
    setSelected((old) => {
      const next = new Map(old);
      if (pageAllSelected) rows.forEach((l) => next.delete(l.id));
      else rows.forEach((l) => next.set(l.id, l));
      return next;
    });

  const exportCsv = async (leads?: Lead[]) => {
    setExporting(true);
    setNotice(null);
    try {
      const list = leads ?? (await fetchAllLeads({ ...filters, sort: sort.key, direction: sort.direction }));
      downloadCsv(`resider-leads-${new Date().toISOString().slice(0, 10)}.csv`, leadsToCsv(list));
      setNotice(`Exported ${list.length} lead${list.length === 1 ? '' : 's'}.`);
    } catch {
      setNotice('Could not export leads. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const moveSelected = (status: string) => {
    if (!status) return;
    bulk.mutate(
      { leadIds: [...selected.keys()], leadStatus: status as LeadStatus },
      {
        onSuccess: (res) => {
          setNotice(`Moved ${res.updated} lead${res.updated === 1 ? '' : 's'} to ${leadLabels[status as LeadStatus]}.`);
          setSelected(new Map());
        },
        onError: () => setNotice('Could not move the selected leads. Nothing was changed.'),
      },
    );
  };

  const activeFilters = (selectedStatus !== 'all' ? 1 : 0) + (serviceVertical !== 'all' ? 1 : 0) + (qualification !== 'all' ? 1 : 0);
  const shownColumns = COLUMNS.filter((c) => visibleColumns.includes(c.key));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

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
              {view === tab.key && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-content-primary" />}
            </button>
          ))}
        </div>
        <span className="ml-auto hidden text-xs tabular-nums text-content-secondary sm:inline">
          {listQuery.data ? `${total} lead${total === 1 ? '' : 's'}` : ''}
        </span>
        <button
          type="button"
          onClick={() => void listQuery.refetch()}
          aria-label="Refresh leads"
          className="ml-2 flex size-9 items-center justify-center rounded-lg text-content-secondary hover:bg-surface-hover sm:ml-3"
        >
          <RefreshCw aria-hidden="true" className={cn('size-4', listQuery.isFetching && 'animate-spin')} />
        </button>
      </div>

      {/* Toolbar, replaced by bulk actions while rows are selected */}
      {selected.size > 0 && view === 'list' ? (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-violet-500/30 bg-violet-500/10 px-4 py-2.5 sm:px-6"
        >
          <span className="text-[13px] font-semibold text-violet-700 dark:text-violet-300">{selected.size} selected</span>
          <Dropdown label="Move selected to stage" value="" onChange={moveSelected}>
            <option value="">{bulk.isPending ? 'Moving…' : 'Move to stage…'}</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {leadLabels[s]}
              </option>
            ))}
          </Dropdown>
          <button type="button" disabled={exporting} onClick={() => void exportCsv([...selected.values()])} className={toolButton}>
            <Download aria-hidden="true" className="size-3.5" />
            Export selected
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Map())}
            className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] text-content-secondary hover:text-content-primary"
          >
            <X aria-hidden="true" className="size-3.5" />
            Clear selection
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 sm:px-6">
          <div className="relative w-full sm:w-56">
            <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-content-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, activity…"
              aria-label="Search leads"
              className="h-9 w-full rounded-lg border border-border bg-surface-panel pl-8 pr-3 text-[13px] text-content-primary placeholder:text-content-muted"
            />
          </div>
          {view === 'list' && (
            <Dropdown
              label="Sort leads"
              value={`${sort.key}:${sort.direction}`}
              className="max-w-[14rem]"
              onChange={(v) => {
                const [key, direction] = v.split(':') as [LeadSortKey, 'asc' | 'desc'];
                setSort({ key, direction });
              }}
              icon={<ArrowUpDown className="size-3.5 text-emerald-600 dark:text-emerald-400" />}
            >
              {!sortOptions.some((o) => o.value === `${sort.key}:${sort.direction}`) && (
                <option value={`${sort.key}:${sort.direction}`}>Custom sort</option>
              )}
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Dropdown>
          )}
          <button
            type="button"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              toolButton,
              'md:hidden',
              activeFilters > 0 && 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
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
                Clear filters
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {view === 'list' && <ColumnPicker visible={visibleColumns} onToggle={toggleColumn} />}
            <button type="button" disabled={exporting || total === 0} onClick={() => void exportCsv()} className={toolButton}>
              <Download aria-hidden="true" className="size-3.5" />
              <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export CSV'}</span>
              <span className="sr-only sm:hidden">Export CSV</span>
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-base px-4 py-2 text-xs text-content-secondary sm:px-6"
        >
          {notice}
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="text-content-muted hover:text-content-primary">
            <X className="size-3.5" />
          </button>
        </p>
      )}

      {/* Content */}
      <div className={cn('min-h-0 flex-1 overflow-auto', listQuery.isPlaceholderData && 'opacity-60')}>
        {listQuery.isPending ? (
          <div role="status" className="space-y-px p-4 sm:px-6">
            <span className="sr-only">Loading leads</span>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <p role="alert" className="m-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            Could not load leads. Please check your connection and retry.
          </p>
        ) : view === 'kanban' ? (
          <LeadKanban leads={rows} onOpen={openLead} />
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
            <table className="hidden w-full min-w-[960px] border-separate border-spacing-0 md:table">
              <thead className="sticky top-0 z-10 bg-surface-panel">
                <tr>
                  <th className={cn(th, 'w-10 text-center')}>
                    <input
                      type="checkbox"
                      aria-label="Select all leads on this page"
                      checked={pageAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !pageAllSelected && pageSomeSelected;
                      }}
                      onChange={togglePage}
                      className="size-4 cursor-pointer accent-violet-600"
                    />
                  </th>
                  <SortHeader label="Name" sortKey="name" sort={sort} onSort={sortBy} className="sticky left-0 z-10 min-w-56 bg-surface-panel" />
                  {shownColumns.map((col) =>
                    col.sort ? (
                      <SortHeader key={col.key} label={col.label} sortKey={col.sort} sort={sort} onSort={sortBy} />
                    ) : (
                      <th key={col.key} className={th}>
                        {col.label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => {
                  const isSelected = selected.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openLead(lead.id)}
                      aria-selected={isSelected}
                      className={cn('group cursor-pointer', isSelected ? 'bg-violet-500/5' : 'hover:bg-surface-hover/60')}
                    >
                      <td className={cn(td, 'text-center')} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.fullName || 'lead'}`}
                          checked={isSelected}
                          onChange={() => toggleRow(lead)}
                          className="size-4 cursor-pointer accent-violet-600"
                        />
                      </td>
                      <td
                        className={cn(
                          td,
                          'sticky left-0',
                          isSelected ? 'bg-violet-50 dark:bg-[#1c1830]' : 'bg-surface-panel group-hover:bg-surface-hover',
                        )}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openLead(lead.id);
                          }}
                          className="flex max-w-64 items-center gap-2.5 text-left font-medium hover:underline"
                        >
                          <Avatar name={lead.fullName} size="sm" />
                          <span className="truncate">{lead.fullName || 'Name not shared'}</span>
                        </button>
                      </td>
                      {shownColumns.map((col) => (
                        <td key={col.key} className={cn(td, col.className)}>
                          {col.render(lead)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <LeadMobileList leads={rows} onOpen={openLead} />
          </>
        )}
      </div>

      {/* Pagination */}
      {view === 'list' && !listQuery.isPending && !listQuery.isError && total > 0 && (
        <nav
          aria-label="Leads pages"
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-[13px] text-content-secondary sm:px-6"
        >
          <span className="tabular-nums">
            {firstRow}–{lastRow} of {total}
          </span>
          <div className="flex items-center gap-2">
            <label className="hidden items-center gap-1.5 sm:flex">
              Rows per page
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="h-8 rounded-md border border-border bg-surface-panel px-1.5 text-[13px] text-content-primary"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <span className="tabular-nums">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-surface-hover disabled:opacity-40"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-surface-hover disabled:opacity-40"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </nav>
      )}

      <LeadModal leadId={selectedLeadId} onClose={() => openLead(null)} onNavigateToInbox={onNavigateToInbox} />
    </div>
  );
}
