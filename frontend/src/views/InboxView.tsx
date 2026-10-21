import { MessageSquare } from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ConversationList, type InboxRoutePatch } from '@/components/inbox/ConversationList';
import { ConversationThread } from '@/components/inbox/ConversationThread';
import type { WorkspaceRoute } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export function InboxView({ route, onRouteChange }: { route: WorkspaceRoute; onRouteChange: (patch: InboxRoutePatch, replace?: boolean) => void }) {
  const search = useDebouncedValue(route.search);
  const conversations = useConversations({ channel: route.channel, search: search || undefined, takeover: route.humanOnly ? true : undefined });
  return <div className="flex h-full min-h-0 min-w-0 flex-1">
    <div className={cn('h-full min-h-0 w-full shrink-0 border-r border-border md:block md:w-80', route.conversationId && 'hidden')}>
      <ConversationList route={route} conversations={conversations.data} isLoading={conversations.isPending} isError={conversations.isError} isFetching={conversations.isFetching} isFiltering={search !== route.search} onChange={onRouteChange} onRefresh={() => { void conversations.refetch(); }} />
    </div>
    {route.conversationId ? <ConversationThread key={route.conversationId} conversationId={route.conversationId} onBack={() => onRouteChange({ conversationId: null })} /> : <div className="hidden min-w-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center md:flex"><MessageSquare aria-hidden="true" className="size-7 text-muted-foreground" /><h2 className="text-sm font-medium">Select a conversation</h2><p className="max-w-xs text-[13px] leading-5 text-content-secondary">Read customer messages, review AI drafts, and continue the conversation.</p></div>}
  </div>;
}
