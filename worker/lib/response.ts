import type { Context } from 'hono';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export function jsonOk<T>(c: Context, data: T, status = 200): Response {
  c.header('Cache-Control', 'no-store');
  return c.json<ApiResponse<T>>({ success: true, data }, status as any);
}

export function jsonPaginated<T>(
  c: Context,
  data: T[],
  nextCursor: string | null,
  hasMore: boolean
): Response {
  c.header('Cache-Control', 'no-store');
  return c.json<ApiResponse<T[]>>({
    success: true,
    data,
    pagination: {
      nextCursor,
      hasMore,
    },
  });
}

export function jsonError(
  c: Context,
  code: string,
  message: string,
  status = 400,
  details?: unknown
): Response {
  c.header('Cache-Control', 'no-store');
  return c.json<ApiResponse<never>>({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  }, status as any);
}
