// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { focusManager } from '@tanstack/react-query';
import { App } from '../src/App';
import { queryClient } from '../src/queries/queryClient';
import { queryKeys } from '../src/queries/queryKeys';
import { createWorkspaceFixture } from './fixtures.mjs';

let fixture: ReturnType<typeof createWorkspaceFixture>;
beforeEach(() => {
  queryClient.clear();
  queryClient.setDefaultOptions({
    queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    mutations: { retry: false },
  });
  window.history.replaceState(null, '', '/inbox?conversation=a');
  fixture = createWorkspaceFixture();
  vi.stubGlobal('fetch', vi.fn(fixture.fetcher));
  // Browser focus/inert behavior is checked in Chrome, not simulated here.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function openApp() {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('textbox', { name: 'Reply to Amina Rahman' });
  return user;
}
const input = () =>
  screen.getByRole('textbox', { name: /Reply to|Edit AI draft/ }) as HTMLTextAreaElement;
const postRequests = () =>
  fixture.requests.filter(
    (request) => request.method === 'POST' && request.path.includes('/messages'),
  );

describe('Inbox working journeys', () => {
  it('preserves independent customer text across selection and screen navigation', async () => {
    const user = await openApp();
    await user.type(input(), 'Amina only');
    await user.click(screen.getByRole('link', { name: /Omar Hassan/ }));
    await screen.findByRole('textbox', { name: 'Reply to Omar Hassan' });
    expect(input().value).toBe('');
    await user.type(input(), 'Omar only');
    await user.click(screen.getByRole('link', { name: /Amina Rahman/ }));
    await screen.findByRole('textbox', { name: 'Reply to Amina Rahman' });
    expect(input().value).toBe('Amina only');
    await user.click(screen.getByRole('link', { name: 'Leads', exact: true }));
    await screen.findByRole('searchbox', { name: 'Search leads' });
    await user.click(screen.getByRole('link', { name: 'Inbox', exact: true }));
    await user.click(await screen.findByRole('link', { name: /Amina Rahman/ }));
    await screen.findByRole('textbox', { name: 'Reply to Amina Rahman' });
    expect(input().value).toBe('Amina only');
  });

  it('keeps an edited AI draft attached to its original customer and restores the ordinary reply', async () => {
    const user = await openApp();
    await user.type(input(), 'Original manual reply');
    await user.click(await screen.findByRole('button', { name: 'Edit', exact: true }));
    await user.clear(input());
    await user.type(input(), 'Edited draft for Amina');
    await user.click(screen.getByRole('link', { name: /Omar Hassan/ }));
    await screen.findByRole('textbox', { name: 'Reply to Omar Hassan' });
    expect(input().value).toBe('');
    expect(screen.queryByRole('button', { name: 'Save & send' })).toBe(null);
    await user.click(screen.getByRole('link', { name: /Amina Rahman/ }));
    await screen.findByRole('textbox', { name: 'Edit AI draft' });
    expect(input().value).toBe('Edited draft for Amina');
    await user.click(screen.getByRole('button', { name: 'Cancel edit' }));
    expect(input().value).toBe('Original manual reply');
    expect(postRequests()).toHaveLength(0);
  });

  it('retains composer text when dispatch fails despite an HTTP-success response', async () => {
    fixture = createWorkspaceFixture();
    fixture.state.sendStatus = 'failed';
    vi.stubGlobal('fetch', vi.fn(fixture.fetcher));
    const user = await openApp();
    await user.type(input(), 'Keep this failed reply');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await screen.findByText('Not sent: Channel connection unavailable.');
    expect(input().value).toBe('Keep this failed reply');
    expect(screen.getByText('Failed to send')).toBeTruthy();
    expect(postRequests()).toHaveLength(1);
  });

  it('retains composer text and removes the optimistic row after a request failure', async () => {
    fixture = createWorkspaceFixture();
    fixture.state.failSend = true;
    vi.stubGlobal('fetch', vi.fn(fixture.fetcher));
    const user = await openApp();
    await user.type(input(), 'Network failure text');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await screen.findByText(/Could not confirm sending/);
    expect(input().value).toBe('Network failure text');
    const cached =
      queryClient.getQueryData<Array<{ id: string }>>(queryKeys.conversations.messages('a')) ?? [];
    expect(cached.some((message) => message.id.startsWith('optimistic_'))).toBe(false);
  });

  it('reconciles successful sends to one server message and clears only the sending customer', async () => {
    const user = await openApp();
    await user.type(input(), 'A successful reply');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await screen.findByText('Reply submitted. Delivery status is shown above.');
    expect(input().value).toBe('');
    expect(screen.getAllByText('A successful reply')).toHaveLength(1);
    const cached =
      queryClient.getQueryData<Array<{ id: string }>>(queryKeys.conversations.messages('a')) ?? [];
    expect(cached.some((message) => message.id.startsWith('optimistic_'))).toBe(false);
  });

  it('keeps an in-flight send locked after switching away and back', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    fixture = createWorkspaceFixture();
    fixture.state.beforeSend = () => pending;
    vi.stubGlobal('fetch', vi.fn(fixture.fetcher));
    const user = await openApp();
    await user.type(input(), 'Pending for Amina');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() => expect(postRequests()).toHaveLength(1));
    await user.click(screen.getByRole('link', { name: /Omar Hassan/ }));
    await screen.findByRole('textbox', { name: 'Reply to Omar Hassan' });
    await user.type(input(), 'Omar unsent');
    await user.click(screen.getByRole('link', { name: /Amina Rahman/ }));
    await screen.findByRole('textbox', { name: 'Reply to Amina Rahman' });
    expect((screen.getByRole('button', { name: 'Sending…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await act(async () => {
      release();
    });
    await screen.findByText('Reply submitted. Delivery status is shown above.');
    await user.click(screen.getByRole('link', { name: /Omar Hassan/ }));
    await screen.findByRole('textbox', { name: 'Reply to Omar Hassan' });
    expect(input().value).toBe('Omar unsent');
    expect(postRequests()).toHaveLength(1);
  });

  it('approves a draft once, then reconciles it into the thread', async () => {
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: 'Approve & send' }));
    await screen.findByText('Draft approved. Check delivery status in the thread.');
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'AI draft review' })).toBe(null),
    );
    expect(
      fixture.requests.filter((request) => request.path === '/api/drafts/draft-a/approve'),
    ).toHaveLength(1);
    expect(screen.getByText('Resider AI')).toBeTruthy();
  });

  it('blocks sending an edit of a draft resolved elsewhere without losing the edited text', async () => {
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: 'Edit', exact: true }));
    await user.clear(input());
    await user.type(input(), 'Retain this edit');
    await act(async () => {
      queryClient.setQueryData(queryKeys.drafts.conversation('a'), null);
    });
    expect(input().value).toBe('Retain this edit');
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Save & send' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    expect(screen.getByText(/This draft is no longer pending/)).toBeTruthy();
  });

  it('restores the selected conversation via browser history and stops observing Inbox after navigation', async () => {
    const user = await openApp();
    await user.click(screen.getByRole('link', { name: /Omar Hassan/ }));
    await screen.findByRole('textbox', { name: 'Reply to Omar Hassan' });
    await act(async () => {
      window.history.back();
    });
    await screen.findByRole('textbox', { name: 'Reply to Amina Rahman' });
    await user.click(screen.getByRole('link', { name: 'Settings', exact: true }));
    await screen.findByText('Tenant Data Retention Policy');
    expect(
      queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.conversations.all })
        .every((query) => query.getObserversCount() === 0),
    ).toBe(true);
  });

  it('shows a query error separately from an empty Inbox', async () => {
    fixture = createWorkspaceFixture();
    fixture.state.failList = true;
    vi.stubGlobal('fetch', vi.fn(fixture.fetcher));
    await openApp();
    expect(await screen.findByText('Could not load conversations.')).toBeTruthy();
    expect(screen.queryByText('Your inbox is clear')).toBe(null);
  });

  it('requires an explicit confirmation before clearing history', async () => {
    const user = await openApp();
    await user.click(screen.getByRole('button', { name: 'Clear conversation history' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/cannot be undone/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(fixture.requests.some((request) => request.method === 'DELETE')).toBe(false);
  });

  it('does not send during IME composition or on ordinary Enter', async () => {
    const user = await openApp();
    await user.type(input(), 'മലയാളം');
    fireEvent.compositionStart(input());
    fireEvent.keyDown(input(), { key: 'Enter', ctrlKey: true, isComposing: true });
    fireEvent.compositionEnd(input());
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(postRequests()).toHaveLength(0);
  });

  it('sends an edited draft through its own endpoint without consuming the manual reply', async () => {
    const user = await openApp();
    await user.type(input(), 'Manual reply stays here');
    await user.click(await screen.findByRole('button', { name: 'Edit', exact: true }));
    await user.clear(input());
    await user.type(input(), 'Reviewed wording');
    await user.click(screen.getByRole('button', { name: 'Save & send' }));
    await screen.findByText('Draft submitted. Check delivery status in the thread.');
    expect(input().value).toBe('Manual reply stays here');
    const request = fixture.requests.find(
      (request) => request.path === '/api/drafts/draft-a/modify',
    );
    expect(request?.body.modifiedText).toBe('Reviewed wording');
    expect(postRequests()).toHaveLength(0);
  });

  it('rejects a pending draft without dispatching a message', async () => {
    const user = await openApp();
    await user.click(await screen.findByRole('button', { name: 'Reject', exact: true }));
    await screen.findByText('Draft rejected. No reply was sent.');
    expect(fixture.messages.a).toHaveLength(1);
    expect(
      fixture.requests.filter((request) => request.path === '/api/drafts/draft-a/reject'),
    ).toHaveLength(1);
  });

  it('pauses polling when unfocused and resumes when the workspace becomes active', async () => {
    await openApp();
    await screen.findByRole('button', { name: 'Approve & send' });
    vi.useFakeTimers();
    focusManager.setFocused(false);
    const previousRequests = fixture.requests.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31000);
    });
    expect(fixture.requests).toHaveLength(previousRequests);
    await act(async () => {
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(16000);
    });
    expect(fixture.requests.length).toBeGreaterThan(previousRequests);
  });

  it('does not repopulate a cleared session cache when an old send finishes', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    fixture = createWorkspaceFixture();
    fixture.state.beforeSend = () => pending;
    vi.stubGlobal('fetch', vi.fn(fixture.fetcher));
    const user = await openApp();
    await user.type(input(), 'Old session reply');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() => expect(postRequests()).toHaveLength(1));
    await act(async () => {
      cleanup();
      await queryClient.cancelQueries();
      queryClient.clear();
      release();
    });
    expect(queryClient.getQueryData(queryKeys.conversations.messages('a'))).toBeUndefined();
  });
});
