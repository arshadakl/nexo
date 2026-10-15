import { describe, it, expect } from 'vitest';
import {
  AIQualificationResultSchema,
  CreateAIProviderSchema,
} from '../shared/schemas/ai.schema';
import { UpdateLeadSchema } from '../shared/schemas/lead.schema';

describe('Shared Schema Validations', () => {
  it('validates a complete AI qualification output', () => {
    const sampleOutput = {
      intent: 'study',
      language: 'en',
      replyText: 'Hi Alex! Which university program are you planning to apply for in Canada?',
      extractedFields: {
        fullName: 'Alex Johnson',
        destinationCountry: 'Canada',
        visaCategory: 'study_permit',
        education: 'Bachelor in Computer Science',
      },
      fieldConfidence: {
        destinationCountry: 0.95,
        visaCategory: 0.9,
      },
      missingFields: ['timeline', 'budgetRange'],
      nextQuestion: 'What is your intended start term?',
      leadScore: 65,
      scoreComponents: {
        intentScore: 25,
        completenessScore: 15,
        readinessScore: 15,
        timelineFitScore: 5,
        engagementScore: 5,
      },
      leadStatus: 'collecting_information',
      humanReviewRequired: false,
      safetyFlags: [],
    };

    const parsed = AIQualificationResultSchema.parse(sampleOutput);
    expect(parsed.intent).toBe('study');
    expect(parsed.leadScore).toBe(65);
    expect(parsed.extractedFields.destinationCountry).toBe('Canada');
  });

  it('supplies safe defaults on partial AI qualification output', () => {
    const minimalOutput = {
      intent: 'unknown',
      replyText: null,
    };

    const parsed = AIQualificationResultSchema.parse(minimalOutput);
    expect(parsed.language).toBe('en');
    expect(parsed.leadScore).toBe(0);
    expect(parsed.leadStatus).toBe('collecting_information');
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

  it('validates UpdateLeadSchema input', () => {
    const update = {
      leadStatus: 'qualified' as const,
      leadScore: 85,
      residenceCountry: 'India',
      destinationCountry: 'Australia',
    };

    const parsed = UpdateLeadSchema.parse(update);
    expect(parsed.leadStatus).toBe('qualified');
    expect(parsed.leadScore).toBe(85);
  });
});
