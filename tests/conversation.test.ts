import { describe, it, expect, vi } from 'vitest';
import { conversationRepository } from '../worker/repositories/conversationRepository';
import {
  SendMessageSchema,
  TakeoverSchema,
  SetAIModeSchema,
} from '../shared/schemas/conversation.schema';

describe('Conversation Repository & Schemas', () => {
  it('removes pending AI drafts and messages and resets ai_mode to ON when clear is invoked without deleting leads', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const prepare = vi.fn((sql: string) => ({ bind: (...params: unknown[]) => {
      calls.push({ sql, params });
      return { all: async () => ({ results: [] }), run: async () => ({ success: true }) };
    } }));
    await conversationRepository.clearConversationHistory({ prepare } as any, 'tenant_1', 'convo_1', false);
    expect(calls.find((call) => call.sql.includes('DELETE FROM message_drafts'))?.params).toEqual(['tenant_1', 'convo_1']);
    expect(calls.find((call) => call.sql.includes('DELETE FROM messages'))?.params).toEqual(['tenant_1', 'convo_1']);
    expect(calls.find((call) => call.sql.includes('DELETE FROM leads'))).toBeUndefined();
    expect(calls.find((call) => call.sql.includes('UPDATE conversations SET') && call.sql.includes("ai_mode = 'ON'"))).toBeDefined();
  });

  it('deletes leads and conversation links when deleteLead is true', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const prepare = vi.fn((sql: string) => ({ bind: (...params: unknown[]) => {
      calls.push({ sql, params });
      return {
        all: async () => ({ results: [{ lead_id: 'lead_123' }] }),
        run: async () => ({ success: true }),
      };
    } }));
    await conversationRepository.clearConversationHistory({ prepare } as any, 'tenant_1', 'convo_1', true);
    expect(calls.find((call) => call.sql.includes('DELETE FROM lead_conversation_links'))?.params).toEqual(['tenant_1', 'convo_1']);
    expect(calls.find((call) => call.sql.includes('DELETE FROM leads'))?.params).toEqual(['tenant_1', 'lead_123']);
  });
  it('returns the newest bounded message window in chronological order', async () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({
      id: `message-${51 - index}`, tenant_id: 'tenant_1', conversation_id: 'convo_1',
      direction: 'inbound', sender_type: 'applicant', message_text: `Message ${51 - index}`,
      message_type: 'text', delivery_status: 'delivered', created_at: 51 - index,
    }));
    const bind = vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: rows }) });
    const prepare = vi.fn().mockReturnValue({ bind });
    const messages = await conversationRepository.listMessages({ prepare } as any, 'tenant_1', 'convo_1', 50);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC, id DESC'));
    expect(bind).toHaveBeenCalledWith('tenant_1', 'convo_1', 50);
    expect(messages).toHaveLength(50);
    expect(messages[0]?.messageText).toBe('Message 2');
    expect(messages.at(-1)?.messageText).toBe('Message 51');
  });
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
