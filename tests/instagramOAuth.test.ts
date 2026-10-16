import { describe, it, expect } from 'vitest';
import { InstagramOAuthAdapter } from '../worker/adapters/meta/instagramOAuth';

describe('InstagramOAuthAdapter', () => {
  const adapter = new InstagramOAuthAdapter('v21.0');

  it('buildAuthorizationUrl creates correct Meta authorization URL', () => {
    const urlString = adapter.buildAuthorizationUrl({
      appId: '1234567890',
      redirectUri: 'https://nexo.test/api/integrations/instagram/callback',
      state: 'secure_random_state_token',
    });

    const parsed = new URL(urlString);
    expect(parsed.origin).toBe('https://www.instagram.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('1234567890');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://nexo.test/api/integrations/instagram/callback');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('state')).toBe('secure_random_state_token');
    expect(parsed.searchParams.get('enable_fb_login')).toBe('0');
    expect(parsed.searchParams.get('force_authentication')).toBe('1');
    expect(parsed.searchParams.get('scope')).toContain('instagram_business_basic');
    expect(parsed.searchParams.get('scope')).toContain('instagram_business_manage_messages');
  });
});
