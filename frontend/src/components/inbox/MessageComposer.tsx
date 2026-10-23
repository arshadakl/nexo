import { useId, useLayoutEffect, useRef, type FormEvent } from 'react';
import { Send, Zap, PencilLine, X } from 'lucide-react';
import type { ChannelType } from '@shared/types/crm.types';
import type { ComposerDraft } from '@/lib/ComposerContext';
import { channelTheme } from '@/lib/channelTheme';
import { cn } from '@/lib/utils';

// Approved quick replies: they describe only the approved services and never quote prices or requirements.
const templates = [
  {
    label: 'Brief greeting',
    text: 'Hey! 👋 What can we help you with?',
  },
  {
    label: 'Residency stages',
    text: 'Our residency programme runs in stages: profile and requirement intake, free zone matching with confirmed costing, your decision, permit registration in your name, residency visa assistance, and community access. Is this for yourself?',
  },
  {
    label: 'Business setup expert',
    text: 'For business setup, we introduce you to a verified expert for your sector and language. Are you happy for us to share your enquiry details with them?',
  },
  {
    label: 'Team follow-up',
    text: 'The team will review your details and contact you. What number can they reach you on, including country code?',
  },
];

export function MessageComposer({
  draft,
  customerName,
  channel = 'instagram',
  isStaleEdit,
  isDisabled,
  onChange,
  onCancelEdit,
  onSend,
}: {
  draft: ComposerDraft;
  customerName: string;
  channel?: ChannelType | undefined;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const theme = channelTheme(channel);
  const value = draft.editing?.text ?? draft.text;
  const isBusy = draft.action !== null;
  const canSend = Boolean(value.trim()) && !isBusy && !isDisabled && !isStaleEdit;
  const sendLabel = draft.action === 'send' ? 'Sending…' : draft.editing ? 'Save & send' : 'Send reply';

  // Grow with the text like a messaging app, up to a limit.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSend) onSend();
  };

  return (
    <form
      aria-label="Message composer"
      aria-busy={isBusy}
      onSubmit={handleSubmit}
      className={cn('shrink-0 px-2 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] sm:px-4', theme.composer)}
    >
      <label htmlFor={inputId} className="sr-only">
        {draft.editing ? 'Edit AI draft' : `Reply to ${customerName}`}
      </label>

      {draft.editing && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border-l-4 border-violet-500 bg-violet-500/10 px-3 py-1.5 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-violet-700 dark:text-violet-300">
            <PencilLine aria-hidden="true" className="size-3.5" />
            Editing the AI draft before sending
          </span>
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={isBusy}
            className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 font-medium text-content-secondary hover:bg-surface-hover"
          >
            <X aria-hidden="true" className="size-3.5" />
            Cancel edit
          </button>
        </div>
      )}
      {isStaleEdit && (
        <p role="alert" className="mb-2 text-[13px] text-warning">
          This draft is no longer pending. Your edit is preserved; cancel editing to return to your
          reply.
        </p>
      )}

      <div className="flex items-end gap-2">
        {!draft.editing && (
          <label
            className={cn(
              'relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full',
              channel === 'whatsapp' ? 'text-[#54656f] hover:bg-black/5 dark:text-[#8696a0]' : 'text-violet-600 hover:bg-violet-500/10 dark:text-violet-300',
            )}
            title="Approved quick replies"
          >
            <Zap aria-hidden="true" className="size-5" />
            <select
              aria-label="Insert approved reply"
              value=""
              disabled={isBusy || isDisabled}
              onChange={(event) => {
                const template = templates.find((item) => item.label === event.target.value);
                if (template) onChange(value ? `${value}\n\n${template.text}` : template.text);
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">Approved replies</option>
              {templates.map((template) => (
                <option key={template.label} value={template.label}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className={cn('flex min-w-0 flex-1 items-end px-4 py-2', theme.composerInput)}>
          <textarea
            ref={textareaRef}
            id={inputId}
            dir="auto"
            rows={1}
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
            placeholder={channel === 'whatsapp' ? 'Type a message' : 'Message…'}
            className="block max-h-[168px] min-h-6 w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={!canSend}
          aria-label={sendLabel}
          className={cn(
            'flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-opacity disabled:opacity-40 sm:px-4',
            theme.sendButton,
          )}
        >
          <Send aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline" aria-hidden="true">
            {draft.action === 'send' ? 'Sending…' : draft.editing ? 'Save & send' : 'Send'}
          </span>
        </button>
      </div>

      {draft.error && (
        <p id={errorId} role="alert" className="mt-2 px-2 text-[13px] leading-5 text-danger">
          {draft.error}
        </p>
      )}
      {draft.notice && (
        <p role="status" className="mt-2 px-2 text-[13px] leading-5 text-content-secondary">
          {draft.notice}
        </p>
      )}
      <p id={hintId} className="mt-1 hidden px-2 text-[11px] text-muted-foreground sm:block">
        Ctrl / ⌘ + Enter to send · replying to {customerName} on {theme.label}
      </p>
    </form>
  );
}
