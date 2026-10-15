/**
 * Native Web Crypto utilities for Cloudflare Workers.
 * Pure native C++ implementations: < 0.2 ms CPU per operation.
 * Zero Node polyfills or external crypto libraries.
 */

// Helper to convert Uint8Array to hex string
function toHex(buffer: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    if (b !== undefined) {
      hex += b.toString(16).padStart(2, '0');
    }
  }
  return hex;
}

// Constant-time string equality check to prevent timing attacks
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verifies Meta X-Hub-Signature-256 header in constant time.
 * @param rawBody - Raw unparsed webhook payload string
 * @param signatureHeader - e.g. "sha256=abcdef..."
 * @param appSecret - Meta App Secret
 */
export async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedHex = signatureHeader.substring(7);
  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);
  const bodyData = encoder.encode(rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, bodyData);
  const actualHex = toHex(new Uint8Array(signature));

  return constantTimeEqual(expectedHex.toLowerCase(), actualHex.toLowerCase());
}

/**
 * Computes SHA-256 hex digest of an input string (e.g. for OAuth state hashing).
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

/**
 * Encrypts sensitive credentials (tokens, API keys) using AES-256-GCM.
 * Fresh 12-byte random IV per call.
 */
export async function encryptCredential(
  plaintext: string,
  masterKeyBase64: string,
  keyVersion = 1
): Promise<{ ciphertext: string; nonce: string; keyVersion: number }> {
  // Decode Base64 master key (must be 32 bytes for AES-256)
  const rawKey = Uint8Array.from(atob(masterKeyBase64), (c) => c.charCodeAt(0));
  if (rawKey.length !== 32) {
    throw new Error('Master encryption key must be exactly 32 bytes (256 bits)');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText
  );

  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  const nonceBase64 = btoa(String.fromCharCode(...iv));

  return {
    ciphertext: ciphertextBase64,
    nonce: nonceBase64,
    keyVersion,
  };
}

/**
 * Decrypts sensitive credentials using AES-256-GCM.
 */
export async function decryptCredential(
  ciphertextBase64: string,
  nonceBase64: string,
  _keyVersion: number,
  masterKeyBase64: string
): Promise<string> {
  const rawKey = Uint8Array.from(atob(masterKeyBase64), (c) => c.charCodeAt(0));
  if (rawKey.length !== 32) {
    throw new Error('Master encryption key must be exactly 32 bytes (256 bits)');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const iv = Uint8Array.from(atob(nonceBase64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Generates a cryptographically secure random string (for tokens, state, nonces).
 */
export function generateSecureToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toHex(bytes);
}
