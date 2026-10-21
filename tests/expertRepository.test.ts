import { describe, it, expect, vi } from 'vitest';
import { expertRepository } from '../worker/repositories/expertRepository';
import { CreateExpertSchema } from '../shared/schemas/expert.schema';

describe('Verified Expert Repository & Schemas', () => {
  it('validates CreateExpertSchema input', () => {
    const valid = CreateExpertSchema.safeParse({
      fullName: 'Anwar Sadath',
      organizationName: 'Gulf Setup Advisory',
      sectors: ['tech', 'e-commerce'],
      languages: ['en', 'ml'],
      emirates: ['dubai', 'sharjah'],
      contactPhone: '+971501234567',
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.isVerified).toBe(true);
      expect(valid.data.isAvailable).toBe(true);
    }

    // Must fail without sectors
    expect(
      CreateExpertSchema.safeParse({
        fullName: 'Test Expert',
        organizationName: 'Test Org',
        sectors: [],
      }).success
    ).toBe(false);
  });

  it('listExperts builds query with sector, language, and availability filters', async () => {
    const allMock = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'exp_1',
          tenant_id: 'tenant_1',
          full_name: 'Anwar Sadath',
          organization_name: 'Gulf Advisory',
          sectors_json: '["tech"]',
          languages_json: '["en", "ml"]',
          emirates_json: '["dubai"]',
          services_offered_json: '["freezone_licence"]',
          is_verified: 1,
          is_available: 1,
          contact_phone: '+971501112233',
          contact_email: 'anwar@gulfadvisory.ae',
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ],
    });
    const bindMock = vi.fn().mockReturnValue({ all: allMock });
    const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
    const mockDb = { prepare: prepareMock } as any;

    const experts = await expertRepository.listExperts(mockDb, 'tenant_1', {
      sector: 'tech',
      language: 'ml',
      isVerified: true,
      isAvailable: true,
    });

    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('sectors_json LIKE ?'));
    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('languages_json LIKE ?'));
    expect(experts.length).toBe(1);
    const firstExpert = experts[0];
    expect(firstExpert).toBeDefined();
    if (firstExpert) {
      expect(firstExpert.fullName).toBe('Anwar Sadath');
      expect(firstExpert.languages).toEqual(['en', 'ml']);
      expect(firstExpert.isVerified).toBe(true);
    }
  });
});
