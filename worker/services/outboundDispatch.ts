import { connectionRepository } from '../repositories/connectionRepository';
import { instagramSendApiAdapter } from '../adapters/meta/instagramSendApi';
import { whatsappSendApiAdapter } from '../adapters/meta/whatsappSendApi';
import { logger } from '../lib/logger';

export interface OutboundTarget {
  connectionId: string;
  channel: 'instagram' | 'whatsapp';
  customerId: string;
}

export type DispatchResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

/**
 * Sends one text message through the channel's Send API. Never throws: a missing connection or a
 * provider error is returned as a failure so callers can record it without marking anything sent.
 */
export async function dispatchOutboundText(
  db: D1Database,
  masterKey: string,
  target: OutboundTarget,
  text: string
): Promise<DispatchResult> {
  try {
    const connection = await connectionRepository.getByIdDecrypted(db, target.connectionId, masterKey);
    if (!connection || !connection.accessToken) {
      return { ok: false, error: 'No connected channel account is available to send this message.' };
    }

    if (target.channel === 'whatsapp') {
      const result = await whatsappSendApiAdapter.sendMessage({
        phoneNumberId: connection.phoneNumberId || connection.externalAccountId,
        accessToken: connection.accessToken,
        recipientPhone: target.customerId,
        text,
      });
      return { ok: true, providerMessageId: result.messageId };
    }

    const result = await instagramSendApiAdapter.sendMessage({
      accessToken: connection.accessToken,
      recipientId: target.customerId,
      text,
    });
    return { ok: true, providerMessageId: result.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('Outbound dispatch failed', err, { connectionId: target.connectionId, channel: target.channel });
    return { ok: false, error: error.slice(0, 500) || 'Dispatch failed' };
  }
}
