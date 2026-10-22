import { describe, it, expect, vi } from 'vitest';
import { leadRepository } from '../worker/repositories/leadRepository';
import { UpdateLeadSchema, CreateLeadSchema } from '../shared/schemas/lead.schema';

describe('RESIDER Lead Repository & Schemas', () => {
  it('validates UpdateLeadSchema with RESIDER canonical attributes', () => {
    expect(
      UpdateLeadSchema.safeParse({
        fullName: 'Zayed Al Mansoori',
        serviceVertical: 'residency',
        residencyIntent: 'permit_with_residency',
        leadStatus: 'ready_for_team',
        statusReason: 'Client wants freelance permit and confirmed WhatsApp contact',
        contactPermission: true,
      }).success
    ).toBe(true);

    expect(
      UpdateLeadSchema.safeParse({
        leadStatus: 'invalid_status_xyz',
      }).success
    ).toBe(false);

    expect(
      UpdateLeadSchema.safeParse({
        serviceVertical: 'illegal_vertical',
      }).success
    ).toBe(false);
  });

  it('validates CreateLeadSchema required fields and default statuses', () => {
    const valid = CreateLeadSchema.safeParse({
      fullName: 'Rashid Khan',
      serviceVertical: 'business_setup',
      workBusinessActivity: 'Tech Consulting',
      uaeLocationContext: 'inside_uae',
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.leadStatus).toBe('needs_clarification');
      expect(valid.data.contactPermission).toBe(false);
      expect(valid.data.missingDetails).toEqual([]);
    }

    expect(CreateLeadSchema.safeParse({}).success).toBe(false);
  });

  it('listLeads dynamically constructs SQL with RESIDER filters', async () => {
    const allMock = vi.fn().mockResolvedValue({ results: [] });
    const bindMock = vi.fn().mockReturnValue({ all: allMock });
    const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
    const mockDb = { prepare: prepareMock } as any;

    await leadRepository.listLeads(mockDb, 'tenant_1', {
      status: 'ready_for_team',
      serviceVertical: 'residency',
      uaeLocationContext: 'inside_uae',
      search: 'freelance',
    });

    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('AND lead_status = ?'));
    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('AND service_vertical = ?'));
    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('AND uae_location_context = ?'));
    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('full_name LIKE ?'));
    expect(bindMock).toHaveBeenCalledWith(
      'tenant_1',
      'ready_for_team',
      'residency',
      'inside_uae',
      '%freelance%',
      '%freelance%',
      '%freelance%',
      '%freelance%',
      '%freelance%',
      '%freelance%',
      '%freelance%',
      50,
      0
    );
  });
});
