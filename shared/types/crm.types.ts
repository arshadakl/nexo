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

/**
 * RESIDER Official Lead Statuses (Section 6)
 */
export type LeadStatus =
  | 'needs_clarification'
  | 'exploring'
  | 'ready_for_team'
  | 'handover_requested'
  | 'handed_over'
  | 'support_enquiry'
  | 'outside_scope_request'
  | 'outside_scope_spam';

export type ServiceVertical = 'residency' | 'business_setup' | 'both' | 'unspecified';

export type ResidencyIntent =
  | 'permit_with_residency'
  | 'residency_only'
  | 'understanding_options'
  | 'unspecified';

export type LocationContext = 'inside_uae' | 'outside_uae' | 'undecided' | 'unknown';

export type ContactMethodPreference = 'whatsapp' | 'phone_call' | 'instagram_dm';

export interface Lead {
  id: string;
  tenantId: string;
  fullName?: string | null;
  phoneOrEmail?: string | null;
  serviceVertical: ServiceVertical;
  residencyIntent: ResidencyIntent;
  workBusinessActivity?: string | null;
  uaeLocationContext: LocationContext;
  targetEmirate?: string | null;
  timeline?: string | null;
  detectedLanguage: string;
  contactMethodPreference?: ContactMethodPreference | null;
  contactPermission: boolean;
  externalSharingPermission: boolean;
  leadStatus: LeadStatus;
  statusReason?: string | null;
  missingDetails: string[];
  questionsAnswered: string[];
  assignedExpertId?: string | null;
  ownerId?: string | null;
  nextAction?: string | null;
  nextActionOwner?: string | null;
  summary?: string | null;
  lastQualifiedAt?: number | null;
  createdAt: number;
  updatedAt: number;

  currentLocation?: string | null;
  nationality?: string | null;
  profession?: string | null;
  whatsappNumber?: string | null;
  whatsappSameAsPhone?: boolean | null;
  whatsappContactPermission?: boolean | null;
  unansweredQuestions?: string[];
  confusions?: string[];

  // Compatibility getters/fallbacks
  phoneNumber?: string | null;
}

export interface LeadSummarySnippet {
  id: string;
  fullName?: string | null;
  phoneOrEmail?: string | null;
  serviceVertical: ServiceVertical;
  residencyIntent: ResidencyIntent;
  leadStatus: LeadStatus;
  statusReason?: string | null;
  missingDetails: string[];
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

export interface CreateNoteRequest {
  content: string;
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
