export type DraftStatus = 'pending_review' | 'approved_sent' | 'rejected' | 'modified_sent';

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
}

export interface CreateDraftInput {
  conversationId: string;
  leadId?: string | null;
  suggestedText: string;
  rationale?: string | null;
}

export interface ResolveDraftInput {
  status: 'approved_sent' | 'rejected' | 'modified_sent';
  modifiedText?: string | null;
  reviewedBy?: string | null;
}
