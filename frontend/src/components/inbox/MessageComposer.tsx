import { useId, useRef, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ComposerDraft } from '@/lib/ComposerContext';

const templates = [
  {
    label: 'Brief greeting',
    text: 'ഹായ്! എന്താണ് അറിയേണ്ടത്? We can help with UAE residency permits and verified business setup.',
  },
  {
    label: 'Residency stages',
    text: 'Our UAE residency service covers 6 clear stages: 1) Initial check, 2) Entry permit, 3) Status change, 4) Medical fitness test, 5) Emirates ID biometrics, and 6) Visa stamping. Would you like permit + residency or residency only?',
  },
  {
    label: 'Business setup expert',
    text: 'For business setup, our team connects you with verified consulting experts matching your sector and language. May we have your permission to share your details with our expert partner?',
  },
  {
    label: 'Advisory call',
    text: 'Our advisory team can discuss your profile in detail. What is the best WhatsApp number or time for a quick 10-minute briefing?',
  },
];

export function MessageComposer({
  draft,
  customerName,
  isStaleEdit,
  isDisabled,
  onChange,
  onCancelEdit,
  onSend,
}: {
  draft: ComposerDraft;
  customerName: string;
  isStaleEdit: boolean;
  isDisabled: boolean;
  onChange: (text: string) => void;
  onCancelEdit: () => void;
  onSend: () => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const isComposing = useRef(false);
  const value = draft.editing?.text ?? draft.text;
  const isBusy = draft.action !== null;
  const canSend = Boolean(value.trim()) && !isBusy && !isDisabled && !isStaleEdit;
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSend) onSend();
  };
  return (
    <form
      aria-label="Message composer"
      aria-busy={isBusy}
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-border bg-background px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-[13px] font-medium">
          {draft.editing ? 'Edit AI draft' : `Reply to ${customerName}`}
        </label>
        {draft.editing ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit} disabled={isBusy}>
            Cancel edit
          </Button>
        ) : (
          <select
            aria-label="Insert approved reply"
            value=""
            disabled={isBusy || isDisabled}
            onChange={(event) => {
              const template = templates.find((item) => item.label === event.target.value);
              if (template) onChange(value ? `${value}\n\n${template.text}` : template.text);
            }}
            className="h-9 max-w-full rounded-md border border-border bg-surface-panel px-2 text-xs text-content-secondary"
          >
            <option value="">Approved replies</option>
            {templates.map((template) => (
              <option key={template.label} value={template.label}>
                {template.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {isStaleEdit && (
        <p role="alert" className="mb-2 text-[13px] text-warning">
          This draft is no longer pending. Your edit is preserved; cancel editing to return to your
          reply.
        </p>
      )}
      <textarea
        id={inputId}
        dir="auto"
        rows={3}
        value={value}
        readOnly={isBusy}
        disabled={isDisabled}
        aria-describedby={`${hintId}${draft.error ? ` ${errorId}` : ''}`}
        onChange={(event) => onChange(event.target.value)}
        onCompositionStart={() => {
          isComposing.current = true;
        }}
        onCompositionEnd={() => {
          isComposing.current = false;
        }}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            (event.ctrlKey || event.metaKey) &&
            !isComposing.current &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (canSend) onSend();
          }
        }}
        placeholder="Write a reply…"
        className="block max-h-48 min-h-24 w-full resize-y rounded-md border border-input bg-surface-panel px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground disabled:opacity-50"
      />
      {draft.error && (
        <p id={errorId} role="alert" className="mt-2 text-[13px] leading-5 text-danger">
          {draft.error}
        </p>
      )}
      {draft.notice && (
        <p role="status" className="mt-2 text-[13px] leading-5 text-content-secondary">
          {draft.notice}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p id={hintId} className="text-xs text-muted-foreground">
          Ctrl / ⌘ + Enter to send
        </p>
        <Button type="submit" disabled={!canSend} className="min-h-10">
          <Send aria-hidden="true" className="size-4" />
          {draft.action === 'send' ? 'Sending…' : draft.editing ? 'Save & send' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}
