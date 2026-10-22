import { useRef, useState } from 'react';
import type { Lead } from '@shared/types/crm.types';
import type { UpdateLeadSchemaType } from '@shared/schemas/lead.schema';
import { useUpdateLead } from '@/hooks/useLeads';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/button';
import { CheckField, Field, SelectField, TextField } from '@/components/ui/Field';
import { humanize, leadLabels, qualificationLabels } from '@/lib/leadPresentation';

export function LeadEditor({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const mutation = useUpdateLead(lead.id);
  const [patch, setPatch] = useState<UpdateLeadSchemaType>({});
  const [discard, setDiscard] = useState(false); const [saved, setSaved] = useState(false);
  const locked = useRef(false);
  const values = { ...lead, ...patch };
  const dirty = Object.keys(patch).length > 0;
  const change = <K extends keyof UpdateLeadSchemaType>(key: K, value: UpdateLeadSchemaType[K]) => { setPatch((old) => ({ ...old, [key]: value })); setSaved(false); mutation.reset(); };
  const close = () => { if (mutation.isPending) return; if (dirty) setDiscard(true); else onClose(); };
  return <>
    <Dialog title="Edit customer details" onClose={close} isBusy={mutation.isPending} className="m-auto max-h-[90dvh] w-[95vw] max-w-2xl rounded-xl shadow-2xl">
      <form className="space-y-6 p-5" aria-busy={mutation.isPending} onSubmit={async (event) => { event.preventDefault(); if (!dirty || locked.current) return; locked.current = true; try { await mutation.mutateAsync(patch); setPatch({}); setSaved(true); } catch { /* inline feedback retains patch */ } finally { locked.current = false; } }}>
        <fieldset disabled={mutation.isPending} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name" value={values.fullName || ''} onChange={(event) => change('fullName', event.target.value)} />
            <Field label="Phone or email" value={values.phoneOrEmail || ''} onChange={(event) => change('phoneOrEmail', event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp number" value={values.whatsappNumber || ''} onChange={(event) => change('whatsappNumber', event.target.value)} />
            <Field label="Profession / Job" value={values.profession || values.workBusinessActivity || ''} onChange={(event) => { change('profession', event.target.value); change('workBusinessActivity', event.target.value); }} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nationality" value={values.nationality || ''} onChange={(event) => change('nationality', event.target.value)} />
            <Field label="Current country" value={values.currentCountry || ''} onChange={(event) => change('currentCountry', event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Current city / emirate" value={values.currentCity || ''} onChange={(event) => change('currentCity', event.target.value)} />
            <Field label="Visa status" value={values.visaStatus || ''} onChange={(event) => change('visaStatus', event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Lead qualification" value={values.qualification || 'unknown'} onChange={(event) => change('qualification', event.target.value as NonNullable<Lead['qualification']>)}>{Object.entries(qualificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
            <Field label="Qualification reason" value={values.qualificationReason || ''} onChange={(event) => change('qualificationReason', event.target.value)} />
          </div>
          <p className="text-xs leading-5 text-content-secondary">Fields you save here are marked confirmed; the AI will not overwrite them.</p>
          <TextField label="Customer summary" value={values.summary || ''} onChange={(event) => change('summary', event.target.value)} />
          <SelectField label="Lead status" value={values.leadStatus} onChange={(event) => change('leadStatus', event.target.value as Lead['leadStatus'])}>{Object.entries(leadLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
          <Field label="Status reason" value={values.statusReason || ''} onChange={(event) => change('statusReason', event.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2"><SelectField label="Service" value={values.serviceVertical} onChange={(event) => change('serviceVertical', event.target.value as Lead['serviceVertical'])}>{['residency', 'business_setup', 'both', 'unspecified'].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</SelectField><SelectField label="Residency intent" value={values.residencyIntent} onChange={(event) => change('residencyIntent', event.target.value as Lead['residencyIntent'])}>{['permit_with_residency', 'residency_only', 'understanding_options', 'unspecified'].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</SelectField></div>
          <div className="grid gap-4 sm:grid-cols-2"><SelectField label="UAE location" value={values.uaeLocationContext} onChange={(event) => change('uaeLocationContext', event.target.value as Lead['uaeLocationContext'])}>{['inside_uae', 'outside_uae', 'undecided', 'unknown'].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</SelectField><Field label="Preferred emirate" value={values.targetEmirate || ''} onChange={(event) => change('targetEmirate', event.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Timeline" value={values.timeline || ''} onChange={(event) => change('timeline', event.target.value)} /><Field label="Language" value={values.detectedLanguage} onChange={(event) => change('detectedLanguage', event.target.value)} /></div>
          <SelectField label="Preferred contact method" value={values.contactMethodPreference || ''} onChange={(event) => change('contactMethodPreference', (event.target.value || null) as Lead['contactMethodPreference'])}><option value="">Not recorded</option>{['whatsapp', 'phone_call', 'instagram_dm'].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</SelectField>
          <Field label="Next action" value={values.nextAction || ''} onChange={(event) => change('nextAction', event.target.value)} /><Field label="Next action owner" value={values.nextActionOwner || ''} onChange={(event) => change('nextActionOwner', event.target.value)} />
          <Field label="Missing details (comma-separated)" value={(values.missingDetails || []).join(', ')} onChange={(event) => change('missingDetails', event.target.value.split(',').map((item) => item.trim()))} />
          <section className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Recorded customer permissions</h3>
            <p className="mt-2 text-xs leading-5 text-content-secondary">Only grant permission after the customer has agreed.</p>
            <CheckField label="Customer permits direct phone contact" checked={values.contactPermission} onChange={(event) => change('contactPermission', event.target.checked)} />
            <CheckField label="Customer permits WhatsApp contact" checked={Boolean(values.whatsappContactPermission)} onChange={(event) => change('whatsappContactPermission', event.target.checked)} />
            <CheckField label="Customer permits sharing details with external consulting experts" checked={values.externalSharingPermission} onChange={(event) => change('externalSharingPermission', event.target.checked)} />
          </section>
        </fieldset>
        {mutation.isError && <p role="alert" className="text-[13px] text-danger">{mutation.error.message || 'Could not save customer details. Your edits are preserved.'}</p>}
        {saved && <p role="status" className="text-[13px] text-success">Customer details saved.</p>}
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-popover py-4"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>Close</Button><Button type="submit" disabled={!dirty || mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save customer details'}</Button></div>
      </form>
    </Dialog>
    {discard && <Dialog alert title="Discard unsaved changes?" onClose={() => setDiscard(false)}><div className="space-y-5 p-5"><p className="text-sm text-content-secondary">Your unsaved edits will be lost.</p><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDiscard(false)}>Keep editing</Button><Button type="button" variant="destructive" onClick={onClose}>Discard changes</Button></div></div></Dialog>}
  </>;
}
