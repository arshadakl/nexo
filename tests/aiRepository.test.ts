import { describe, it, expect } from 'vitest';
import { maskApiKey } from '../worker/repositories/aiProviderRepository';

describe('AIProviderRepository Utilities', () => {
  it('correctly masks API keys preserving prefixes and suffixes', () => {
    expect(maskApiKey('gsk_1234567890abcdef')).toBe('gsk_••••••••••••cdef');
    expect(maskApiKey('sk-or-v1-abcdef123456')).toBe('sk-o••••••••••••3456');
    expect(maskApiKey('short')).toBe('••••••••');
    expect(maskApiKey('')).toBe('••••••••');
  });
});
