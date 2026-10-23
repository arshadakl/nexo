import type { ConversationSummary } from '@shared/types/crm.types';
import { absoluteTime, relativeTime } from '@/lib/formatDate';
import { automationLabels, leadLabels, qualificationLabels } from '@/lib/leadPresentation';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

const qualificationChip: Record<string, string> = {
  hot: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  warm: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  cold: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
};

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
  const automationState =
    conversation.automationState ??
    (conversation.humanTakeover ? 'human_takeover' : conversation.aiMode === 'OFF' ? 'ai_off' : 'ai_active');
  const qualification = conversation.lead?.qualification;
  const unread = conversation.unreadCount > 0;
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
          'mx-2 my-0.5 flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors focus-visible:relative focus-visible:z-10 focus-visible:-outline-offset-2',
          isSelected ? 'bg-violet-500/10 ring-1 ring-violet-500/30' : 'hover:bg-surface-hover',
        )}
      >
        <Avatar name={conversation.customerName} channel={conversation.channel} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'truncate text-[14px] text-foreground',
                unread ? 'font-bold' : 'font-medium',
              )}
            >
              {conversation.customerName || 'Unknown customer'}
            </span>
            <time
              dateTime={new Date(conversation.lastMessageAt).toISOString()}
              title={absoluteTime(conversation.lastMessageAt)}
              className={cn(
                'shrink-0 text-[11px] tabular-nums',
                unread ? 'font-semibold text-violet-600 dark:text-violet-300' : 'text-muted-foreground',
              )}
            >
              {relativeTime(conversation.lastMessageAt)}
            </time>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p
              className={cn(
                'min-w-0 flex-1 truncate text-[13px] leading-5',
                unread ? 'font-medium text-content-primary' : 'text-content-secondary',
              )}
            >
              {conversation.lastMessageText || 'No messages yet'}
            </p>
            {unread && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-bold text-white">
                {conversation.unreadCount}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1 text-[11px] font-medium">
            <span className="sr-only">
              {conversation.channel === 'instagram' ? 'Instagram' : 'WhatsApp'}
            </span>
            {/* Automation state and lead qualification are independent and shown side by side. */}
            {automationState !== 'ai_active' && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5',
                  automationState === 'send_failed'
                    ? 'bg-danger/15 text-danger'
                    : 'bg-warning/15 text-warning',
                )}
              >
                {automationLabels[automationState]}
              </span>
            )}
            {qualification && qualificationChip[qualification] && (
              <span className={cn('rounded-full px-2 py-0.5', qualificationChip[qualification])}>
                {qualificationLabels[qualification]}
              </span>
            )}
            <span className="truncate rounded-full bg-surface-hover px-2 py-0.5 text-content-secondary">
              {conversation.lead ? leadLabels[conversation.lead.leadStatus] : 'New conversation'}
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}
