import { Instagram, MessageCircle, Circle } from 'lucide-react';
import type { ConversationSummary } from '@shared/types/crm.types';
import { absoluteTime, relativeTime } from '@/lib/formatDate';
import { leadLabels } from '@/lib/leadPresentation';
import { cn } from '@/lib/utils';

export function ConversationRow({
  conversation,
  isSelected,
  href,
  onSelect,
}: {
  conversation: ConversationSummary;
  isSelected: boolean;
  href: string;
  onSelect: () => void;
}) {
  const ChannelIcon = conversation.channel === 'instagram' ? Instagram : MessageCircle;
  return (
    <li>
      <a
        href={href}
        aria-current={isSelected ? 'true' : undefined}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          onSelect();
        }}
        className={cn(
          'block border-b border-border px-4 py-4 focus-visible:relative focus-visible:z-10 focus-visible:-outline-offset-2',
          isSelected ? 'bg-surface-selected' : 'hover:bg-surface-hover',
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <span
            className={cn(
              'truncate text-[13px] text-foreground',
              conversation.unreadCount > 0 ? 'font-semibold' : 'font-medium',
            )}
          >
            {conversation.customerName || 'Unknown customer'}
          </span>
          <time
            dateTime={new Date(conversation.lastMessageAt).toISOString()}
            title={absoluteTime(conversation.lastMessageAt)}
            className="shrink-0 text-xs tabular-nums text-muted-foreground"
          >
            {relativeTime(conversation.lastMessageAt)}
          </time>
        </div>
        <p className="truncate text-[13px] leading-5 text-content-secondary">
          {conversation.lastMessageText || 'No messages yet'}
        </p>
        <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <ChannelIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sr-only">
            {conversation.channel === 'instagram' ? 'Instagram' : 'WhatsApp'}
          </span>
          <span className={cn('truncate', conversation.humanTakeover && 'text-warning')}>
            {conversation.humanTakeover
              ? 'Human handling'
              : conversation.lead
                ? leadLabels[conversation.lead.leadStatus]
                : 'New conversation'}
          </span>
          {conversation.unreadCount > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-1 text-foreground">
              <Circle aria-hidden="true" className="size-1.5 fill-current" />
              <span>{conversation.unreadCount} unread</span>
            </span>
          )}
        </div>
      </a>
    </li>
  );
}
