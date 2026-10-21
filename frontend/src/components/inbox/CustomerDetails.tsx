import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useLead } from '@/hooks/useLeads';
import { useExpert } from '@/hooks/useExperts';
import { ErrorState } from '@/components/feedback/ErrorState';
import { CollectionLoading } from '@/components/feedback/CollectionState';
import { Button } from '@/components/ui/button';
import { LeadEditor } from '@/components/leads/LeadEditor';
import { LeadNotes } from '@/components/leads/LeadNotes';
import { PartnerAssignment } from '@/components/leads/PartnerAssignment';
import { humanize, leadLabels } from '@/lib/leadPresentation';
import { inboxHref, navigate } from '@/lib/navigation';
import type { Lead } from '@shared/types/crm.types';

export function CustomerDetails({ leadId, onNavigateToInbox }: { leadId: string | null; onNavigateToInbox?: (id: string) => void }) {
  const lead = useLead(leadId);
  if (!leadId) return <p className="p-5 text-[13px] leading-6 text-content-secondary">No qualification profile is linked to this conversation yet.</p>;
  if (lead.isPending) return <CollectionLoading label="Loading customer details" />;
  return <>{lead.isError && <ErrorState message="Could not load customer details." onRetry={() => { void lead.refetch(); }} />}{lead.data && <LeadProfile key={lead.data.id} lead={lead.data} conversationIds={lead.data.linkedConversationIds || []} onNavigateToInbox={onNavigateToInbox} />}</>;
}

function LeadProfile({ lead, conversationIds, onNavigateToInbox }: { lead: Lead; conversationIds: string[]; onNavigateToInbox?: (id: string) => void }) {
  const [editing, setEditing] = useState(false); const [assigning, setAssigning] = useState(false); const [notice, setNotice] = useState('');
  const assigned = useExpert(lead.assignedExpertId || null);
  const fields = [['Service', humanize(lead.serviceVertical)], ['Residency intent', humanize(lead.residencyIntent)], ['Business activity', lead.workBusinessActivity], ['Location', humanize(lead.uaeLocationContext)], ['Emirate', lead.targetEmirate], ['Timeline', lead.timeline], ['Language', lead.detectedLanguage], ['Contact', lead.phoneOrEmail || lead.phoneNumber], ['Contact preference', humanize(lead.contactMethodPreference)]];
  return <div className="divide-y divide-border px-5 text-[13px] leading-6">
    <section className="space-y-3 py-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{leadLabels[lead.leadStatus]}</p><Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil aria-hidden="true" className="size-3.5" />Edit customer</Button></div>{lead.statusReason && <p className="text-content-secondary">{lead.statusReason}</p>}{lead.summary && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{lead.summary}</p>}</section>
    <section className="space-y-2 py-5"><h3 className="text-sm font-semibold">Next action</h3><p>{lead.nextAction || 'No next action recorded.'}</p>{lead.nextActionOwner && <p className="text-content-secondary">Owner: {lead.nextActionOwner}</p>}</section>
    <section className="py-5"><h3 className="mb-4 text-sm font-semibold">Qualification</h3><dl className="space-y-3">{fields.map(([label, value]) => <div key={label} className="space-y-1"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="[overflow-wrap:anywhere]">{value || 'Not recorded'}</dd></div>)}</dl></section>
    <section className="space-y-3 py-5"><h3 className="text-sm font-semibold">Customer permissions</h3><dl className="space-y-3"><div><dt className="text-xs text-muted-foreground">Contact permission</dt><dd>{lead.contactPermission ? 'Granted' : 'Not recorded'}</dd></div><div><dt className="text-xs text-muted-foreground">External sharing</dt><dd className={!lead.externalSharingPermission ? 'text-warning' : ''}>{lead.externalSharingPermission ? 'Permitted' : 'Not permitted'}</dd></div></dl></section>
    <section className="space-y-3 py-5"><h3 className="text-sm font-semibold">Missing details</h3>{lead.missingDetails.filter(Boolean).length ? <ul className="list-inside list-disc space-y-1 text-content-secondary">{lead.missingDetails.filter(Boolean).map((item) => <li key={item}>{humanize(item)}</li>)}</ul> : <p className="text-content-secondary">No missing details recorded.</p>}</section>
    <section className="space-y-3 py-5"><h3 className="text-sm font-semibold">Consulting partner</h3>{lead.assignedExpertId ? <><p>{assigned.data?.fullName || (assigned.isPending ? 'Loading assigned partner…' : 'Partner assigned')}</p>{assigned.data && <p className="text-content-secondary">{assigned.data.organizationName}</p>}{assigned.isError && <ErrorState message="Could not load assigned partner details." onRetry={() => { void assigned.refetch(); }} />}</> : <p className="text-content-secondary">No partner assigned.</p>}{!lead.externalSharingPermission && <p className="text-xs leading-5 text-warning">Record the customer’s permission before sharing their details.</p>}<Button type="button" variant="outline" size="sm" disabled={!lead.externalSharingPermission} onClick={() => setAssigning(true)}>{lead.assignedExpertId ? 'Change partner' : 'Choose partner'}</Button>{notice && <p role="status" className="text-success">{notice}</p>}</section>
    {conversationIds.length > 0 && <section className="space-y-3 py-5"><h3 className="text-sm font-semibold">Linked conversations</h3>{conversationIds.map((id, index) => <a key={id} className="block w-fit rounded-md py-2 text-content-primary underline underline-offset-4" href={inboxHref({ conversationId: id, channel: 'all', search: '', humanOnly: false })} onClick={(event) => { if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); if (onNavigateToInbox) onNavigateToInbox(id); else navigate(inboxHref({ conversationId: id, channel: 'all', search: '', humanOnly: false })); }}>Open conversation {index + 1}</a>)}</section>}
    <LeadNotes key={lead.id} leadId={lead.id} />
    {editing && <LeadEditor lead={lead} onClose={() => setEditing(false)} />}
    {assigning && <PartnerAssignment lead={lead} onClose={() => setAssigning(false)} onAssigned={() => { setAssigning(false); setNotice('Partner assigned. Handover recorded.'); }} />}
  </div>;
}
