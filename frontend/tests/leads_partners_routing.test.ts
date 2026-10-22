import { describe, expect, it } from 'vitest';
import { leadsHref, partnersHref, parseRoute } from '../src/lib/navigation';

describe('Leads and Partners URL routing', () => {
  it('encodes and parses lead ID and status filters', () => {
    const url = leadsHref({ leadId: 'lead_123', status: 'ready_for_team', search: 'consulting' });
    expect(url).toBe('/leads?lead=lead_123&status=ready_for_team&search=consulting');

    const parsed = parseRoute(url);
    expect(parsed.screen).toBe('leads');
    expect(parsed.leadId).toBe('lead_123');
    expect(parsed.leadStatus).toBe('ready_for_team');
    expect(parsed.search).toBe('consulting');
  });

  it('redirects /partners to leads screen', () => {
    const url = partnersHref();
    expect(url).toBe('/leads');

    const parsed = parseRoute('/partners');
    expect(parsed.screen).toBe('leads');
  });
});
