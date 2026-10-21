import { useState } from 'react';
import { useAddLeadNote, useLeadNotes } from '@/hooks/useLeads';
import { TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback/ErrorState';
import { absoluteTime } from '@/lib/formatDate';

export function LeadNotes({ leadId }: { leadId: string }) {
  const notes = useLeadNotes(leadId); const add = useAddLeadNote(leadId); const [text, setText] = useState(''); const [notice, setNotice] = useState('');
  return <section className="space-y-4 py-5"><h3 className="text-sm font-semibold">Internal notes</h3><p className="text-xs leading-5 text-muted-foreground">Visible to your team. Notes are not sent to the customer.</p>
    {notes.isPending && <p role="status" className="text-[13px] text-content-secondary">Loading notes…</p>}
    {notes.isError && <ErrorState message="Could not load internal notes." onRetry={() => { void notes.refetch(); }} />}
    {notes.data && (notes.data.length ? <ol className="space-y-4">{notes.data.map((note) => <li key={note.id} className="space-y-2 border-l-2 border-border pl-3"><p dir="auto" className="whitespace-pre-wrap text-[13px] leading-6 [overflow-wrap:anywhere]">{note.content}</p><p className="text-xs text-muted-foreground">{note.authorName || 'Team member'} · <time dateTime={new Date(note.createdAt).toISOString()}>{absoluteTime(note.createdAt)}</time></p></li>)}</ol> : <p className="text-[13px] text-content-secondary">No internal notes yet.</p>)}
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (!text.trim() || add.isPending) return; add.mutate({ content: text.trim() }, { onSuccess: () => { setText(''); setNotice('Internal note added.'); } }); }}>
      <TextField label="New internal note" maxLength={5000} value={text} required readOnly={add.isPending} onChange={(event) => { setText(event.target.value); setNotice(''); }} />
      {add.isError && <p role="alert" className="text-[13px] text-danger">Could not save the note. Your text is preserved.</p>}
      {notice && <p role="status" className="text-[13px] text-content-secondary">{notice}</p>}
      <Button type="submit" size="sm" disabled={!text.trim() || add.isPending}>{add.isPending ? 'Adding…' : 'Add internal note'}</Button>
    </form>
  </section>;
}
