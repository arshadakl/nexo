export type KnowledgeCategory = 'residency_package' | 'business_service' | 'policy' | 'faq';

export interface BusinessKnowledgeItem {
  id: string;
  tenantId: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  priceAed?: number | null;
  isApprovedByClient: boolean;
  approvalNotes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateKnowledgeItemInput {
  category: KnowledgeCategory;
  title: string;
  content: string;
  priceAed?: number | null;
  isApprovedByClient?: boolean;
  approvalNotes?: string | null;
}

export interface UpdateKnowledgeItemInput {
  category?: KnowledgeCategory;
  title?: string;
  content?: string;
  priceAed?: number | null;
  isApprovedByClient?: boolean;
  approvalNotes?: string | null;
}
