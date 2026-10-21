import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';
import type { Message } from '@shared/types/crm.types';
import { absoluteTime } from '@/lib/formatDate';
import { cn } from '@/lib/utils';

const deliveryLabels = {
  pending: 'Pending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed to send',
  unknown: 'Delivery not confirmed',
};

export function MessageItem({ message, customerName }: { message: Message; customerName: string }) {
  const isOutbound = message.direction === 'outbound';
  const sender =
    message.senderType === 'ai'
      ? 'Resider AI'
      : message.senderType === 'staff'
        ? 'Resider team'
        : message.senderType === 'system'
          ? 'System'
          : customerName;
  const StatusIcon =
    message.deliveryStatus === 'failed'
      ? AlertCircle
      : message.deliveryStatus === 'pending' || message.deliveryStatus === 'unknown'
        ? Clock
        : message.deliveryStatus === 'sent'
          ? Check
          : CheckCheck;
  return (
    <li className={cn('flex flex-col gap-1.5', isOutbound ? 'items-end' : 'items-start')}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-content-secondary">{sender}</span>
        <time
          dateTime={new Date(message.createdAt).toISOString()}
          title={absoluteTime(message.createdAt)}
        >
          {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
            message.createdAt,
          )}
        </time>
      </div>
      <div
        className={cn(
          'max-w-[92%] rounded-lg border px-4 py-3 text-sm leading-relaxed sm:max-w-[85%]',
          isOutbound ? 'border-border bg-surface-raised' : 'border-border bg-surface-panel',
        )}
      >
        {message.messageType !== 'text' && (
          <p className="mb-2 text-xs capitalize text-muted-foreground">
            {message.messageType} message
          </p>
        )}
        <p dir="auto" className="whitespace-pre-wrap [overflow-wrap:anywhere]">
          {message.messageText || 'No text available for this message.'}
        </p>
      </div>
      {isOutbound && (
        <div
          className={cn(
            'flex max-w-full flex-wrap items-center gap-1 text-xs',
            message.deliveryStatus === 'failed' ? 'text-danger' : 'text-muted-foreground',
          )}
        >
          <StatusIcon aria-hidden="true" className="size-3.5" />
          <span>{deliveryLabels[message.deliveryStatus] ?? deliveryLabels.unknown}</span>
          {message.deliveryStatus === 'failed' && message.errorMessage && (
            <span className="basis-full [overflow-wrap:anywhere]">{message.errorMessage}</span>
          )}
        </div>
      )}
    </li>
  );
}
