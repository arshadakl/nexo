import type { Context } from 'hono';
import type { WorkerEnv } from '../env';

const DEV_FALLBACK_MASTER_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

/**
 * Resolves the active tenant ID from context, session cookie, or fallback headers.
 */
export function resolveTenantId(c: Context<{ Bindings: WorkerEnv }>): string {
  const fromVar = (c as unknown as { get: (key: string) => unknown }).get?.('tenantId');
  if (typeof fromVar === 'string' && fromVar) return fromVar;
  return c.req.header('X-Tenant-Id') || 'tenant_visa_horizon_default';
}

/**
 * Resolves the authenticated user ID from context, session cookie, or fallback headers.
 */
export function resolveUserId(c: Context<{ Bindings: WorkerEnv }>): string {
  const fromVar = (c as unknown as { get: (key: string) => unknown }).get?.('userId');
  if (typeof fromVar === 'string' && fromVar) return fromVar;
  return c.req.header('X-User-Id') || 'user_staff_counselor_1';
}

/**
 * Resolves master encryption key for AES-256-GCM.
 * FAILS CLOSED in production if META_TOKEN_ENCRYPTION_KEY is missing.
 */
export function getMasterKey(c: Context<{ Bindings: WorkerEnv }>): string {
  const secretKey = c.env.META_TOKEN_ENCRYPTION_KEY;

  if (secretKey && secretKey.trim().length > 0) {
    return secretKey.trim();
  }

  if (c.env.ENVIRONMENT === 'production') {
    throw new Error('FATAL SECURITY ERROR: META_TOKEN_ENCRYPTION_KEY secret is required in production.');
  }

  return DEV_FALLBACK_MASTER_KEY;
}
