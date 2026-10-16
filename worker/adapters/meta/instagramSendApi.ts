import { logger } from '../../lib/logger';

export interface SendInstagramMessageParams {
  accessToken: string;
  recipientId: string;
  text: string;
  graphApiVersion?: string;
}

export interface SendInstagramMessageResult {
  messageId: string;
  recipientId: string;
}

export class InstagramSendApiAdapter {
  /**
   * Dispatches an outbound reply to an eligible customer via Meta Instagram Send API.
   * Note: Only customer-initiated conversations within permitted window are eligible.
   */
  async sendMessage(params: SendInstagramMessageParams): Promise<SendInstagramMessageResult> {
    const version = params.graphApiVersion || 'v21.0';
    const url = `https://graph.instagram.com/${version}/me/messages`;

    const payload = {
      recipient: {
        id: params.recipientId,
      },
      message: {
        text: params.text,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.error('Meta Instagram Send API call failed', null, {
        status: res.status,
        recipientId: params.recipientId,
      });
      throw new Error(`Instagram Send API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    return {
      messageId: String(data.message_id || ''),
      recipientId: String(data.recipient_id || params.recipientId),
    };
  }
}

export const instagramSendApiAdapter = new InstagramSendApiAdapter();
