import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftRoutes } from '../worker/routes/draft.routes';
import { draftRepository } from '../worker/repositories/draftRepository';

afterEach(() => vi.restoreAllMocks());

describe('Resolved AI draft protection', () => {
  it.each(['approve', 'modify', 'reject'])(
    'rejects a repeated %s before writing or dispatching',
    async (action) => {
      vi.spyOn(draftRepository, 'getDraftById').mockResolvedValue({
        id: 'draft-a',
        tenantId: 'tenant-test',
        conversationId: 'conversation-a',
        suggestedText: 'Already reviewed',
        status: 'approved_sent',
        createdAt: Date.now(),
      });
      const prepare = vi.fn();
      const resolve = vi.spyOn(draftRepository, 'resolveDraft');
      const response = await draftRoutes.fetch(
        new Request(`http://fixture/draft-a/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-test' },
          body: JSON.stringify({ modifiedText: 'Do not send this twice' }),
        }),
        { DB: { prepare } } as any,
      );
      expect(response.status).toBe(409);
      expect(prepare).not.toHaveBeenCalled();
      expect(resolve).not.toHaveBeenCalled();
    },
  );
});
