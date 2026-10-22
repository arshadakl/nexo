import { describe, it, expect, vi } from 'vitest';
import { draftRepository } from '../worker/repositories/draftRepository';
import { CreateDraftSchema, ResolveDraftSchema } from '../shared/schemas/draft.schema';

describe('Message Draft Repository & Schemas', () => {
  it('validates CreateDraftSchema and ResolveDraftSchema', () => {
    const validCreate = CreateDraftSchema.safeParse({
      conversationId: 'convo_123',
      leadId: 'lead_456',
      suggestedText: 'Hey 👋 Are you looking for residency only, or a permit with residency?',
      rationale: 'Clarifying permit vs residency only',
    });
    expect(validCreate.success).toBe(true);

    const validResolve = ResolveDraftSchema.safeParse({
      status: 'approved_sent',
      reviewedBy: 'user_staff_1',
    });
    expect(validResolve.success).toBe(true);

    expect(
      ResolveDraftSchema.safeParse({
        status: 'invalid_status',
      }).success
    ).toBe(false);
  });

  it('getPendingDraft returns the unresolved draft (pending, sending or failed) for a conversation', async () => {
    const firstMock = vi.fn().mockResolvedValue({
      id: 'draft_1',
      tenant_id: 'tenant_1',
      conversation_id: 'convo_1',
      lead_id: 'lead_1',
      suggested_text: 'Hey 👋 How can we help?',
      rationale: 'Greeting',
      status: 'pending_review',
      modified_text: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: 1700000000000,
    });
    const bindMock = vi.fn().mockReturnValue({ first: firstMock });
    const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
    const mockDb = { prepare: prepareMock } as any;

    const draft = await draftRepository.getPendingDraft(mockDb, 'tenant_1', 'convo_1');

    // based_on_message_at is null, so no follow-up "new messages" query is needed.
    expect(prepareMock).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('pending_review', 'sending', 'send_failed')")
    );
    expect(bindMock).toHaveBeenCalledWith('tenant_1', 'convo_1');
    expect(draft).not.toBeNull();
    expect(draft?.suggestedText).toBe('Hey 👋 How can we help?');
  });
});
