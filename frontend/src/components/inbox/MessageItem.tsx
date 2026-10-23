import { AlertCircle, Check, CheckCheck, Clock, FileText, Image as ImageIcon, Mic, Paperclip, RotateCw, Sparkles, UserRound } from 'lucide-react';
import type { ChannelType, Message } from '@shared/types/crm.types';
import { absoluteTime } from '@/lib/formatDate';
import { channelTheme } from '@/lib/channelTheme';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

const deliveryLabels = {
  pending: 'Pending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed to send',
  unknown: 'Delivery not confirmed',
};

const attachmentLabels: Record<string, { label: string; Icon: typeof Mic }> = {
  audio: { label: 'Voice note', Icon: Mic },
  image: { label: 'Photo or video', Icon: ImageIcon },
  document: { label: 'File', Icon: FileText },
  unsupported: { label: 'Attachment', Icon: Paperclip },
  template: { label: 'Template', Icon: FileText },
};

const PLACEHOLDERS = new Set(['[Voice note]', '[Image or video]', '[File]', '[Attachment]']);

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function MessageItem({
  message,
  customerName,
  channel = 'instagram',
  isFirstInGroup = true,
  isLastInGroup = true,
  onRetry,
  isRetrying = false,
}: {
  message: Message;
  customerName: string;
  channel?: ChannelType | undefined;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onRetry?: (() => void) | undefined;
  isRetrying?: boolean;
}) {
  const theme = channelTheme(channel);
  const isWhatsApp = channel === 'whatsapp';
  const isOutbound = message.direction === 'outbound';
  const isFailed = message.deliveryStatus === 'failed';
  const sender =
    message.senderType === 'ai'
      ? 'Resider AI'
      : message.senderType === 'staff'
        ? 'Resider team'
        : message.senderType === 'system'
          ? 'System'
          : customerName;
  const attachment = message.messageType !== 'text' ? attachmentLabels[message.messageType] : undefined;
  const text = PLACEHOLDERS.has(message.messageText) ? '' : message.messageText;
  const time = (
    <time dateTime={new Date(message.createdAt).toISOString()} title={absoluteTime(message.createdAt)}>
      {timeFormat.format(message.createdAt)}
    </time>
  );
  const StatusIcon = isFailed
    ? AlertCircle
    : message.deliveryStatus === 'pending' || message.deliveryStatus === 'unknown'
      ? Clock
      : message.deliveryStatus === 'sent'
        ? Check
        : CheckCheck;
  const status = isOutbound ? (
    <span className="inline-flex items-center" title={deliveryLabels[message.deliveryStatus] ?? deliveryLabels.unknown}>
      <StatusIcon
        aria-hidden="true"
        className={cn(
          'size-3.5',
          isFailed && 'text-danger',
          message.deliveryStatus === 'read' && 'text-sky-400',
        )}
      />
      {!isFailed && (
        <span className="sr-only">{deliveryLabels[message.deliveryStatus] ?? deliveryLabels.unknown}</span>
      )}
    </span>
  ) : null;

  // Corner shaping so consecutive bubbles read as one group, like the native apps.
  const groupedCorners = isWhatsApp
    ? cn(isFirstInGroup && (isOutbound ? 'rounded-tr-none' : 'rounded-tl-none'))
    : cn(
        isOutbound
          ? [!isFirstInGroup && 'rounded-tr-md', !isLastInGroup && 'rounded-br-md']
          : [!isFirstInGroup && 'rounded-tl-md', !isLastInGroup && 'rounded-bl-md'],
      );

  return (
    <li className={cn('flex flex-col', isOutbound ? 'items-end' : 'items-start', isFirstInGroup ? 'mt-4' : 'mt-0.5')}>
      {isFirstInGroup && isOutbound && (
        <span
          className={cn(
            'mb-1 inline-flex items-center gap-1 px-1 text-[11px] font-medium',
            isWhatsApp ? 'text-[#54656f] dark:text-[#8696a0]' : 'text-content-secondary',
          )}
        >
          {message.senderType === 'ai' ? (
            <Sparkles aria-hidden="true" className="size-3 text-violet-500" />
          ) : (
            <UserRound aria-hidden="true" className="size-3" />
          )}
          {sender}
        </span>
      )}
      {isFirstInGroup && !isOutbound && <span className="sr-only">{sender}</span>}

      <div className={cn('flex max-w-full items-end gap-2', isOutbound && 'flex-row-reverse')}>
        {!isOutbound && !isWhatsApp && (
          <span className={cn('w-8 shrink-0', !isLastInGroup && 'invisible')}>
            <Avatar name={customerName} size="sm" />
          </span>
        )}
        <div
          className={cn(
            'relative max-w-[85vw] px-3 py-2 text-[14.5px] leading-snug sm:max-w-[min(32rem,75%)]',
            theme.bubbleShape,
            groupedCorners,
            isOutbound ? theme.outbound : theme.inbound,
            isFailed && 'opacity-80 ring-2 ring-danger/60',
          )}
        >
          {attachment && (
            <span
              className={cn(
                'mb-1 flex items-center gap-1.5 text-xs font-medium',
                isOutbound ? theme.outboundMeta : theme.inboundMeta,
              )}
            >
              <attachment.Icon aria-hidden="true" className="size-3.5" />
              {attachment.label}
              {!text && <span className="font-normal">· can’t be opened here</span>}
            </span>
          )}
          {text || !attachment ? (
            <p dir="auto" className="whitespace-pre-wrap [overflow-wrap:anywhere]">
              {text || 'No text available for this message.'}
              {isWhatsApp && <span className="inline-block w-16" aria-hidden="true" />}
            </p>
          ) : null}
          {isWhatsApp && (
            <span
              className={cn(
                'absolute bottom-1 right-2 flex items-center gap-1 text-[11px]',
                isOutbound ? theme.outboundMeta : theme.inboundMeta,
              )}
            >
              {time}
              {status}
            </span>
          )}
        </div>
      </div>

      {!isWhatsApp && isLastInGroup && (
        <span
          className={cn(
            'mt-1 flex items-center gap-1 px-1 text-[11px] text-content-muted',
            !isOutbound && 'pl-11',
          )}
        >
          {time}
          {status}
        </span>
      )}

      {isFailed && (
        <div className="mt-1 flex max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-0.5 px-1 text-xs text-danger">
          <span className="font-medium">Failed to send</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex min-h-8 items-center gap-1 rounded-full bg-danger/10 px-2.5 font-medium hover:bg-danger/20 disabled:opacity-60"
            >
              <RotateCw aria-hidden="true" className="size-3" />
              {isRetrying ? 'Retrying…' : 'Retry'}
            </button>
          )}
          {message.errorMessage && (
            <span className="basis-full text-right [overflow-wrap:anywhere]">{message.errorMessage}</span>
          )}
        </div>
      )}
    </li>
  );
}

/** "Today", "Yesterday" or a date, styled per channel. */
export function DaySeparator({ at, channel }: { at: number; channel?: ChannelType | undefined }) {
  const theme = channelTheme(channel);
  const day = new Date(at);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const label =
    day.toDateString() === today.toDateString()
      ? 'Today'
      : day.toDateString() === yesterday.toDateString()
        ? 'Yesterday'
        : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(day);
  return (
    <li className="my-4 flex justify-center" role="separator" aria-label={label}>
      <span className={cn('text-[11px] font-medium', theme.daySeparator)}>{label}</span>
    </li>
  );
}
