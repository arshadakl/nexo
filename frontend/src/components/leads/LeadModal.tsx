import { useState } from 'react';
import {
  AlertTriangle,
  Pencil,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Clock,
  MapPin,
  Briefcase,
  Globe,
  Phone,
  HelpCircle,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LeadEditor } from '@/components/leads/LeadEditor';
import { LeadNotes } from '@/components/leads/LeadNotes';
import { useLead } from '@/hooks/useLeads';
import { useConversationMessages } from '@/hooks/useConversations';
import { humanize, leadLabels } from '@/lib/leadPresentation';
import { absoluteTime } from '@/lib/formatDate';
import type { Lead, Message } from '@shared/types/crm.types';

interface LeadModalProps {
  leadId: string | null;
  onClose: () => void;
  onNavigateToInbox?: (conversationId?: string) => void;
}

export function LeadModal({ leadId, onClose, onNavigateToInbox }: LeadModalProps) {
  const leadQuery = useLead(leadId);
  const [editing, setEditing] = useState(false);

  if (!leadId) return null;

  return (
    <>
      <Dialog
        title="Lead Inspection & Data Collection"
        onClose={onClose}
        className="m-auto max-h-[92dvh] w-[95vw] max-w-4xl rounded-xl shadow-2xl p-0 overflow-hidden flex flex-col border border-border bg-surface-base"
      >
        {leadQuery.isPending ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        ) : leadQuery.isError ? (
          <div className="p-8">
            <ErrorState message="Could not load lead details." onRetry={() => { void leadQuery.refetch(); }} />
          </div>
        ) : leadQuery.data ? (
          <LeadModalContent
            lead={leadQuery.data}
            linkedConversationIds={leadQuery.data.linkedConversationIds || []}
            onEdit={() => setEditing(true)}
            onNavigateToInbox={onNavigateToInbox}
          />
        ) : null}
      </Dialog>

      {editing && leadQuery.data && (
        <LeadEditor lead={leadQuery.data} onClose={() => setEditing(false)} />
      )}
    </>
  );
}

function LeadModalContent({
  lead,
  linkedConversationIds,
  onEdit,
  onNavigateToInbox,
}: {
  lead: Lead;
  linkedConversationIds: string[];
  onEdit: () => void;
  onNavigateToInbox?: (conversationId?: string) => void;
}) {
  const firstConvoId = linkedConversationIds[0] || null;
  const isNeedsHand = lead.leadStatus === 'handover_requested' || lead.leadStatus === 'support_enquiry';
  const hasConfusions = (lead.confusions && lead.confusions.length > 0) || (lead.unansweredQuestions && lead.unansweredQuestions.length > 0);

  return (
    <div className="flex flex-col h-full max-h-[calc(92dvh-3.5rem)] overflow-y-auto">
      {/* Lead Header Strip */}
      <div className="px-6 py-4 bg-surface-panel border-b border-border flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-full bg-accent/15 text-accent flex items-center justify-center font-semibold text-base">
            {(lead.fullName || 'A').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-content-primary">
                {lead.fullName || 'Anonymous customer'}
              </h2>
              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isNeedsHand
                    ? 'bg-warning/15 text-warning border border-warning/30'
                    : lead.leadStatus === 'ready_for_team'
                    ? 'bg-success/15 text-success border border-success/30'
                    : 'bg-surface-raised text-content-secondary border border-border'
                }`}
              >
                {isNeedsHand && <AlertTriangle className="size-3 shrink-0" />}
                {leadLabels[lead.leadStatus]}
              </span>
            </div>
            <p className="text-xs text-content-secondary mt-0.5">
              Last updated {absoluteTime(lead.updatedAt)}
              {lead.phoneOrEmail && ` • ${lead.phoneOrEmail}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {firstConvoId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onNavigateToInbox?.(firstConvoId)}
              className="text-xs h-8 gap-1.5"
            >
              <MessageSquare className="size-3.5" />
              Open in Inbox
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onEdit}
            className="text-xs h-8 gap-1.5"
          >
            <Pencil className="size-3.5" />
            Edit details
          </Button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-6 space-y-6 flex-1 min-h-0">
        {/* CONFUSIONS & UNANSWERED QUESTIONS CARD (Highlighted Alert) */}
        {(isNeedsHand || hasConfusions) && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-warning font-semibold text-xs uppercase tracking-wide">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Needs Human Manual Hand / AI Boundary Triggered</span>
            </div>
            {lead.statusReason && (
              <p className="text-xs text-content-primary font-medium">
                Reason: <span className="text-content-secondary font-normal">{lead.statusReason}</span>
              </p>
            )}

            {/* List customer confusions / objections */}
            {lead.confusions && lead.confusions.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-xs font-semibold text-content-primary">Customer Confusions & Objections:</p>
                <ul className="list-disc list-inside text-xs text-content-secondary space-y-0.5 pl-1">
                  {lead.confusions.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* List unverified questions AI wasn't aware of */}
            {lead.unansweredQuestions && lead.unansweredQuestions.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-xs font-semibold text-content-primary">Questions Pending Team Assessment:</p>
                <ul className="list-disc list-inside text-xs text-content-secondary space-y-0.5 pl-1">
                  {lead.unansweredQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 2-Column Grid: Collected Data vs Conversation & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left Column: Collected Lead Facts & Customer Permissions */}
          <div className="space-y-6">
            {/* Qualification Intake Facts */}
            <div className="rounded-lg border border-border bg-surface-panel p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Intake & Service Requirements
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Service</span>
                  <span className="font-medium text-content-primary">
                    {humanize(lead.serviceVertical)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Residency intent</span>
                  <span className="font-medium text-content-primary">
                    {humanize(lead.residencyIntent)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[11px]">Profession / Business Activity</span>
                  <span className="font-medium text-content-primary flex items-center gap-1.5 mt-0.5">
                    <Briefcase className="size-3.5 text-muted-foreground" />
                    {lead.profession || lead.workBusinessActivity || 'Not recorded'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Current Location</span>
                  <span className="font-medium text-content-primary flex items-center gap-1 mt-0.5">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {lead.currentLocation || humanize(lead.uaeLocationContext)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Nationality</span>
                  <span className="font-medium text-content-primary flex items-center gap-1 mt-0.5">
                    <Globe className="size-3.5 text-muted-foreground" />
                    {lead.nationality || 'Not recorded'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Destination Emirate</span>
                  <span className="font-medium text-content-primary">
                    {lead.targetEmirate || 'Undecided'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Move Timing</span>
                  <span className="font-medium text-content-primary flex items-center gap-1 mt-0.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    {lead.timeline || 'Not recorded'}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-border/60">
                  <span className="text-muted-foreground block text-[11px]">Contact & WhatsApp</span>
                  <div className="flex flex-col gap-1 mt-0.5">
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{lead.phoneOrEmail || lead.phoneNumber || 'No phone recorded'}</span>
                    </div>
                    {lead.whatsappNumber && lead.whatsappNumber !== lead.phoneOrEmail && (
                      <div className="flex items-center gap-2 text-content-secondary">
                        <span className="text-[11px] font-medium text-success">WhatsApp:</span>
                        <span className="font-mono text-xs">{lead.whatsappNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Permissions Card */}
            <div className="rounded-lg border border-border bg-surface-panel p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-accent" />
                Customer Permissions & Consent
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-content-secondary">Phone Contact Permission</span>
                  {lead.contactPermission ? (
                    <span className="inline-flex items-center gap-1 text-success font-medium">
                      <CheckCircle2 className="size-3.5" /> Granted
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not recorded</span>
                  )}
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-content-secondary">WhatsApp Follow-up Permission</span>
                  {lead.whatsappContactPermission || lead.contactPermission ? (
                    <span className="inline-flex items-center gap-1 text-success font-medium">
                      <CheckCircle2 className="size-3.5" /> Permitted
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not recorded</span>
                  )}
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-content-secondary">External Consultant Sharing</span>
                  {lead.externalSharingPermission ? (
                    <span className="inline-flex items-center gap-1 text-success font-medium">
                      <CheckCircle2 className="size-3.5" /> Permitted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warning font-medium">
                      <ShieldAlert className="size-3.5" /> Restricted
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Missing Details Checklist */}
            <div className="rounded-lg border border-border bg-surface-panel p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <HelpCircle className="size-3.5" />
                Missing Profile Details
              </h3>
              {lead.missingDetails?.filter(Boolean).length ? (
                <ul className="list-disc list-inside text-xs text-content-secondary space-y-1">
                  {lead.missingDetails.filter(Boolean).map((item, idx) => (
                    <li key={idx}>{humanize(item)}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-success font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" /> Complete profile collected
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Embedded Conversation Transcript & Notes */}
          <div className="space-y-6">
            {/* Conversation Transcript Preview */}
            <div className="rounded-lg border border-border bg-surface-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="size-3.5" />
                  Chat History & Transcript
                </h3>
                {firstConvoId && (
                  <button
                    type="button"
                    onClick={() => onNavigateToInbox?.(firstConvoId)}
                    className="text-xs text-accent hover:underline flex items-center gap-1"
                  >
                    View in Inbox <ExternalLink className="size-3" />
                  </button>
                )}
              </div>

              {firstConvoId ? (
                <ConversationTranscriptPreview conversationId={firstConvoId} />
              ) : (
                <p className="text-xs text-content-secondary py-4 text-center">
                  No linked conversation thread for this profile.
                </p>
              )}
            </div>

            {/* Internal Staff Notes */}
            <div className="rounded-lg border border-border bg-surface-panel p-4 space-y-3">
              <LeadNotes leadId={lead.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationTranscriptPreview({ conversationId }: { conversationId: string }) {
  const { data: messages, isLoading, isError } = useConversationMessages(conversationId);

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-10 w-2/3 ml-auto" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-xs text-danger py-2">Could not load chat messages.</p>;
  }

  if (!messages || messages.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No messages recorded in this thread.</p>;
  }

  // Show up to the last 10 messages
  const displayMessages = messages.slice(-10);

  return (
    <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 border border-border/50 rounded-md p-3 bg-surface-base/50 text-xs">
      {displayMessages.map((m: Message) => {
        const isApplicant = m.senderType === 'applicant';
        return (
          <div
            key={m.id}
            className={`flex flex-col ${isApplicant ? 'items-start' : 'items-end'}`}
          >
            <div className="text-[10px] text-muted-foreground mb-0.5">
              {isApplicant ? 'Applicant' : m.senderType === 'ai' ? 'Resider AI' : 'Staff'}
            </div>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                isApplicant
                  ? 'bg-surface-panel border border-border text-content-primary'
                  : 'bg-accent/15 border border-accent/25 text-content-primary'
              }`}
            >
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.messageText}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
