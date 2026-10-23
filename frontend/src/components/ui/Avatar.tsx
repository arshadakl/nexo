import { Instagram, MessageCircle } from 'lucide-react';
import type { ChannelType } from '@shared/types/crm.types';
import { avatarGradient, initials } from '@/lib/channelTheme';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'size-8 text-[11px]',
  md: 'size-11 text-sm',
  lg: 'size-14 text-base',
};

/** Colourful initials avatar with an optional channel badge (Instagram ring / WhatsApp dot). */
export function Avatar({
  name,
  channel,
  size = 'md',
  className,
}: {
  name: string | null | undefined;
  channel?: ChannelType | undefined;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const face = (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white',
        avatarGradient(name),
        sizes[size],
      )}
    >
      {initials(name)}
    </span>
  );

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {channel === 'instagram' ? (
        <span className="ig-ring rounded-full p-[2px]">
          <span className="block rounded-full bg-surface-panel p-[2px]">{face}</span>
        </span>
      ) : (
        face
      )}
      {channel && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full border-2 border-surface-panel text-white',
            channel === 'instagram' ? 'ig-ring' : 'bg-[#25D366]',
          )}
        >
          {channel === 'instagram' ? (
            <Instagram className="size-2.5" />
          ) : (
            <MessageCircle className="size-2.5" />
          )}
        </span>
      )}
    </span>
  );
}
