import { Search, RefreshCw, MessageSquare } from 'lucide-react';
import type { ConversationSummary } from '@shared/types/crm.types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ConversationRow } from './ConversationRow';
import { inboxHref, type WorkspaceRoute } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export type InboxRoutePatch = Partial<
  Pick<WorkspaceRoute, 'conversationId' | 'channel' | 'search' | 'humanOnly'>
>;
export interface ConversationListProps {
  route: WorkspaceRoute;
  conversations: ConversationSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isFiltering: boolean;
  onChange: (patch: InboxRoutePatch, replace?: boolean) => void;
  onRefresh: () => void;
}

export function ConversationList({
  route,
  conversations,
  isLoading,
  isError,
  isFetching,
  isFiltering,
  onChange,
  onRefresh,
}: ConversationListProps) {
  const hasFilters = Boolean(route.search || route.channel !== 'all' || route.humanOnly);
  return (
    <section aria-label="Conversations" className="flex h-full min-h-0 flex-col bg-surface-panel">
      <div className="shrink-0 space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold">Conversations</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="Refresh conversations"
            disabled={isFetching}
            onClick={onRefresh}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3 size-4 text-muted-foreground"
          />
          <Input
            aria-label="Search conversations"
            placeholder="Search names or messages…"
            value={route.search}
            onChange={(event) => onChange({ search: event.target.value }, true)}
            className="h-10 pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter by channel"
            value={route.channel}
            onChange={(event) =>
              onChange({ channel: event.target.value as WorkspaceRoute['channel'] })
            }
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-[13px] text-foreground"
          >
            <option value="all">All channels</option>
            <option value="instagram">Instagram</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <Button
            type="button"
            variant={route.humanOnly ? 'secondary' : 'ghost'}
            aria-pressed={route.humanOnly}
            onClick={() => onChange({ humanOnly: !route.humanOnly })}
            className="h-10 px-2"
          >
            Human handling
          </Button>
        </div>
      </div>
      {isError && (
        <ErrorState
          message={
            conversations
              ? 'Could not refresh. Showing previous results.'
              : 'Could not load conversations.'
          }
          onRetry={onRefresh}
        />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={isLoading || isFiltering}>
        {isLoading ? (
          <div role="status" className="space-y-5 p-4">
            <span className="sr-only">Loading conversations</span>
            {[1, 2, 3, 4].map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : conversations?.length ? (
          <ul className={cn(isFiltering && 'opacity-60')}>
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                isSelected={route.conversationId === conversation.id}
                href={inboxHref({ ...route, conversationId: conversation.id })}
                onSelect={() => onChange({ conversationId: conversation.id })}
              />
            ))}
          </ul>
        ) : (
          !isError && (
            <div className="space-y-3 px-6 py-12 text-center">
              <MessageSquare aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
              <h3 className="text-sm font-medium">
                {hasFilters ? 'No matching conversations' : 'Your inbox is clear'}
              </h3>
              <p className="text-[13px] leading-5 text-content-secondary">
                {hasFilters
                  ? 'Try another search or clear your filters.'
                  : 'New Instagram and WhatsApp enquiries will appear here.'}
              </p>
              {hasFilters && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onChange({ search: '', channel: 'all', humanOnly: false })}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )
        )}
      </div>
      <p className="shrink-0 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {isFiltering
          ? 'Updating search…'
          : `${conversations?.length ?? 0} loaded · up to 50 recent results`}
      </p>
    </section>
  );
}
