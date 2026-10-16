import type { InstagramAccountProfile } from '@shared/types/meta.types';
import { logger } from '../../lib/logger';

export interface InstagramTokenExchangeResult {
  accessToken: string;
  userId: string;
  expiresInSeconds: number;
}

export class InstagramOAuthAdapter {
  private readonly graphApiVersion: string;

  constructor(graphApiVersion = 'v21.0') {
    this.graphApiVersion = graphApiVersion;
  }

  /**
   * Builds the official Meta Instagram authorization URL.
   */
  buildAuthorizationUrl(params: {
    appId: string;
    redirectUri: string;
    state: string;
  }): string {
    const scopes = ['instagram_business_basic', 'instagram_business_manage_messages'].join(',');
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.searchParams.set('enable_fb_login', '0');
    url.searchParams.set('force_authentication', '1');
    url.searchParams.set('client_id', params.appId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes);
    url.searchParams.set('state', params.state);

    return url.toString();
  }

  /**
   * Exchanges authorization code for a short-lived token via Meta Instagram API.
   */
  async exchangeCodeForToken(params: {
    appId: string;
    appSecret: string;
    redirectUri: string;
    code: string;
  }): Promise<{ shortLivedToken: string; userId: string }> {
    const body = new URLSearchParams();
    body.set('client_id', params.appId);
    body.set('client_secret', params.appSecret);
    body.set('grant_type', 'authorization_code');
    body.set('redirect_uri', params.redirectUri);
    body.set('code', params.code);

    const res = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.error('Failed to exchange Instagram code for token', null, {
        status: res.status,
      });
      throw new Error(`Meta Instagram code exchange failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    if (!data.access_token || !data.user_id) {
      throw new Error('Meta Instagram returned an invalid token response payload');
    }

    return {
      shortLivedToken: data.access_token,
      userId: String(data.user_id),
    };
  }

  /**
   * Exchanges short-lived token for an official 60-day long-lived access token.
   */
  async exchangeForLongLivedToken(params: {
    appSecret: string;
    shortLivedToken: string;
  }): Promise<InstagramTokenExchangeResult> {
    const url = new URL('https://graph.instagram.com/access_token');
    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', params.appSecret);
    url.searchParams.set('access_token', params.shortLivedToken);

    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Meta long-lived token exchange failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    if (!data.access_token) {
      throw new Error('Meta returned no long-lived access token');
    }

    return {
      accessToken: data.access_token,
      userId: '', // populated from profile check
      expiresInSeconds: data.expires_in || 5184000, // 60 days default
    };
  }

  /**
   * Fetches Instagram Professional profile metadata (ID, username, profile picture).
   */
  async fetchAccountProfile(accessToken: string): Promise<InstagramAccountProfile> {
    const url = new URL(`https://graph.instagram.com/${this.graphApiVersion}/me`);
    url.searchParams.set('fields', 'id,username,account_type,profile_picture_url');
    url.searchParams.set('access_token', accessToken);

    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to fetch Instagram account metadata (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    return {
      id: String(data.id),
      username: String(data.username || 'instagram_user'),
      accountType: data.account_type,
      profilePictureUrl: data.profile_picture_url,
    };
  }

  /**
   * Subscribes the app to the Instagram account's DM webhooks.
   */
  async subscribeWebhooks(accessToken: string): Promise<boolean> {
    const url = new URL(`https://graph.instagram.com/${this.graphApiVersion}/me/subscribed_apps`);
    url.searchParams.set('subscribed_fields', 'messages,messaging_postbacks');
    url.searchParams.set('access_token', accessToken);

    const res = await fetch(url.toString(), {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      logger.warn('Failed to subscribe Instagram app webhooks automatically', {
        status: res.status,
      });
      return false;
    }

    const data = (await res.json()) as any;
    return Boolean(data.success);
  }
}

export const instagramOAuthAdapter = new InstagramOAuthAdapter();
