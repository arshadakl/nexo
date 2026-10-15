export type UserRole = 'owner' | 'supervisor' | 'agent';

export interface User {
  id: string;
  email: string;
  displayName: string;
  status: 'active' | 'invited' | 'deactivated';
  createdAt: number;
  updatedAt: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'deactivated';
  timezone: string;
  locale: string;
  retentionDays: number;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  userId: string;
  tenantId: string;
  expiresAt: number;
  createdAt: number;
}

export interface AuthenticatedUser {
  user: User;
  tenant: Tenant;
  role: UserRole;
}
