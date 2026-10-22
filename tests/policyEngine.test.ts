import { describe, it, expect } from 'vitest';
import { evaluateReplyPolicy } from '../worker/lib/policyEngine';

describe('Worker-Side Reply Policy Engine', () => {
  it('allows safe qualification replies without currency quotes', () => {
    const result = evaluateReplyPolicy('Hey bro! What kind of work are you planning to do in Dubai?');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('blocks messages containing explicit AED prices', () => {
    const result = evaluateReplyPolicy('The package is AED 7,500 including all freezone permit costs.');
    expect(result.allowed).toBe(false);
    expect(result.flag).toBe('UNAUTHORIZED_PRICE_QUOTATION');
  });

  it('blocks messages containing price in dirhams', () => {
    const result = evaluateReplyPolicy('Our fee is 6500 dirhams for the freelancer visa.');
    expect(result.allowed).toBe(false);
    expect(result.flag).toBe('UNAUTHORIZED_PRICE_QUOTATION');
  });

  it('blocks messages attempting INR currency conversion', () => {
    const result = evaluateReplyPolicy('In Indian rupees that would be roughly 150000 INR.');
    expect(result.allowed).toBe(false);
    expect(result.flag).toBe('UNAUTHORIZED_PRICE_QUOTATION');
  });

  it('blocks empty or whitespace-only messages', () => {
    const result = evaluateReplyPolicy('   ');
    expect(result.allowed).toBe(false);
    expect(result.flag).toBe('EMPTY_REPLY');
  });
});
