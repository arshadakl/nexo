import { useState } from 'react';
import type { Lead } from '@shared/types/crm.types';
import { useAssignExpert, useExperts } from '@/hooks/useExperts';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/button';
import { CheckField, SelectField } from '@/components/ui/Field';
import { ErrorState } from '@/components/feedback/ErrorState';

export function PartnerAssignment({ lead, onClose, onAssigned }: { lead: Lead; onClose: () => void; onAssigned: () => void }) {
  const [all, setAll] = useState(false); const [selected, setSelected] = useState('');
  const experts = useExperts(all ? {} : { language: lead.detectedLanguage || undefined, emirate: lead.targetEmirate || undefined });
  const assign = useAssignExpert();
  const candidates = experts.data?.filter((expert) => expert.isVerified && expert.isAvailable) || [];
  const candidate = candidates.find((expert) => expert.id === selected);
  return <Dialog title="Assign consulting partner" onClose={onClose} isBusy={assign.isPending}><form className="space-y-5 p-5" onSubmit={(event) => { event.preventDefault(); if (!candidate || !lead.externalSharingPermission || assign.isPending) return; assign.mutate({ leadId: lead.id, expertId: candidate.id }, { onSuccess: onAssigned }); }}>
    <p className="text-sm leading-6 text-content-secondary">Choose a verified, available partner for {lead.fullName || 'this customer'}. Assignment records the handover and changes the lead status to Handed over.</p>
    {!lead.externalSharingPermission && <p role="alert" className="text-[13px] text-warning">Customer permission to share details is required. Record it in customer details first.</p>}
    <CheckField label="Show all available partners instead of filtering by customer language and emirate" checked={all} disabled={assign.isPending} onChange={(event) => { setAll(event.target.checked); setSelected(''); }} />
    {experts.isPending && <p role="status" className="text-[13px] text-content-secondary">Loading partners…</p>}
    {experts.isError && <ErrorState message="Could not load partners." onRetry={() => { void experts.refetch(); }} />}
    <SelectField label="Consulting partner" value={candidate?.id || ''} disabled={assign.isPending || experts.isPending || experts.isError || !lead.externalSharingPermission} onChange={(event) => setSelected(event.target.value)}><option value="">Select a partner</option>{candidates.map((expert) => <option key={expert.id} value={expert.id}>{expert.fullName} · {expert.organizationName}</option>)}</SelectField>
    {candidate && <dl className="space-y-2 rounded-md border border-border p-3 text-[13px] leading-6"><div><dt className="text-xs text-muted-foreground">Sectors</dt><dd>{candidate.sectors.join(', ')}</dd></div><div><dt className="text-xs text-muted-foreground">Languages / emirates</dt><dd>{candidate.languages.join(', ')} · {candidate.emirates.join(', ')}</dd></div></dl>}
    {!experts.isPending && !experts.isError && !candidates.length && <p className="text-[13px] text-content-secondary">No available partners match these filters. Try showing all partners.</p>}
    {assign.isError && <p role="alert" className="text-[13px] text-danger">{assign.error.message || 'Could not assign this partner.'}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={assign.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={!candidate || !lead.externalSharingPermission || assign.isPending}>{assign.isPending ? 'Assigning…' : 'Assign partner'}</Button></div>
  </form></Dialog>;
}
