// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraftReview } from '../src/components/inbox/DraftReview';
import type { MessageDraft } from '@shared/types/draft.types';

afterEach(cleanup);

const base: MessageDraft = {
  id: 'd1',
  tenantId: 't',
  conversationId: 'c',
  suggestedText: 'The team will confirm the cost for your free zone.',
  status: 'pending_review',
  createdAt: Date.now() - 60_000,
  reviewKind: 'business_confirmation',
  reviewReason: 'Confirmed cost for a freelance permit',
  customerQuestion: 'How much is it?',
};

function renderDraft(draft: MessageDraft) {
  const handlers = { onEdit: vi.fn(), onApprove: vi.fn(), onReject: vi.fn(), onRetry: vi.fn() };
  render(<DraftReview draft={draft} isEditing={false} isBusy={false} {...handlers} />);
  return handlers;
}

describe('DraftReview', () => {
  it('shows what the reviewer must confirm and the customer question', () => {
    renderDraft(base);
    expect(screen.getByText('Needs business confirmation')).toBeTruthy();
    expect(screen.getByText('Confirmed cost for a freelance permit')).toBeTruthy();
    expect(screen.getByText(/How much is it\?/)).toBeTruthy();
  });

  it('requires the reviewer to read newer customer messages before approving', async () => {
    const user = userEvent.setup();
    const { onApprove } = renderDraft({
      ...base,
      newInboundMessages: [{ id: 'm', messageText: 'Is Sharjah cheaper?', messageType: 'text', createdAt: Date.now() }],
    });
    const approve = screen.getByRole('button', { name: 'Approve & send' }) as HTMLButtonElement;
    expect(screen.getByText(/Is Sharjah cheaper\?/)).toBeTruthy();
    expect(approve.disabled).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: /still fits/ }));
    await user.click(approve);
    expect(onApprove).toHaveBeenCalledWith(true);
  });

  it('offers retry for a failed send and never shows it as sent', async () => {
    const user = userEvent.setup();
    const { onRetry } = renderDraft({ ...base, status: 'send_failed', lastError: 'Instagram Send API error (500)' });
    expect(screen.getByText(/Not delivered: Instagram Send API error/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve & send' })).toBe(null);
    await user.click(screen.getByRole('button', { name: 'Retry send' }));
    expect(onRetry).toHaveBeenCalledWith(false);
  });

  it('rejects with the chosen next action', async () => {
    const user = userEvent.setup();
    const { onReject } = renderDraft(base);
    await user.selectOptions(screen.getByRole('combobox', { name: 'After rejecting' }), 'resume_ai');
    await user.click(screen.getByRole('button', { name: 'Reject', exact: true }));
    expect(onReject).toHaveBeenCalledWith('resume_ai');
  });
});
