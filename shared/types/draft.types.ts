export type DraftStatus =
  | 'pending_review'
  | 'sending'
  | 'send_failed'
  | 'approved_sent'
  | 'modified_sent'
  | 'rejected'
  | 'superseded';

/** Why a reply was held for a person instead of being sent automatically. */
export type DraftReviewKind =
  | 'business_confirmation'
  | 'human_requested'
  | 'policy_block'
  | 'model_fallback'
  | 'ai_review';

export interface DraftContextMessage {
  id: string;
  messageText: string;
  messageType: string;
  createdAt: number;
}

export interface MessageDraft {
  id: string;
  tenantId: string;
  conversationId: string;
  leadId?: string | null;
  suggestedText: string;
  rationale?: string | null;
  status: DraftStatus;
  modifiedText?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: number | null;
  createdAt: number;
  updatedAt?: number | null;
  reviewKind?: DraftReviewKind | null;
  reviewReason?: string | null;
  customerQuestion?: string | null;
  basedOnMessageAt?: number | null;
  sentMessageId?: string | null;
  sendAttempts?: number;
  lastError?: string | null;
  /** Customer messages that arrived after this draft was written. */
  newInboundMessages?: DraftContextMessage[];
}

export interface CreateDraftInput {
  conversationId: string;
  leadId?: string | null;
  suggestedText: string;
  rationale?: string | null;
  reviewKind?: DraftReviewKind | null;
  reviewReason?: string | null;
  customerQuestion?: string | null;
  basedOnMessageAt?: number | null;
}

export interface ResolveDraftInput {
  status: 'approved_sent' | 'rejected' | 'modified_sent';
  modifiedText?: string | null;
  reviewedBy?: string | null;
}
