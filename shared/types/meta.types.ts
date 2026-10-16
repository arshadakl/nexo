export type MetaProvider = 'instagram' | 'whatsapp';

export type ConnectionStatus =
  | 'pending'
  | 'connected'
  | 'reconnect_required'
  | 'disconnected'
  | 'error';

export interface MetaConnectionSummary {
  id: string;
  provider: MetaProvider;
  externalAccountId: string;
  displayName?: string | undefined;
  phoneNumber?: string | undefined;
  status: ConnectionStatus;
  grantedScopes: string[];
  webhookSubscribed: boolean;
  lastHealthCheckAt?: number | undefined;
  lastWebhookAt?: number | undefined;
  errorCode?: string | undefined;
  tokenExpiresAt?: number | undefined;
  createdAt: number;
}

export interface DecryptedConnection {
  id: string;
  tenantId: string;
  provider: MetaProvider;
  externalAccountId: string;
  displayName?: string | undefined;
  phoneNumber?: string | undefined;
  phoneNumberId?: string | undefined;
  wabaId?: string | undefined;
  accessToken: string; // Decrypted plaintext token in memory
  tokenExpiresAt?: number | undefined;
  status: ConnectionStatus;
  grantedScopes: string[];
  webhookSubscribed: boolean;
}

export interface OAuthConnectResponse {
  authUrl: string;
  state: string;
}

export interface InstagramAccountProfile {
  id: string;
  username: string;
  accountType?: string | undefined;
  profilePictureUrl?: string | undefined;
}

export interface NormalizedInboundMessageEvent {
  eventKey: string;
  provider: MetaProvider;
  externalAccountId: string;
  providerConvoId: string;
  providerMessageId: string;
  senderId: string;
  senderName?: string | undefined;
  messageText: string;
  timestamp: number;
}
