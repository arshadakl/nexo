export const screenPaths = {
  inbox: '/inbox',
  leads: '/leads',
  overview: '/overview',
  'ai-automation': '/ai',
  integrations: '/channels',
  settings: '/settings',
} as const;

export type NavItemKey = keyof typeof screenPaths;
export type InboxChannel = 'all' | 'instagram' | 'whatsapp';
export interface WorkspaceRoute {
  screen: NavItemKey;
  conversationId: string | null;
  channel: InboxChannel;
  search: string;
  humanOnly: boolean;
  leadId: string | null;
  leadStatus: string | null;
  partnerSector?: string | null;
}

export function parseRoute(location: string): WorkspaceRoute {
  const url = new URL(location, 'http://workspace.local');
  const pathname = url.pathname === '/partners' ? '/leads' : url.pathname;
  const screen =
    (Object.keys(screenPaths) as NavItemKey[]).find((key) => screenPaths[key] === pathname) ??
    'inbox';
  const channel = url.searchParams.get('channel');
  return {
    screen,
    conversationId: screen === 'inbox' ? url.searchParams.get('conversation') || null : null,
    channel: channel === 'instagram' || channel === 'whatsapp' ? channel : 'all',
    search: url.searchParams.get('search') ?? '',
    humanOnly: url.searchParams.get('view') === 'human',
    leadId: url.searchParams.get('lead') || null,
    leadStatus: url.searchParams.get('status') || null,
  };
}

export function inboxHref(
  route: Pick<WorkspaceRoute, 'conversationId' | 'channel' | 'search' | 'humanOnly'>,
): string {
  const params = new URLSearchParams();
  if (route.conversationId) params.set('conversation', route.conversationId);
  if (route.channel !== 'all') params.set('channel', route.channel);
  if (route.search) params.set('search', route.search);
  if (route.humanOnly) params.set('view', 'human');
  return `/inbox${params.size ? `?${params}` : ''}`;
}

export function leadsHref(
  route: { leadId?: string | null; status?: string | null; search?: string },
): string {
  const params = new URLSearchParams();
  if (route.leadId) params.set('lead', route.leadId);
  if (route.status && route.status !== 'all') params.set('status', route.status);
  if (route.search) params.set('search', route.search);
  return `/leads${params.size ? `?${params}` : ''}`;
}

export function partnersHref(
  _route?: { sector?: string | null; search?: string },
): string {
  return '/leads';
}

export function navigate(href: string, replace = false) {
  if (`${window.location.pathname}${window.location.search}` === href) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', href);
  window.dispatchEvent(new Event('workspace:navigate'));
}
