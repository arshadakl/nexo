export type KnowledgeCategory = 'residency_package' | 'business_service' | 'policy' | 'faq';

export interface BusinessKnowledgeItem {
  id: string;
  tenantId: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  priceAed?: number | null | undefined;
  isApprovedByClient: boolean;
  approvalNotes?: string | null | undefined;
  createdAt: number;
  updatedAt: number;
}

export interface CreateKnowledgeItemInput {
  category: KnowledgeCategory;
  title: string;
  content: string;
  priceAed?: number | null | undefined;
  isApprovedByClient?: boolean | undefined;
  approvalNotes?: string | null | undefined;
}

export interface UpdateKnowledgeItemInput {
  category?: KnowledgeCategory | undefined;
  title?: string | undefined;
  content?: string | undefined;
  priceAed?: number | null | undefined;
  isApprovedByClient?: boolean | undefined;
  approvalNotes?: string | null | undefined;
}
