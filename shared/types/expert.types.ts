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
  contactPhone?: string | null;
  contactEmail?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateExpertInput {
  fullName: string;
  organizationName: string;
  sectors: string[];
  languages: string[];
  emirates?: string[];
  servicesOffered?: string[];
  isVerified?: boolean;
  isAvailable?: boolean;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface UpdateExpertInput {
  fullName?: string;
  organizationName?: string;
  sectors?: string[];
  languages?: string[];
  emirates?: string[];
  servicesOffered?: string[];
  isVerified?: boolean;
  isAvailable?: boolean;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface ExpertMatchCriteria {
  sector?: string | null;
  language?: string | null;
  emirate?: string | null;
  serviceNeeded?: string | null;
}
