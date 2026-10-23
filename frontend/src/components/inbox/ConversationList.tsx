import { Search, RefreshCw, MessageSquare, Instagram, MessageCircle, Inbox, AlertCircle } from 'lucide-react';
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
      <div className="shrink-0 space-y-3 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">Chats</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Refresh conversations"
            disabled={isFetching}
            onClick={onRefresh}
          >
            <RefreshCw aria-hidden="true" className={cn('size-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search conversations"
            placeholder="Search names or messages…"
            value={route.search}
            onChange={(event) => onChange({ search: event.target.value }, true)}
            className="h-10 rounded-full border-transparent bg-surface-hover pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by channel">
          {(
            [
              { value: 'all', label: 'All', Icon: Inbox, active: 'bg-foreground text-background' },
              { value: 'instagram', label: 'Instagram', Icon: Instagram, active: 'ig-ring text-white' },
              { value: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, active: 'bg-[#25D366] text-white' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={route.channel === tab.value}
              onClick={() => onChange({ channel: tab.value })}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
                route.channel === tab.value ? tab.active : 'bg-surface-hover text-content-secondary hover:text-content-primary',
              )}
            >
              <tab.Icon aria-hidden="true" className="size-3.5" />
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={route.humanOnly}
            onClick={() => onChange({ humanOnly: !route.humanOnly })}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
              route.humanOnly ? 'bg-amber-500 text-white' : 'bg-surface-hover text-content-secondary hover:text-content-primary',
            )}
          >
            <AlertCircle aria-hidden="true" className="size-3.5" />
            Needs attention
          </button>
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
          <div role="status" className="space-y-4 p-4">
            <span className="sr-only">Loading conversations</span>
            {[1, 2, 3, 4].map((key) => (
              <div key={key} className="flex items-center gap-3">
                <Skeleton className="size-11 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations?.length ? (
          <ul className={cn('pb-2', isFiltering && 'opacity-60')}>
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
              <span className="brand-gradient mx-auto flex size-12 items-center justify-center rounded-2xl text-white">
                <MessageSquare aria-hidden="true" className="size-6" />
              </span>
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
                  className="rounded-full"
                  onClick={() => onChange({ search: '', channel: 'all', humanOnly: false })}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )
        )}
      </div>
      <p className="shrink-0 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        {isFiltering
          ? 'Updating search…'
          : `${conversations?.length ?? 0} loaded · up to 50 recent results`}
      </p>
    </section>
  );
}
