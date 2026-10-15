export type ChannelType = 'instagram' | 'whatsapp';

export type ConversationAIMode = 'INHERIT' | 'ON' | 'OFF';

export type ConversationStatus = 'open' | 'closed' | 'archived';

export interface Conversation {
  id: string;
  tenantId: string;
  connectionId: string;
  channel: ChannelType;
  providerConvoId: string;
  customerId: string;
  customerName?: string;
  customerHandle?: string;
  assignedUserId?: string;
  status: ConversationStatus;
  aiMode: ConversationAIMode;
  humanTakeover: boolean;
  takeoverUserId?: string;
  takeoverAt?: number;
  unreadCount: number;
  lastMessageAt: number;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type MessageDirection = 'inbound' | 'outbound';

export type SenderType = 'applicant' | 'ai' | 'staff' | 'system';

export type MessageDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';

export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  providerMessageId?: string;
  direction: MessageDirection;
  senderType: SenderType;
  senderId?: string;
  messageText: string;
  messageType: 'text' | 'image' | 'audio' | 'document' | 'template' | 'unsupported';
  deliveryStatus: MessageDeliveryStatus;
  errorMessage?: string;
  createdAt: number;
}

export type LeadStatus =
  | 'new'
  | 'collecting_information'
  | 'qualified'
  | 'consultation_booked'
  | 'converted'
  | 'unqualified'
  | 'spam_irrelevant'
  | 'needs_human_review'
  | 'closed_lost';

export interface Lead {
  id: string;
  tenantId: string;
  fullName?: string;
  residenceCountry?: string;
  destinationCountry?: string;
  visaCategory?: string;
  education?: string;
  workExperience?: string;
  languageTest?: string;
  timeline?: string;
  budgetRange?: string;
  phoneOrEmail?: string;
  leadScore: number;
  scoreBreakdown?: {
    intentScore: number;
    completenessScore: number;
    readinessScore: number;
    timelineFitScore: number;
    engagementScore: number;
  };
  leadStatus: LeadStatus;
  humanReviewReason?: string;
  ownerId?: string;
  lastQualifiedAt?: number;
  createdAt: number;
  updatedAt: number;
}
