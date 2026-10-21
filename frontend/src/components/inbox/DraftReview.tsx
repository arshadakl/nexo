import { FileText, Pencil, Check, X } from 'lucide-react';
import type { MessageDraft } from '@shared/types/draft.types';
import { Button } from '@/components/ui/button';
import { relativeTime, absoluteTime } from '@/lib/formatDate';

export function DraftReview({
  draft,
  isEditing,
  isBusy,
  onEdit,
  onApprove,
  onReject,
}: {
  draft: MessageDraft;
  isEditing: boolean;
  isBusy: boolean;
  onEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <section
      aria-label="AI draft review"
      className="shrink-0 rounded-lg border border-border bg-surface-panel p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <h3 className="flex items-center gap-2 font-medium text-foreground">
          <FileText aria-hidden="true" className="size-4 text-primary" />
          AI draft{' '}
          <span className="text-muted-foreground">
            · {isEditing ? 'Editing below' : 'Needs review'}
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
      {!isEditing && (
        <p
          dir="auto"
          className="my-3 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]"
        >
          {draft.suggestedText}
        </p>
      )}
      {draft.rationale && (
        <details className="my-2 text-xs text-content-secondary">
          <summary className="w-fit cursor-pointer py-1">Why this reply?</summary>
          <p className="mt-2 whitespace-pre-wrap leading-5">{draft.rationale}</p>
        </details>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10"
          onClick={onReject}
          disabled={isBusy || isEditing}
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
          disabled={isBusy || isEditing}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          size="sm"
          className="min-h-10"
          onClick={onApprove}
          disabled={isBusy || isEditing}
        >
          <Check aria-hidden="true" className="size-3.5" />
          Approve & send
        </Button>
      </div>
    </section>
  );
}
