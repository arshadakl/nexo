import { useState, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import { Button } from './button';

export function ConfirmAction({ title, children, actionLabel, onConfirm, onClose }: { title: string; children: ReactNode; actionLabel: string; onConfirm: () => Promise<unknown>; onClose: () => void }) {
  const [isBusy, setIsBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  return <Dialog title={title} alert isBusy={isBusy} onClose={onClose}><div className="space-y-5 p-5"><div className="text-sm leading-6 text-content-secondary">{children}</div>{error && <p role="alert" className="text-[13px] text-danger">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={isBusy} onClick={onClose}>Cancel</Button><Button type="button" variant="destructive" disabled={isBusy} onClick={async () => { if (isBusy) return; setIsBusy(true); setError(null); try { await onConfirm(); onClose(); } catch (error) { setError(error instanceof Error ? error.message : 'The action could not be completed.'); } finally { setIsBusy(false); } }}>{isBusy ? 'Working…' : actionLabel}</Button></div></div></Dialog>;
}
