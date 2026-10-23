import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Columns3, MessageCircle, Phone } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { humanize, leadLabels, qualificationLabels } from '@/lib/leadPresentation';
import { absoluteTime, relativeTime } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import type { Lead, LeadQualification, LeadSortKey, LeadStatus } from '@shared/types/crm.types';

export type SortState = { key: LeadSortKey; direction: 'asc' | 'desc' };

/** Stage order used for Kanban columns and the stage filter. */
export const STAGES: LeadStatus[] = [
  'needs_clarification',
  'exploring',
  'ready_for_team',
  'handover_requested',
  'support_enquiry',
  'handed_over',
  'outside_scope_request',
  'outside_scope_spam',
];

export const stageDot: Record<LeadStatus, string> = {
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

export const serviceLabels: Record<string, string> = {
  residency: 'Residency',
  business_setup: 'Business setup',
  both: 'Residency + setup',
  unspecified: '—',
};

export const th =
  'whitespace-nowrap border-b border-r border-border px-3 py-2.5 text-left text-[12px] font-medium text-content-secondary last:border-r-0';
export const td =
  'whitespace-nowrap border-b border-r border-border px-3 py-2 text-[13px] text-content-primary last:border-r-0';

export function Dropdown({
  label,
  value,
  onChange,
  children,
  icon,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <label className="relative inline-flex shrink-0 items-center">
      {icon && <span className="pointer-events-none absolute left-2.5 text-content-secondary">{icon}</span>}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 max-w-[11.5rem] cursor-pointer appearance-none truncate rounded-lg border border-border bg-surface-panel pl-3 pr-8 text-[13px] font-medium text-content-primary hover:bg-surface-hover',
          icon && 'pl-8',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 size-3.5 text-content-muted" />
    </label>
  );
}

export function StageBadge({ status }: { status: LeadStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-content-primary">
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-[3px]', stageDot[status])} />
      {leadLabels[status]}
    </span>
  );
}

export function QualificationBadge({ value, reason }: { value: LeadQualification; reason?: string | null | undefined }) {
  if (value === 'unknown') return <span className="text-[13px] text-content-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium" title={reason || undefined}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', qualificationDot[value])} />
      {qualificationLabels[value]}
    </span>
  );
}

export function ContactCell({ lead }: { lead: Lead }) {
  const phone = lead.phoneOrEmail || lead.phoneNumber;
  if (!phone) return <span className="text-content-muted">{lead.contactPending ? 'Declined' : '—'}</span>;
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

const dash = <span className="text-content-muted">—</span>;
const when = (at: number) => (
  <time dateTime={new Date(at).toISOString()} title={absoluteTime(at)}>
    {relativeTime(at)}
  </time>
);

export interface ColumnDef {
  key: string;
  label: string;
  sort?: LeadSortKey;
  defaultVisible: boolean;
  className?: string;
  render: (lead: Lead) => React.ReactNode;
}

export const COLUMNS: ColumnDef[] = [
  { key: 'title', label: 'Title', defaultVisible: true, className: 'max-w-48 truncate', render: (l) => l.profession || l.workBusinessActivity || dash },
  { key: 'stage', label: 'Stage', sort: 'stage', defaultVisible: true, render: (l) => <StageBadge status={l.leadStatus} /> },
  {
    key: 'lead',
    label: 'Lead',
    sort: 'qualification',
    defaultVisible: true,
    render: (l) => <QualificationBadge value={l.qualification || 'unknown'} reason={l.qualificationReason} />,
  },
  { key: 'service', label: 'Service', defaultVisible: true, render: (l) => serviceLabels[l.serviceVertical] ?? humanize(l.serviceVertical) },
  { key: 'mobile', label: 'Mobile', defaultVisible: true, render: (l) => <ContactCell lead={l} /> },
  { key: 'nationality', label: 'Nationality', defaultVisible: false, render: (l) => l.nationality || dash },
  {
    key: 'location',
    label: 'Location',
    defaultVisible: true,
    className: 'max-w-44 truncate',
    render: (l) => [l.currentCity, l.currentCountry].filter(Boolean).join(', ') || l.currentLocation || dash,
  },
  { key: 'emirate', label: 'Emirate', defaultVisible: true, render: (l) => l.targetEmirate || dash },
  { key: 'visa', label: 'Visa status', defaultVisible: false, render: (l) => l.visaStatus || dash },
  { key: 'timing', label: 'Timing', defaultVisible: true, className: 'max-w-36 truncate', render: (l) => l.timeline || dash },
  { key: 'need', label: 'Need', defaultVisible: false, className: 'max-w-60 truncate', render: (l) => l.summary || dash },
  {
    key: 'next',
    label: 'Next action',
    defaultVisible: true,
    className: 'max-w-60 truncate text-content-secondary',
    render: (l) => <span title={l.nextAction || undefined}>{l.nextAction || dash}</span>,
  },
  { key: 'created', label: 'Created', sort: 'created', defaultVisible: false, className: 'text-content-secondary', render: (l) => when(l.createdAt) },
  { key: 'updated', label: 'Last activity', sort: 'updated', defaultVisible: true, className: 'text-content-secondary', render: (l) => when(l.updatedAt) },
];

export const DEFAULT_COLUMNS = COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

export function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: LeadSortKey;
  sort: SortState;
  onSort: (key: LeadSortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={cn(th, className)} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn('inline-flex items-center gap-1 hover:text-content-primary', active && 'text-content-primary')}
      >
        {label}
        <Icon aria-hidden="true" className={cn('size-3', !active && 'opacity-40')} />
      </button>
    </th>
  );
}

export function ColumnPicker({ visible, onToggle }: { visible: string[]; onToggle: (key: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-panel px-3 text-[13px] font-medium hover:bg-surface-hover"
      >
        <Columns3 aria-hidden="true" className="size-3.5" />
        Columns
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-border bg-popover p-2 shadow-xl">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-content-muted">Show columns</p>
          {COLUMNS.map((col) => (
            <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-hover">
              <input type="checkbox" checked={visible.includes(col.key)} onChange={() => onToggle(col.key)} className="size-4 accent-violet-600" />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeadMobileList({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  return (
    <ul className="divide-y divide-border md:hidden">
      {leads.map((lead) => (
        <li key={lead.id}>
          <button type="button" onClick={() => onOpen(lead.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover/60">
            <Avatar name={lead.fullName} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[14px] font-semibold text-content-primary">{lead.fullName || 'Name not shared'}</span>
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
