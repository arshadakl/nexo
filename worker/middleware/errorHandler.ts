import type { ErrorHandler } from 'hono';
import { jsonError } from '../lib/response';
import { logger } from '../lib/logger';
import { ZodError } from 'zod';

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') || 'unknown';

  // Handle validation errors from Zod
  if (err instanceof ZodError) {
    return jsonError(
      c,
      'VALIDATION_ERROR',
      'Request input validation failed',
      400,
      err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }))
    );
  }

  // Sanitized logging: never expose stack traces or DB errors to client
  logger.error('Unhandled request exception', err, {
    requestId,
    path: c.req.path,
    method: c.req.method,
  });

  return jsonError(
    c,
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred. Please try again.',
    500
  );
};
