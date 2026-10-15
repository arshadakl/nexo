import { describe, it, expect } from 'vitest';
import {
  constantTimeEqual,
  verifyMetaSignature,
  sha256Hex,
  encryptCredential,
  decryptCredential,
} from '../worker/lib/crypto';

describe('Web Crypto Utilities', () => {
  it('constantTimeEqual correctly compares strings', () => {
    expect(constantTimeEqual('hello', 'hello')).toBe(true);
    expect(constantTimeEqual('hello', 'world')).toBe(false);
    expect(constantTimeEqual('hello', 'hell')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('sha256Hex generates standard 64-char hex digest', async () => {
    const hash = await sha256Hex('test-state-string');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifyMetaSignature validates authentic HMAC-SHA256 signatures', async () => {
    const rawBody = JSON.stringify({ object: 'instagram', entry: [] });
    const appSecret = 'test_meta_app_secret_123';

    // Compute expected signature
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(rawBody));
    let hex = '';
    new Uint8Array(sigBuffer).forEach((b) => {
      hex += b.toString(16).padStart(2, '0');
    });

    const validHeader = `sha256=${hex}`;
    const isValid = await verifyMetaSignature(rawBody, validHeader, appSecret);
    expect(isValid).toBe(true);

    // Tampered payload
    const tamperedValid = await verifyMetaSignature(rawBody + 'tamper', validHeader, appSecret);
    expect(tamperedValid).toBe(false);

    // Invalid signature header
    const badSigValid = await verifyMetaSignature(rawBody, 'sha256=invalidhex', appSecret);
    expect(badSigValid).toBe(false);

    // Missing header
    const missingValid = await verifyMetaSignature(rawBody, null, appSecret);
    expect(missingValid).toBe(false);
  });

  it('encryptCredential and decryptCredential round-trips with AES-256-GCM', async () => {
    // Generate a 32-byte Base64 master key
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    const masterKeyBase64 = btoa(String.fromCharCode(...rawKey));

    const secretApiKey = 'sk-or-v1-abcdef1234567890-openrouter-key';

    const encrypted = await encryptCredential(secretApiKey, masterKeyBase64, 1);
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.nonce).toBeTruthy();
    expect(encrypted.keyVersion).toBe(1);

    const decrypted = await decryptCredential(
      encrypted.ciphertext,
      encrypted.nonce,
      encrypted.keyVersion,
      masterKeyBase64
    );

    expect(decrypted).toBe(secretApiKey);
  });
});
