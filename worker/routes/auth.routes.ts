import { Hono } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import { constantTimeEqual, generateSecureToken } from '../lib/crypto';
import type { WorkerEnv } from '../env';

export const authRoutes = new Hono<{ Bindings: WorkerEnv }>();

/**
 * Validates password rules:
 * - At least 8 characters
 * - At least one uppercase letter [A-Z]
 * - At least one lowercase letter [a-z]
 */
export function validatePasswordComplexity(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must include at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must include at least one lowercase letter.' };
  }
  return { valid: true };
}

/**
 * Ultra-fast native Web Crypto password hasher (< 0.2ms CPU).
 * Uses SHA-256 with 16-byte random salt stored as "salt$hash".
 */
export async function hashPasswordFast(password: string): Promise<string> {
  const salt = generateSecureToken(16);
  const data = new TextEncoder().encode(salt + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${salt}$${hashHex}`;
}

/**
 * Ultra-fast constant-time password verification (< 0.2ms CPU).
 */
export async function verifyPasswordFast(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 2) return false;
  const [salt, expectedHash] = parts;
  if (!salt || !expectedHash) return false;

  const data = new TextEncoder().encode(salt + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const actualHash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return constantTimeEqual(actualHash, expectedHash);
}

/**
 * POST /api/auth/login
 * Ultra-low CPU email & password authentication (< 2ms total execution).
 */
authRoutes.post('/login', async (c) => {
  let body: any = null;
  try {
    const raw = await c.req.raw.text();
    if (raw) {
      body = JSON.parse(raw);
    }
  } catch {
    body = await c.req.json().catch(() => null);
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !password) {
    return jsonError(c, 'INVALID_INPUT', 'Email and password are required', 400);
  }

  // Look up user
  const user = await c.env.DB
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.password_hash, u.status, m.tenant_id, m.role
       FROM users u
       LEFT JOIN memberships m ON m.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`
    )
    .bind(email)
    .first<{
      id: string;
      email: string;
      display_name: string;
      password_hash: string | null;
      status: string;
      tenant_id: string | null;
      role: string | null;
    }>();

  if (!user || user.status !== 'active') {
    return jsonError(c, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // If user has no password yet (e.g. freshly seeded user), validate requirements and set it on first login
  if (!user.password_hash) {
    const check = validatePasswordComplexity(password);
    if (!check.valid) {
      return jsonError(c, 'PASSWORD_REQUIREMENTS_NOT_MET', check.reason || 'Password requirements not met', 400);
    }

    const newHash = await hashPasswordFast(password);
    await c.env.DB
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(newHash, Date.now(), user.id)
      .run();
  } else {
    // Verify password in < 0.2ms CPU
    const isValid = await verifyPasswordFast(password, user.password_hash);
    if (!isValid) {
      return jsonError(c, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }
  }

  const tenantId = user.tenant_id || 'tenant_visa_horizon_default';
  const sessionId = generateSecureToken(32);
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

  // Insert session
  await c.env.DB
    .prepare(
      `INSERT INTO sessions (id, user_id, tenant_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(sessionId, user.id, tenantId, expiresAt, now)
    .run();

  // Set Secure HttpOnly session cookie
  const isSecure = c.req.url.startsWith('https://');
  const cookieHeader = `nexo_session=${sessionId}; Path=/; Max-Age=604800; SameSite=Lax${isSecure ? '; Secure' : ''}; HttpOnly`;
  c.header('Set-Cookie', cookieHeader);

  return jsonOk(c, {
    token: sessionId,
    user: {
      id: user.id,
      email: user.email,
      name: user.display_name,
      role: user.role || 'owner',
      tenantId,
    },
  });
});

/**
 * GET /api/auth/me
 * Checks session validity and returns authenticated user info.
 */
authRoutes.get('/me', async (c) => {
  const cookie = c.req.header('Cookie') || '';
  const match = cookie.match(/nexo_session=([a-f0-9]+)/);
  const authHeader = c.req.header('Authorization');
  const token = match?.[1] || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

  if (!token) {
    return jsonError(c, 'UNAUTHORIZED', 'Not authenticated', 401);
  }

  const now = Date.now();
  const session = await c.env.DB
    .prepare(
      `SELECT s.id, s.user_id, s.tenant_id, u.email, u.display_name, m.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN memberships m ON m.user_id = u.id AND m.tenant_id = s.tenant_id
       WHERE s.id = ? AND s.expires_at > ?
       LIMIT 1`
    )
    .bind(token, now)
    .first<{
      id: string;
      user_id: string;
      tenant_id: string;
      email: string;
      display_name: string;
      role: string | null;
    }>();

  if (!session) {
    return jsonError(c, 'UNAUTHORIZED', 'Session expired or invalid', 401);
  }

  return jsonOk(c, {
    user: {
      id: session.user_id,
      email: session.email,
      name: session.display_name,
      role: session.role || 'owner',
      tenantId: session.tenant_id,
    },
  });
});

/**
 * POST /api/auth/logout
 * Deletes current session.
 */
authRoutes.post('/logout', async (c) => {
  const cookie = c.req.header('Cookie') || '';
  const match = cookie.match(/nexo_session=([a-f0-9]+)/);
  const authHeader = c.req.header('Authorization');
  const token = match?.[1] || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run();
  }

  const isSecure = c.req.url.startsWith('https://');
  c.header('Set-Cookie', `nexo_session=; Path=/; Max-Age=0; SameSite=Lax${isSecure ? '; Secure' : ''}; HttpOnly`);
  return jsonOk(c, { success: true });
});
