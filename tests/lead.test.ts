import { describe, it, expect, vi } from 'vitest';
import { leadRepository } from '../worker/repositories/leadRepository';
import { UpdateLeadSchema, CreateLeadSchema } from '../shared/schemas/lead.schema';

describe('Lead Repository & Schemas', () => {
  it('validates UpdateLeadSchema with partial attributes', () => {
    expect(
      UpdateLeadSchema.safeParse({
        fullName: 'John Doe',
        leadScore: 85,
        leadStatus: 'qualified',
      }).success
    ).toBe(true);

    expect(
      UpdateLeadSchema.safeParse({
        leadScore: 120, // Exceeds max 100
      }).success
    ).toBe(false);

    expect(
      UpdateLeadSchema.safeParse({
        leadStatus: 'invalid_status',
      }).success
    ).toBe(false);
  });

  it('validates CreateLeadSchema required fields', () => {
    expect(CreateLeadSchema.safeParse({ fullName: 'Elena Rostova' }).success).toBe(true);
    expect(CreateLeadSchema.safeParse({}).success).toBe(false);
  });

  it('listLeads dynamically constructs SQL with filters', async () => {
    const allMock = vi.fn().mockResolvedValue({ results: [] });
    const bindMock = vi.fn().mockReturnValue({ all: allMock });
    const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
    const mockDb = { prepare: prepareMock } as any;

    await leadRepository.listLeads(mockDb, 'tenant_1', {
      status: 'qualified',
      destinationCountry: 'Germany',
      minScore: 70,
    });

    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('AND lead_status = ?'));
    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('AND destination_country = ?'));
    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('AND lead_score >= ?'));
    expect(bindMock).toHaveBeenCalledWith('tenant_1', 'qualified', 'Germany', 70, 50, 0);
  });
});
