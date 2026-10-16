import { Hono } from 'hono';
import { jsonOk, jsonError } from '../lib/response';
import { connectionRepository } from '../repositories/connectionRepository';
import { ConnectWhatsAppSchema } from '@shared/schemas/whatsapp.schema';
import type { WorkerEnv } from '../env';

import { resolveTenantId, getMasterKey } from '../lib/authContext';

export const whatsappRoutes = new Hono<{ Bindings: WorkerEnv }>();

/**
 * POST /api/integrations/whatsapp/connect
 * Stores and AES-256-GCM encrypts WhatsApp Business Cloud API credentials.
 */
whatsappRoutes.post('/connect', async (c) => {
  const tenantId = resolveTenantId(c);

  let rawBody: any;
  try {
    rawBody = await c.req.json();
  } catch {
    return jsonError(c, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parseResult = ConnectWhatsAppSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return jsonError(c, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid WhatsApp credentials', 400);
  }

  const { phoneNumberId, wabaId, accessToken, displayName, phoneNumber } = parseResult.data;
  const masterKey = getMasterKey(c);

  // Upsert connection into D1 with AES-256-GCM encrypted token
  const connectionId = await connectionRepository.upsertConnection(
    c.env.DB,
    {
      tenantId,
      provider: 'whatsapp',
      externalAccountId: phoneNumberId,
      displayName: displayName || `WhatsApp (${phoneNumber || phoneNumberId})`,
      grantedScopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
      accessToken,
      webhookSubscribed: true,
    },
    masterKey
  );

  // Update additional WhatsApp specific fields
  await c.env.DB
    .prepare(
      `UPDATE integration_connections 
       SET phone_number_id = ?, waba_id = ?, phone_number = ?
       WHERE id = ?`
    )
    .bind(phoneNumberId, wabaId, phoneNumber || null, connectionId)
    .run();

  return jsonOk(c, {
    success: true,
    connectionId,
    phoneNumberId,
    displayName: displayName || phoneNumberId,
  });
});
