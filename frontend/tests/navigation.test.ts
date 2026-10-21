import { describe, expect, it } from 'vitest';
import { inboxHref, parseRoute } from '../src/lib/navigation';

describe('Workspace URL state', () => {
  it('defaults to Inbox and validates unknown screens and channels', () => {
    expect(parseRoute('/').screen).toBe('inbox');
    expect(parseRoute('/unknown?channel=not-a-channel').channel).toBe('all');
    expect(parseRoute('/partners').screen).toBe('experts');
    expect(parseRoute('/channels').screen).toBe('integrations');
  });
  it('round-trips customer IDs and filters without altering their values', () => {
    const route = {
      conversationId: 'customer/id?&',
      channel: 'whatsapp' as const,
      search: 'visa & إقامة',
      humanOnly: true,
    };
    expect(parseRoute(inboxHref(route))).toMatchObject({ screen: 'inbox', ...route });
  });
  it('does not treat a selected conversation as active on another screen', () => {
    expect(parseRoute('/settings?conversation=customer-a').conversationId).toBe(null);
  });
});
