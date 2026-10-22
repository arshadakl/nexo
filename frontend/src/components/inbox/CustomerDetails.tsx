import { useState } from 'react';
import { Pencil, AlertTriangle } from 'lucide-react';
import { useLead } from '@/hooks/useLeads';
import { ErrorState } from '@/components/feedback/ErrorState';
import { CollectionLoading } from '@/components/feedback/CollectionState';
import { Button } from '@/components/ui/button';
import { LeadEditor } from '@/components/leads/LeadEditor';
import { LeadNotes } from '@/components/leads/LeadNotes';
import { humanize, leadLabels } from '@/lib/leadPresentation';
import { inboxHref, navigate } from '@/lib/navigation';
import type { Lead } from '@shared/types/crm.types';

export function CustomerDetails({
  leadId,
  onNavigateToInbox,
}: {
  leadId: string | null;
  onNavigateToInbox?: (id: string) => void;
}) {
  const lead = useLead(leadId);
  if (!leadId)
    return (
      <p className="p-5 text-[13px] leading-6 text-content-secondary">
        No qualification profile is linked to this conversation yet.
      </p>
    );
  if (lead.isPending) return <CollectionLoading label="Loading customer details" />;
  return (
    <>
      {lead.isError && (
        <ErrorState
          message="Could not load customer details."
          onRetry={() => {
            void lead.refetch();
          }}
        />
      )}
      {lead.data && (
        <LeadProfile
          key={lead.data.id}
          lead={lead.data}
          conversationIds={lead.data.linkedConversationIds || []}
          onNavigateToInbox={onNavigateToInbox}
        />
      )}
    </>
  );
}

function LeadProfile({
  lead,
  conversationIds,
  onNavigateToInbox,
}: {
  lead: Lead;
  conversationIds: string[];
  onNavigateToInbox?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isNeedsHand = lead.leadStatus === 'handover_requested' || lead.leadStatus === 'support_enquiry';
  const hasConfusions = (lead.confusions && lead.confusions.length > 0) || (lead.unansweredQuestions && lead.unansweredQuestions.length > 0);

  const fields = [
    ['Service', humanize(lead.serviceVertical)],
    ['Residency intent', humanize(lead.residencyIntent)],
    ['Profession / activity', lead.profession || lead.workBusinessActivity],
    ['Current location', lead.currentLocation || humanize(lead.uaeLocationContext)],
    ['Nationality', lead.nationality],
    ['Destination emirate', lead.targetEmirate],
    ['Timeline', lead.timeline],
    ['Language', lead.detectedLanguage],
    ['Phone contact', lead.phoneOrEmail || lead.phoneNumber],
    ['WhatsApp', lead.whatsappNumber || (lead.whatsappSameAsPhone ? 'Same as primary phone' : null)],
    ['Contact preference', humanize(lead.contactMethodPreference)],
  ];

  return (
    <div className="divide-y divide-border px-5 text-[13px] leading-6">
      {/* Header status */}
      <section className="space-y-3 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold flex items-center gap-1.5">
            {isNeedsHand && <AlertTriangle className="size-4 text-warning" />}
            {leadLabels[lead.leadStatus]}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" className="size-3.5" />
            Edit customer
          </Button>
        </div>
        {lead.statusReason && <p className="text-content-secondary">{lead.statusReason}</p>}
        {lead.summary && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{lead.summary}</p>}
      </section>

      {/* Confusions & Objections alert if any */}
      {(isNeedsHand || hasConfusions) && (
        <section className="space-y-2 py-4 bg-warning/10 rounded-md p-3 my-3 border border-warning/30">
          <h3 className="text-xs font-semibold text-warning uppercase flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Needs Human Hand / Unanswered Inquiries
          </h3>
          {lead.confusions && lead.confusions.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-content-primary">Customer Doubts / Objections:</span>
              <ul className="list-disc list-inside text-xs text-content-secondary space-y-0.5">
                {lead.confusions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {lead.unansweredQuestions && lead.unansweredQuestions.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-content-primary">Pending Questions:</span>
              <ul className="list-disc list-inside text-xs text-content-secondary space-y-0.5">
                {lead.unansweredQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Next Action */}
      <section className="space-y-2 py-5">
        <h3 className="text-sm font-semibold">Next action</h3>
        <p>{lead.nextAction || 'No next action recorded.'}</p>
        {lead.nextActionOwner && (
          <p className="text-content-secondary">Owner: {lead.nextActionOwner}</p>
        )}
      </section>

      {/* Qualification Data */}
      <section className="py-5">
        <h3 className="mb-4 text-sm font-semibold">Qualification</h3>
        <dl className="space-y-3">
          {fields.map(([label, value]) => (
            <div key={label} className="space-y-1">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="[overflow-wrap:anywhere] font-medium">{value || 'Not recorded'}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Customer Permissions */}
      <section className="space-y-3 py-5">
        <h3 className="text-sm font-semibold">Customer permissions</h3>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-muted-foreground">Phone contact permission</dt>
            <dd>{lead.contactPermission ? 'Granted' : 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">WhatsApp follow-up permission</dt>
            <dd>{lead.whatsappContactPermission || lead.contactPermission ? 'Permitted' : 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">External sharing permission</dt>
            <dd className={!lead.externalSharingPermission ? 'text-warning font-medium' : ''}>
              {lead.externalSharingPermission ? 'Permitted' : 'Not permitted'}
            </dd>
          </div>
        </dl>
      </section>

      {/* Missing Details */}
      <section className="space-y-3 py-5">
        <h3 className="text-sm font-semibold">Missing details</h3>
        {lead.missingDetails.filter(Boolean).length ? (
          <ul className="list-inside list-disc space-y-1 text-content-secondary">
            {lead.missingDetails.filter(Boolean).map((item) => (
              <li key={item}>{humanize(item)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-content-secondary">No missing details recorded.</p>
        )}
      </section>

      {/* Linked Conversations */}
      {conversationIds.length > 0 && (
        <section className="space-y-3 py-5">
          <h3 className="text-sm font-semibold">Linked conversations</h3>
          {conversationIds.map((id, index) => (
            <a
              key={id}
              className="block w-fit rounded-md py-2 text-content-primary underline underline-offset-4"
              href={inboxHref({ conversationId: id, channel: 'all', search: '', humanOnly: false })}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                if (onNavigateToInbox) onNavigateToInbox(id);
                else
                  navigate(
                    inboxHref({ conversationId: id, channel: 'all', search: '', humanOnly: false }),
                  );
              }}
            >
              Open conversation {index + 1}
            </a>
          ))}
        </section>
      )}

      {/* Internal notes */}
      <LeadNotes key={lead.id} leadId={lead.id} />

      {/* Lead editor modal */}
      {editing && <LeadEditor lead={lead} onClose={() => setEditing(false)} />}
    </div>
  );
}
