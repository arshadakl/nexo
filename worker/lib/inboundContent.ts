import type { InboundAttachment, InboundMessageType } from '@shared/types/meta.types';

/**
 * Inbound content the AI pipeline cannot read (voice notes, images, files, shared posts).
 * These are persisted with a placeholder text so the inbox and prompt history stay ordered,
 * and are answered with a fixed text-request fallback instead of being sent to the model as text.
 */

const AUDIO_TYPES = new Set(['audio', 'voice']);
const IMAGE_TYPES = new Set(['image', 'sticker', 'video', 'animated_image']);
const DOCUMENT_TYPES = new Set(['file', 'document']);
// Shared posts/reels/stories: in real chats ~13% of conversations open this way, usually with
// one of Resider's own posts. They signal interest rather than content we need to read.
const SHARE_TYPES = new Set(['share', 'ig_reel', 'reel', 'ig_post', 'post', 'story_mention', 'ig_story', 'story']);

export const SHARED_POST_PLACEHOLDER = '[Shared post]';

export function isSharedPostOnly(attachments: InboundAttachment[]): boolean {
  return attachments.length > 0 && attachments.every((a) => SHARE_TYPES.has(a.type));
}

export function classifyAttachments(attachments: InboundAttachment[]): InboundMessageType {
  if (attachments.length === 0) return 'text';
  if (attachments.some((a) => AUDIO_TYPES.has(a.type))) return 'audio';
  if (attachments.every((a) => IMAGE_TYPES.has(a.type))) return 'image';
  if (attachments.every((a) => DOCUMENT_TYPES.has(a.type))) return 'document';
  return 'unsupported';
}

const PLACEHOLDERS: Record<Exclude<InboundMessageType, 'text'>, string> = {
  audio: '[Voice note]',
  image: '[Image or video]',
  document: '[File]',
  unsupported: '[Attachment]',
};

/** Text stored in messages.message_text (NOT NULL) for an attachment without a caption. */
export function placeholderText(messageType: InboundMessageType, attachments: InboundAttachment[] = []): string {
  if (messageType === 'text') return '';
  return isSharedPostOnly(attachments) ? SHARED_POST_PLACEHOLDER : PLACEHOLDERS[messageType];
}

export function isSharedPostText(messageText: string): boolean {
  return messageText === SHARED_POST_PLACEHOLDER;
}

/** How an attachment appears in the model's conversation history. */
export function historyText(messageType: string, messageText: string): string {
  if (isSharedPostText(messageText)) {
    return "[The customer shared a post or reel (often one of Resider's own posts). Its content is not visible here.]";
  }
  const placeholderValues = Object.values(PLACEHOLDERS);
  const caption = placeholderValues.includes(messageText) ? '' : messageText;
  if (messageType === 'audio') {
    return `[The customer sent a voice note. It cannot be listened to here and its content is unknown.]${caption ? ` ${caption}` : ''}`;
  }
  if (messageType === 'image' || messageType === 'document' || messageType === 'unsupported') {
    return `[The customer sent an attachment that cannot be opened here; its content is unknown.]${caption ? ` ${caption}` : ''}`;
  }
  return messageText;
}

export function isUnsupportedType(messageType: string): boolean {
  return messageType === 'audio' || messageType === 'image' || messageType === 'document' || messageType === 'unsupported';
}

/** True when an inbound row carries real customer text (an attachment caption counts). */
export function hasCustomerText(messageType: string, messageText: string): boolean {
  if (!isUnsupportedType(messageType)) return messageText.trim().length > 0;
  return (
    !Object.values(PLACEHOLDERS).includes(messageText) &&
    !isSharedPostText(messageText) &&
    messageText.trim().length > 0
  );
}

const FALLBACKS = {
  audio: {
    en: 'I can’t listen to voice notes here yet. Could you send that as text so I can help?',
    ml: 'ഇവിടെ voice note കേൾക്കാൻ ഇപ്പോൾ പറ്റുന്നില്ല. ഒന്ന് text ആയി അയക്കാമോ?',
  },
  attachment: {
    en: 'I can’t open attachments here yet. Could you describe it in text so I can help?',
    ml: 'ഇവിടെ attachment തുറക്കാൻ ഇപ്പോൾ പറ്റുന്നില്ല. ഒന്ന് text ആയി പറയാമോ?',
  },
} as const;

export function unsupportedFallbackText(kind: 'audio' | 'attachment', language: string | null | undefined): string {
  const lang = language === 'ml' ? 'ml' : 'en';
  return FALLBACKS[kind][lang];
}

export function isUnsupportedFallbackText(text: string | null | undefined): boolean {
  if (!text) return false;
  return Object.values(FALLBACKS).some((byLang) => Object.values(byLang).includes(text as never));
}

/** Script-based language hint for replies that are not model-generated. */
export function detectLanguageHint(texts: string[], storedLanguage?: string | null): string {
  const joined = texts.join(' ');
  if (/[ഀ-ൿ]/.test(joined)) return 'ml';
  if (/[؀-ۿ]/.test(joined)) return 'ar';
  if (/[ऀ-ॿ]/.test(joined)) return 'hi';
  return storedLanguage || 'en';
}
