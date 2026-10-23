import * as React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { useMoveLeadStage } from '@/hooks/useLeads';
import { leadLabels } from '@/lib/leadPresentation';
import { relativeTime } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import type { Lead, LeadStatus } from '@shared/types/crm.types';
import { QualificationBadge, STAGES, serviceLabels, stageDot } from './leadTableParts';

/** Stage columns; drag a card onto another column to move the lead (desktop). */
export function LeadKanban({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  const move = useMoveLeadStage();
  const [dragOver, setDragOver] = React.useState<LeadStatus | null>(null);
  const columns = STAGES.filter((stage) => stage !== 'outside_scope_spam' || leads.some((l) => l.leadStatus === stage));

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
              <span className="ml-auto rounded-full bg-surface-hover px-2 text-[11px] font-medium text-content-secondary">{items.length}</span>
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
                <li className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-content-muted">Drop a lead here</li>
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
