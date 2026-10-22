import { AlertTriangle, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import type { ActionQueueItem, ActionQueueKind } from '@shared/types/analytics.types';
import type { LeadQualification } from '@shared/types/crm.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useActionQueue } from '@/hooks/useAnalytics';
import { automationLabels, qualificationLabels, qualificationVariant } from '@/lib/leadPresentation';
import { inboxHref, navigate } from '@/lib/navigation';
import { relativeTime, absoluteTime } from '@/lib/formatDate';
import type { AutomationState } from '@shared/types/crm.types';

const kindLabels: Record<ActionQueueKind, string> = {
  send_failed: 'Failed to send',
  human_requested: 'Human requested',
  approval_pending: 'Waiting for approval',
  unanswered: 'Unanswered',
  qualified_awaiting_contact: 'Qualified · awaiting contact',
};

const kindVariant: Record<ActionQueueKind, 'destructive' | 'warning' | 'success' | 'secondary'> = {
  send_failed: 'destructive',
  human_requested: 'warning',
  approval_pending: 'warning',
  unanswered: 'secondary',
  qualified_awaiting_contact: 'success',
};

/** Overview list of conversations that need a person, each with the reason and next action. */
export function ActionQueue() {
  const queue = useActionQueue();
  const items = queue.data ?? [];

  return (
    <Card className="bg-surface-panel border-border">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-content-primary">Needs action</CardTitle>
        <CardDescription className="text-xs text-content-secondary mt-0.5">
          Approvals, human requests, failed sends, unanswered messages and qualified leads awaiting contact
        </CardDescription>
      </CardHeader>
      <CardContent>
        {queue.isPending ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : queue.isError ? (
          <ErrorState message="Could not load the action queue." onRetry={() => void queue.refetch()} />
        ) : items.length === 0 ? (
          <p className="flex items-center gap-2 p-4 text-xs text-content-secondary">
            <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
            Nothing needs a person right now.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <ActionRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActionRow({ item }: { item: ActionQueueItem }) {
  const href = inboxHref({ conversationId: item.conversationId, channel: 'all', search: '', humanOnly: false });
  const qualification = (item.qualification || 'unknown') as LeadQualification;
  return (
    <li>
      <a
        href={href}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          navigate(href);
        }}
        className="flex flex-col gap-1.5 py-3 text-xs hover:bg-surface-hover sm:flex-row sm:items-start sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={kindVariant[item.kind]}>
              {item.kind === 'send_failed' && <AlertTriangle aria-hidden="true" className="size-3" />}
              {kindLabels[item.kind]}
            </Badge>
            <span className="font-medium text-content-primary [overflow-wrap:anywhere]">
              {item.customerName}
              {item.customerHandle ? <span className="text-content-secondary"> · {item.customerHandle}</span> : null}
            </span>
          </div>
          <p dir="auto" className="text-content-secondary [overflow-wrap:anywhere]">
            {item.reason}
          </p>
          <p className="text-content-primary">
            <span className="text-content-secondary">Next: </span>
            {item.nextAction}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {qualification !== 'unknown' && (
            <Badge variant={qualificationVariant[qualification]}>{qualificationLabels[qualification]}</Badge>
          )}
          <span className="text-content-secondary">
            {automationLabels[item.automationState as AutomationState] ?? item.automationState}
          </span>
          <time dateTime={new Date(item.at).toISOString()} title={absoluteTime(item.at)} className="text-muted-foreground">
            {relativeTime(item.at)}
          </time>
          <ArrowUpRight aria-hidden="true" className="hidden size-3.5 text-muted-foreground sm:block" />
        </div>
      </a>
    </li>
  );
}
