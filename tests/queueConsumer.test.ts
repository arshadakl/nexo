import { describe, it, expect, vi } from 'vitest';
import { processQueueBatch } from '../worker/queue/consumer';
import type { WorkerEnv } from '../worker/env';

describe('Queue Consumer Unit Tests', () => {
  it('acks immediately if message has no eventId', async () => {
    let ackCalled = false;
    const fakeMessage = {
      id: 'msg_1',
      body: {},
      ack: () => {
        ackCalled = true;
      },
      retry: vi.fn(),
    };

    const fakeBatch = {
      queue: 'messaging-queue',
      messages: [fakeMessage],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    const mockEnv = {
      DB: {} as any,
    } as WorkerEnv;

    await processQueueBatch(fakeBatch as any, mockEnv);
    expect(ackCalled).toBe(true);
  });

  it('skips and acks if eventRecord is not found in D1', async () => {
    let ackCalled = false;
    const fakeMessage = {
      id: 'msg_2',
      body: { eventId: 'non_existent_event' },
      ack: () => {
        ackCalled = true;
      },
      retry: vi.fn(),
    };

    const fakeBatch = {
      queue: 'messaging-queue',
      messages: [fakeMessage],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      }),
    };

    const mockEnv = {
      DB: mockDb as any,
    } as WorkerEnv;

    await processQueueBatch(fakeBatch as any, mockEnv);
    expect(ackCalled).toBe(true);
  });
});
