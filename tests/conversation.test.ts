import { describe, it, expect, vi } from 'vitest';
import { conversationRepository } from '../worker/repositories/conversationRepository';
import {
  SendMessageSchema,
  TakeoverSchema,
  SetAIModeSchema,
} from '../shared/schemas/conversation.schema';

describe('Conversation Repository & Schemas', () => {
  it('validates SendMessageSchema correctly', () => {
    expect(SendMessageSchema.safeParse({ messageText: 'Hello applicant' }).success).toBe(true);
    expect(SendMessageSchema.safeParse({ messageText: '' }).success).toBe(false);
    expect(SendMessageSchema.safeParse({}).success).toBe(false);
  });

  it('validates TakeoverSchema correctly', () => {
    expect(TakeoverSchema.safeParse({ takeover: true }).success).toBe(true);
    expect(TakeoverSchema.safeParse({ takeover: false }).success).toBe(true);
    expect(TakeoverSchema.safeParse({ takeover: 'yes' }).success).toBe(false);
  });

  it('validates SetAIModeSchema correctly', () => {
    expect(SetAIModeSchema.safeParse({ aiMode: 'ON' }).success).toBe(true);
    expect(SetAIModeSchema.safeParse({ aiMode: 'OFF' }).success).toBe(true);
    expect(SetAIModeSchema.safeParse({ aiMode: 'INHERIT' }).success).toBe(true);
    expect(SetAIModeSchema.safeParse({ aiMode: 'INVALID' }).success).toBe(false);
  });

  it('setHumanTakeover binds correct parameters to D1 statement', async () => {
    const bindMock = vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({ success: true }) });
    const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
    const mockDb = { prepare: prepareMock } as any;

    await conversationRepository.setHumanTakeover(
      mockDb,
      'tenant_1',
      'convo_123',
      true,
      'staff_user_1'
    );

    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('UPDATE conversations'));
    expect(bindMock).toHaveBeenCalledWith(
      1, // takeover = 1
      'staff_user_1',
      expect.any(Number),
      expect.any(Number),
      'tenant_1',
      'convo_123'
    );
  });
});
