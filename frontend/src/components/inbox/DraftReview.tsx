import { useState } from 'react';
import { FileText, Pencil, Check, X, AlertTriangle, RotateCw } from 'lucide-react';
import type { MessageDraft } from '@shared/types/draft.types';
import { Button } from '@/components/ui/button';
import { relativeTime, absoluteTime } from '@/lib/formatDate';
import { reviewKindLabels } from '@/lib/leadPresentation';

export type RejectNextAction = 'take_over' | 'resume_ai';

export function DraftReview({
  draft,
  isEditing,
  isBusy,
  onEdit,
  onApprove,
  onReject,
  onRetry,
}: {
  draft: MessageDraft;
  isEditing: boolean;
  isBusy: boolean;
  onEdit: () => void;
  onApprove: (acknowledgeNewMessages: boolean) => void;
  onReject: (nextAction: RejectNextAction) => void;
  onRetry?: (acknowledgeNewMessages: boolean) => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [rejectNext, setRejectNext] = useState<RejectNextAction>('take_over');
  const newMessages = draft.newInboundMessages ?? [];
  const needsAck = newMessages.length > 0 && !acknowledged;
  const isFailed = draft.status === 'send_failed';
  const isSending = draft.status === 'sending';
  const text = draft.modifiedText || draft.suggestedText;
  const locked = isBusy || isEditing || isSending;

  return (
    <section
      aria-label="AI draft review"
      className="shrink-0 rounded-lg border border-border bg-surface-panel p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <h3 className="flex items-center gap-2 font-medium text-foreground">
          <FileText aria-hidden="true" className="size-4 text-primary" />
          {isFailed ? 'Approved reply' : 'AI draft'}{' '}
          <span className="text-muted-foreground">
            ·{' '}
            {isEditing
              ? 'Editing below'
              : isFailed
                ? 'Not delivered'
                : isSending
                  ? 'Sending…'
                  : 'Needs review'}
          </span>
        </h3>
        <time
          dateTime={new Date(draft.createdAt).toISOString()}
          title={absoluteTime(draft.createdAt)}
          className="text-muted-foreground"
        >
          {relativeTime(draft.createdAt)}
        </time>
      </div>

      {(draft.reviewKind || draft.reviewReason) && (
        <div className="mt-3 space-y-1 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs leading-5">
          {draft.reviewKind && (
            <p className="font-medium text-warning">{reviewKindLabels[draft.reviewKind] ?? 'Needs review'}</p>
          )}
          {draft.reviewReason && (
            <p className="text-content-primary">
              <span className="text-content-secondary">To confirm: </span>
              {draft.reviewReason}
            </p>
          )}
          {draft.customerQuestion && (
            <p dir="auto" className="text-content-secondary [overflow-wrap:anywhere]">
              Customer asked: “{draft.customerQuestion}”
            </p>
          )}
        </div>
      )}

      {isFailed && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-danger">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="[overflow-wrap:anywhere]">
            Not delivered{draft.lastError ? `: ${draft.lastError}` : '.'} The AI stays paused until this is retried,
            edited or rejected.
          </span>
        </p>
      )}

      {!isEditing && (
        <p
          dir="auto"
          className="my-3 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]"
        >
          {text || <span className="text-content-secondary">No reply suggested. Edit to write one.</span>}
        </p>
      )}

      {newMessages.length > 0 && (
        <div className="my-3 space-y-2 rounded-md border border-danger/30 bg-danger/5 p-2.5 text-xs leading-5">
          <p className="font-medium text-danger">
            The customer sent {newMessages.length} new message{newMessages.length === 1 ? '' : 's'} after this draft
            was written:
          </p>
          <ul className="space-y-1">
            {newMessages.map((m) => (
              <li key={m.id} dir="auto" className="[overflow-wrap:anywhere]">
                “{m.messageText}”
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-content-primary">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              disabled={locked}
            />
            I’ve read these and the reply still fits
          </label>
        </div>
      )}

      {draft.rationale && (
        <details className="my-2 text-xs text-content-secondary">
          <summary className="w-fit cursor-pointer py-1">Why this reply?</summary>
          <p className="mt-2 whitespace-pre-wrap leading-5">{draft.rationale}</p>
        </details>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <label className="mr-auto flex items-center gap-1.5 text-xs text-content-secondary">
          After rejecting
          <select
            aria-label="After rejecting"
            className="rounded-md border border-border bg-surface-panel px-1.5 py-1 text-xs text-content-primary"
            value={rejectNext}
            onChange={(event) => setRejectNext(event.target.value as RejectNextAction)}
            disabled={locked}
          >
            <option value="take_over">team replies (take over)</option>
            <option value="resume_ai">AI continues</option>
          </select>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10"
          onClick={() => onReject(rejectNext)}
          disabled={locked}
        >
          <X aria-hidden="true" className="size-3.5" />
          Reject
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10"
          onClick={onEdit}
          disabled={locked}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Edit
        </Button>
        {isFailed ? (
          <Button
            type="button"
            size="sm"
            className="min-h-10"
            onClick={() => onRetry?.(acknowledged)}
            disabled={locked || needsAck || !text}
          >
            <RotateCw aria-hidden="true" className="size-3.5" />
            Retry send
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="min-h-10"
            onClick={() => onApprove(acknowledged)}
            disabled={locked || needsAck || !text}
          >
            <Check aria-hidden="true" className="size-3.5" />
            Approve & send
          </Button>
        )}
      </div>
    </section>
  );
}
