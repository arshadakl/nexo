export interface VerifiedExpert {
  id: string;
  tenantId: string;
  fullName: string;
  organizationName: string;
  sectors: string[]; // e.g. ["tech", "e-commerce", "f&b", "trading", "consulting", "general"]
  languages: string[]; // e.g. ["en", "ml", "ar", "hi"]
  emirates: string[]; // e.g. ["dubai", "abu_dhabi", "sharjah", "all"]
  servicesOffered: string[]; // e.g. ["freezone_licence", "mainland", "corporate_tax"]
  isVerified: boolean;
  isAvailable: boolean;
  contactPhone?: string | null | undefined;
  contactEmail?: string | null | undefined;
  createdAt: number;
  updatedAt: number;
}

export interface CreateExpertInput {
  fullName: string;
  organizationName: string;
  sectors: string[];
  languages: string[];
  emirates?: string[] | undefined;
  servicesOffered?: string[] | undefined;
  isVerified?: boolean | undefined;
  isAvailable?: boolean | undefined;
  contactPhone?: string | null | undefined;
  contactEmail?: string | null | undefined;
}

export interface UpdateExpertInput {
  fullName?: string | undefined;
  organizationName?: string | undefined;
  sectors?: string[] | undefined;
  languages?: string[] | undefined;
  emirates?: string[] | undefined;
  servicesOffered?: string[] | undefined;
  isVerified?: boolean | undefined;
  isAvailable?: boolean | undefined;
  contactPhone?: string | null | undefined;
  contactEmail?: string | null | undefined;
}

export interface ExpertMatchCriteria {
  sector?: string | null | undefined;
  language?: string | null | undefined;
  emirate?: string | null | undefined;
  serviceNeeded?: string | null | undefined;
}
