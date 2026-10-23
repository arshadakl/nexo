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
    <div className={cn('h-full min-h-0 w-full shrink-0 border-r border-border md:block md:w-[340px]', route.conversationId && 'hidden')}>
      <ConversationList route={route} conversations={conversations.data} isLoading={conversations.isPending} isError={conversations.isError} isFetching={conversations.isFetching} isFiltering={search !== route.search} onChange={onRouteChange} onRefresh={() => { void conversations.refetch(); }} />
    </div>
    {route.conversationId ? <ConversationThread key={route.conversationId} conversationId={route.conversationId} onBack={() => onRouteChange({ conversationId: null })} /> : <div className="brand-gradient-soft hidden min-w-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center md:flex"><span className="brand-gradient flex size-16 items-center justify-center rounded-3xl text-white shadow-lg"><MessageSquare aria-hidden="true" className="size-8" /></span><h2 className="text-lg font-bold">Your Instagram &amp; WhatsApp chats</h2><p className="max-w-xs text-[13px] leading-5 text-content-secondary">Pick a conversation to read messages, review AI drafts and reply. Instagram chats look like Instagram, WhatsApp chats look like WhatsApp.</p></div>}
  </div>;
}
