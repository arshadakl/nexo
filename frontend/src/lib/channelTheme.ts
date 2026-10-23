import type { ChannelType } from '@shared/types/crm.types';

/**
 * Visual skin for a conversation, modelled on the channel the customer is using so staff
 * instantly recognise where a chat lives: Instagram DMs vs WhatsApp.
 */
export interface ChannelTheme {
  label: string;
  /** Thread header bar. */
  header: string;
  headerMuted: string;
  /** Scrollable message area background. */
  canvas: string;
  /** Customer (inbound) bubble. */
  inbound: string;
  /** Our (outbound) bubble. */
  outbound: string;
  outboundMeta: string;
  inboundMeta: string;
  /** Bubble corner geometry; `first`/`last` refine grouped bubbles. */
  bubbleShape: string;
  composer: string;
  composerInput: string;
  sendButton: string;
  daySeparator: string;
}

export const channelThemes: Record<ChannelType, ChannelTheme> = {
  instagram: {
    label: 'Instagram',
    header: 'bg-surface-panel text-content-primary border-b border-border',
    headerMuted: 'text-content-secondary',
    canvas: 'bg-surface-panel',
    inbound: 'bg-[#efefef] text-[#0a0a0a] dark:bg-[#262626] dark:text-[#f5f5f5]',
    outbound: 'ig-outbound text-white',
    outboundMeta: 'text-white/80',
    inboundMeta: 'text-black/50 dark:text-white/50',
    bubbleShape: 'rounded-[22px]',
    composer: 'bg-surface-panel border-t border-border',
    composerInput:
      'rounded-[22px] border border-border bg-surface-panel focus-within:border-content-muted',
    sendButton: 'ig-send text-white',
    daySeparator: 'text-content-muted',
  },
  whatsapp: {
    label: 'WhatsApp',
    header: 'bg-[#008069] text-white dark:bg-[#202c33] dark:text-[#e9edef]',
    headerMuted: 'text-white/80 dark:text-[#8696a0]',
    canvas: 'wa-wallpaper',
    inbound: 'bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef] shadow-sm',
    outbound: 'bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef] shadow-sm',
    outboundMeta: 'text-[#667781] dark:text-[#ffffff99]',
    inboundMeta: 'text-[#667781] dark:text-[#ffffff99]',
    bubbleShape: 'rounded-lg',
    composer: 'bg-[#f0f2f5] dark:bg-[#202c33] border-t border-transparent',
    composerInput: 'rounded-3xl bg-white dark:bg-[#2a3942] border border-transparent',
    sendButton: 'bg-[#00a884] text-white hover:bg-[#008f72]',
    daySeparator:
      'bg-white/90 text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#8696a0] rounded-md px-2.5 py-1',
  },
};

export function channelTheme(channel: ChannelType | string | undefined): ChannelTheme {
  return channelThemes[(channel as ChannelType) || 'instagram'] ?? channelThemes.instagram;
}

const AVATAR_GRADIENTS = [
  'from-rose-400 to-orange-400',
  'from-violet-500 to-fuchsia-500',
  'from-sky-500 to-indigo-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-pink-500',
  'from-indigo-500 to-cyan-400',
  'from-pink-500 to-purple-500',
  'from-lime-500 to-emerald-500',
];

/** Deterministic, colourful avatar background for a person. */
export function avatarGradient(seed: string | null | undefined): string {
  const text = seed || '?';
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]!;
}

export function initials(name: string | null | undefined): string {
  const words = (name || '')
    .replace(/[@_.]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}|\p{N}/u.test(w));
  if (words.length === 0) return '?';
  const first = Array.from(words[0]!)[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1]!)[0] ?? '') : '';
  return (first + last).toUpperCase();
}
