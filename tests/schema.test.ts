import { describe, it, expect } from 'vitest';
import {
  AIQualificationResultSchema,
  CreateAIProviderSchema,
} from '../shared/schemas/ai.schema';
import { UpdateLeadSchema } from '../shared/schemas/lead.schema';

describe('Shared Schema Validations', () => {
  it('validates a complete RESIDER AI qualification output', () => {
    const sampleOutput = {
      intent: 'residency',
      language: 'en',
      replyText: 'We help with residency programmes and connecting people with verified experts. Are you looking for residency only, or a permit with residency?',
      rationale: 'Clarifying whether applicant needs permit alongside residency visa',
      extractedFields: {
        fullName: 'Sameer Khan',
        serviceVertical: 'residency',
        residencyIntent: 'understanding_options',
        workBusinessActivity: 'Software Consultant',
        uaeLocationContext: 'inside_uae',
      },
      missingFields: ['timeline', 'contactMethodPreference'],
      questionsAnswered: ['workBusinessActivity', 'uaeLocationContext'],
      leadStatus: 'exploring',
      statusReason: 'Applicant is inside UAE seeking software freelance options but has not committed to next steps',
      humanReviewRequired: false,
      safetyFlags: [],
    };

    const parsed = AIQualificationResultSchema.parse(sampleOutput);
    expect(parsed.intent).toBe('residency');
    expect(parsed.leadStatus).toBe('exploring');
    expect(parsed.extractedFields.workBusinessActivity).toBe('Software Consultant');
    expect(parsed.extractedFields.uaeLocationContext).toBe('inside_uae');
  });

  it('supplies safe defaults on minimal RESIDER AI qualification output', () => {
    const minimalOutput = {
      intent: 'unknown',
      replyText: null,
    };

    const parsed = AIQualificationResultSchema.parse(minimalOutput);
    expect(parsed.language).toBe('en');
    expect(parsed.leadStatus).toBe('needs_clarification');
    expect(parsed.missingFields).toEqual([]);
    expect(parsed.safetyFlags).toEqual([]);
    expect(parsed.humanReviewRequired).toBe(false);
  });

  it('validates CreateAIProviderSchema input', () => {
    const validProvider = {
      name: 'Groq Fast Tier',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'gsk_1234567890abcdef',
      defaultModel: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      maxTokens: 500,
    };

    const parsed = CreateAIProviderSchema.parse(validProvider);
    expect(parsed.name).toBe('Groq Fast Tier');
    expect(parsed.isActive).toBe(true);
    expect(parsed.isDefault).toBe(false);

    // Invalid URL fails validation
    expect(() =>
      CreateAIProviderSchema.parse({
        ...validProvider,
        baseUrl: 'not-a-url',
      })
    ).toThrow();
  });

  it('validates UpdateLeadSchema input for RESIDER', () => {
    const update = {
      leadStatus: 'ready_for_team' as const,
      serviceVertical: 'business_setup' as const,
      statusReason: 'Lead requested consultation for LLC setup in Dubai',
      contactPermission: true,
      externalSharingPermission: true,
    };

    const parsed = UpdateLeadSchema.parse(update);
    expect(parsed.leadStatus).toBe('ready_for_team');
    expect(parsed.serviceVertical).toBe('business_setup');
    expect(parsed.externalSharingPermission).toBe(true);
  });
});
