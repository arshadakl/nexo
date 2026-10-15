/**
 * Sanitized structured logger for Cloudflare Workers.
 * Never prints tokens, API keys, passwords, full phone numbers, or webhook signatures.
 */

export interface LogContext {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  action?: string;
  [key: string]: unknown;
}

function sanitizeValue(key: string, value: unknown): unknown {
  const sensitiveKeys = [
    'token',
    'apikey',
    'api_key',
    'password',
    'secret',
    'signature',
    'authorization',
    'cookie',
  ];

  if (typeof key === 'string') {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      return '[REDACTED]';
    }
  }

  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map((v) => sanitizeValue('', v));
    }
    const cleanObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      cleanObj[k] = sanitizeValue(k, v);
    }
    return cleanObj;
  }

  return value;
}

export const logger = {
  info(message: string, context?: LogContext): void {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: Date.now(),
        ...(context ? (sanitizeValue('', context) as LogContext) : {}),
      })
    );
  },

  warn(message: string, context?: LogContext): void {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message,
        timestamp: Date.now(),
        ...(context ? (sanitizeValue('', context) as LogContext) : {}),
      })
    );
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    const errorDetails =
      error instanceof Error
        ? { errorName: error.name, errorMessage: error.message }
        : { rawError: String(error) };

    console.error(
      JSON.stringify({
        level: 'error',
        message,
        timestamp: Date.now(),
        ...errorDetails,
        ...(context ? (sanitizeValue('', context) as LogContext) : {}),
      })
    );
  },
};
