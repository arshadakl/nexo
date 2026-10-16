export interface ConnectWhatsAppRequest {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  displayName?: string | undefined;
  phoneNumber?: string | undefined;
}

export interface WhatsAppSendTextParams {
  phoneNumberId: string;
  accessToken: string;
  recipientPhone: string;
  text: string;
}

export interface WhatsAppSendInteractiveButtonParams {
  phoneNumberId: string;
  accessToken: string;
  recipientPhone: string;
  bodyText: string;
  buttons: { id: string; title: string }[];
}

export interface WhatsAppSendMessageResult {
  messageId: string;
  recipientPhone: string;
}

export interface NormalizedWhatsAppMessage {
  eventKey: string;
  provider: 'whatsapp';
  phoneNumberId: string;
  wabaId: string;
  providerConvoId: string;
  providerMessageId: string;
  senderPhone: string;
  senderName?: string | undefined;
  messageText: string;
  timestamp: number;
}
