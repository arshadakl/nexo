import { describe, it, expect, vi } from 'vitest';
import { tokenRefreshService } from '../worker/services/tokenRefreshService';

describe('TokenRefreshService Unit Tests', () => {
  it('identifies and queries tokens expiring within 14 days', async () => {
    const allMock = vi.fn().mockResolvedValue({ results: [] });
    const bindMock = vi.fn().mockReturnValue({ all: allMock });
    const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
    const mockDb = { prepare: prepareMock } as any;

    const result = await tokenRefreshService.refreshExpiringTokens(
      mockDb,
      'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='
    );

    expect(prepareMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE provider = 'instagram'")
    );
    expect(prepareMock).toHaveBeenCalledWith(
      expect.stringContaining('AND token_expires_at <= ?')
    );
    expect(result.refreshedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('sweeps and retries stuck webhook events', async () => {
    const allMock = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'event_stuck_1',
          provider: 'instagram',
          received_at: Date.now() - 600000,
          attempts: 1,
        },
      ],
    });
    const runMock = vi.fn().mockResolvedValue({ success: true });
    const bindMock = vi.fn().mockImplementation((val) => {
      if (typeof val === 'number') {
        return { all: allMock };
      }
      return { run: runMock };
    });
    const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
    const mockDb = { prepare: prepareMock } as any;

    const sendMock = vi.fn().mockResolvedValue(undefined);
    const mockQueue = { send: sendMock } as any;

    const recovered = await tokenRefreshService.sweepStuckWebhooks(mockDb, mockQueue);

    expect(recovered).toBe(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event_stuck_1' })
    );
  });
});
