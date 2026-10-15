export interface WorkerEnv {
  // Bindings
  DB: D1Database;
  MESSAGING_QUEUE: Queue;
  ASSETS?: Fetcher;

  // Non-secret vars
  ENVIRONMENT: 'development' | 'staging' | 'production';
  META_GRAPH_API_VERSION: string;

  // Secrets
  SESSION_SECRET?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_TOKEN_ENCRYPTION_KEY?: string; // 32-byte Base64 key for AES-256-GCM
  WEBHOOK_VERIFY_TOKEN?: string;
}

declare global {
  namespace Hono {
    interface Env {
      Bindings: WorkerEnv;
      Variables: {
        requestId: string;
        tenantId?: string;
        userId?: string;
        userRole?: 'owner' | 'supervisor' | 'agent';
      };
    }
  }
}
