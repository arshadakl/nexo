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
  customerName?: string | null;
  customerHandle?: string | null;
  assignedUserId?: string | null;
  status: ConversationStatus;
  aiMode: ConversationAIMode;
  humanTakeover: boolean;
  takeoverUserId?: string | null;
  takeoverAt?: number | null;
  unreadCount: number;
  lastMessageAt: number;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
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
  providerMessageId?: string | null;
  direction: MessageDirection;
  senderType: SenderType;
  senderId?: string | null;
  messageText: string;
  messageType: 'text' | 'image' | 'audio' | 'document' | 'template' | 'unsupported';
  deliveryStatus: MessageDeliveryStatus;
  errorMessage?: string | null;
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

export interface LeadScoreBreakdown {
  intentScore: number;
  completenessScore: number;
  readinessScore: number;
  timelineFitScore: number;
  engagementScore: number;
}

export interface Lead {
  id: string;
  tenantId: string;
  fullName?: string | null;
  residenceCountry?: string | null;
  destinationCountry?: string | null;
  visaCategory?: string | null;
  education?: string | null;
  workExperience?: string | null;
  languageTest?: string | null;
  timeline?: string | null;
  budgetRange?: string | null;
  phoneOrEmail?: string | null;
  leadScore: number;
  scoreBreakdown?: LeadScoreBreakdown | null;
  leadStatus: LeadStatus;
  humanReviewReason?: string | null;
  ownerId?: string | null;
  lastQualifiedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface LeadSummarySnippet {
  id: string;
  fullName?: string | null;
  destinationCountry?: string | null;
  visaCategory?: string | null;
  leadScore: number;
  leadStatus: LeadStatus;
}

export interface ConversationSummary {
  id: string;
  channel: ChannelType;
  customerId: string;
  customerName: string;
  customerHandle?: string | null;
  unreadCount: number;
  lastMessageText: string;
  lastMessageAt: number;
  humanTakeover: boolean;
  aiMode: ConversationAIMode;
  status: ConversationStatus;
  lead?: LeadSummarySnippet | null;
}

export interface ConversationWithDetails extends ConversationSummary {
  connectionId: string;
  assignedUserId?: string | null;
  takeoverUserId?: string | null;
  takeoverAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SendMessageRequest {
  messageText: string;
}

export interface TakeoverRequest {
  takeover: boolean;
}

export interface SetAIModeRequest {
  aiMode: ConversationAIMode;
}

export interface InternalNote {
  id: string;
  tenantId: string;
  conversationId?: string | null;
  leadId?: string | null;
  authorId: string;
  authorName?: string | null;
  content: string;
  createdAt: number;
}

export interface CreateNoteRequest {
  content: string;
}
