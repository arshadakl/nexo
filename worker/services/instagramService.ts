import { sha256Hex, generateSecureToken } from '../lib/crypto';
import { instagramOAuthAdapter } from '../adapters/meta/instagramOAuth';
import { connectionRepository } from '../repositories/connectionRepository';
import type { OAuthConnectResponse } from '@shared/types/meta.types';
import { logger } from '../lib/logger';

export class InstagramService {
  /**
   * Initiates the 1-click popup OAuth flow by creating a secure state and authorization URL.
   */
  async initiateOAuth(
    db: D1Database,
    tenantId: string,
    userId: string,
    appId: string,
    requestOrigin: string
  ): Promise<OAuthConnectResponse> {
    const rawState = generateSecureToken(24);
    const stateHash = await sha256Hex(rawState);
    const redirectUri = `${requestOrigin}/api/integrations/instagram/callback`;
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    await connectionRepository.createOAuthAttempt(db, {
      stateHash,
      tenantId,
      userId,
      provider: 'instagram',
      redirectUri,
      expiresAt,
    });

    const authUrl = instagramOAuthAdapter.buildAuthorizationUrl({
      appId,
      redirectUri,
      state: rawState,
    });

    return {
      authUrl,
      state: rawState,
    };
  }

  /**
   * Completes the OAuth handshake inside the popup, exchanges long-lived token,
   * encrypts via AES-256-GCM, and configures webhooks.
   */
  async completeOAuth(
    db: D1Database,
    params: {
      code: string;
      state: string;
      appId: string;
      appSecret: string;
      requestOrigin: string;
      masterKeyBase64: string;
    }
  ): Promise<{ success: boolean; connectionId: string; username: string }> {
    const stateHash = await sha256Hex(params.state);
    const attempt = await connectionRepository.validateAndConsumeState(
      db,
      stateHash,
      'instagram'
    );

    if (!attempt) {
      throw new Error('OAuth state was invalid, expired, or already consumed.');
    }

    const redirectUri = `${params.requestOrigin}/api/integrations/instagram/callback`;

    // 1. Exchange code for short-lived token
    const { shortLivedToken } = await instagramOAuthAdapter.exchangeCodeForToken({
      appId: params.appId,
      appSecret: params.appSecret,
      redirectUri,
      code: params.code,
    });

    // 2. Exchange for official 60-day long-lived access token
    const tokenResult = await instagramOAuthAdapter.exchangeForLongLivedToken({
      appSecret: params.appSecret,
      shortLivedToken,
    });

    // 3. Fetch account metadata
    const profile = await instagramOAuthAdapter.fetchAccountProfile(tokenResult.accessToken);

    // 4. Subscribe app to account's webhooks
    const webhookSubscribed = await instagramOAuthAdapter.subscribeWebhooks(tokenResult.accessToken);

    // 5. Store in D1 with Web Crypto AES-256-GCM encryption
    const connectionId = await connectionRepository.upsertConnection(
      db,
      {
        tenantId: attempt.tenantId,
        provider: 'instagram',
        externalAccountId: profile.id,
        displayName: profile.username,
        grantedScopes: ['instagram_business_basic', 'instagram_business_manage_messages'],
        accessToken: tokenResult.accessToken,
        expiresInSeconds: tokenResult.expiresInSeconds,
        webhookSubscribed,
      },
      params.masterKeyBase64
    );

    logger.info('Instagram professional account connected successfully', {
      tenantId: attempt.tenantId,
      connectionId,
      username: profile.username,
      webhookSubscribed,
    });

    return {
      success: true,
      connectionId,
      username: profile.username,
    };
  }
}

export const instagramService = new InstagramService();
