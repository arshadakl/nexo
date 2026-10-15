export interface MetaConnectionSummary {
  id: string;
  provider: 'instagram' | 'whatsapp';
  externalAccountId: string;
  displayName?: string;
  phoneNumber?: string;
  status: 'pending' | 'connected' | 'reconnect_required' | 'disconnected' | 'error';
  grantedScopes: string[];
  webhookSubscribed: boolean;
  lastHealthCheckAt?: number;
  lastWebhookAt?: number;
  errorCode?: string;
  tokenExpiresAt?: number;
  createdAt: number;
}

export interface NormalizedInboundMessageEvent {
  eventKey: string;
  provider: 'instagram' | 'whatsapp';
  externalAccountId: string;
  providerConvoId: string;
  providerMessageId: string;
  senderId: string;
  senderName?: string;
  messageText: string;
  timestamp: number;
}
