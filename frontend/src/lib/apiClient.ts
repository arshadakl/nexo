export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.success) {
    const error = json?.error;
    throw new ApiError(
      error?.message || `HTTP ${response.status} Request Failed`,
      error?.code || 'UNKNOWN_ERROR',
      response.status,
      error?.details
    );
  }

  return json.data as T;
}
