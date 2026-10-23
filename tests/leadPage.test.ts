import { beforeEach, describe, expect, it } from 'vitest';
import { createTestD1 } from './helpers/testD1';
import { leadRoutes } from '../worker/routes/lead.routes';

const TENANT = 'tenant_visa_horizon_default';
let env: any;

beforeEach(() => {
  const { db, sqlite } = createTestD1();
  env = { DB: db };
  const insert = sqlite.prepare(
    `INSERT INTO leads (id, tenant_id, full_name, lead_status, qualification, service_vertical, phone_or_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const rows: [string, string | null, string, string, string, string | null][] = [
    ['l1', 'Zara', 'exploring', 'warm', 'residency', null],
    ['l2', 'Adam', 'ready_for_team', 'hot', 'residency', '+971500000001'],
    ['l3', null, 'needs_clarification', 'unknown', 'unspecified', null],
    ['l4', 'Bilal', 'handed_over', 'cold', 'business_setup', null],
  ];
  rows.forEach(([id, name, status, q, service, phone], i) =>
    insert.run(id, TENANT, name, status, q, service, phone, 1000 + i, 2000 + i)
  );
  for (let i = 0; i < 30; i++) insert.run(`bulk${i}`, TENANT, `Lead ${i}`, 'exploring', 'unknown', 'residency', null, 10, 10);
});

async function search(query: string) {
  const res = await leadRoutes.fetch(new Request(`http://test/search?${query}`, { headers: { 'X-Tenant-Id': TENANT } }), env);
  return { status: res.status, body: ((await res.json()) as any).data };
}

describe('GET /api/leads/search', () => {
  it('pages results and reports the total', async () => {
    const first = await search('pageSize=25&page=1');
    expect(first.body.total).toBe(34);
    expect(first.body.items).toHaveLength(25);
    const second = await search('pageSize=25&page=2');
    expect(second.body.items).toHaveLength(9);
    expect(new Set([...first.body.items, ...second.body.items].map((l: any) => l.id)).size).toBe(34);
  });

  it('filters by stage, service, qualification and search text', async () => {
    expect((await search('status=ready_for_team')).body.items.map((l: any) => l.id)).toEqual(['l2']);
    expect((await search('serviceVertical=business_setup')).body.items.map((l: any) => l.id)).toEqual(['l4']);
    expect((await search('qualification=cold')).body.items.map((l: any) => l.id)).toEqual(['l4']);
    expect((await search('search=500000001')).body.items.map((l: any) => l.id)).toEqual(['l2']);
  });

  it('sorts by name A-Z with unnamed leads last, and Hot first by qualification', async () => {
    const byName = (await search('sort=name&direction=asc&qualification=warm')).body.items;
    expect(byName.map((l: any) => l.fullName)).toEqual(['Zara']);
    const named = (await search('sort=name&direction=asc&pageSize=200')).body.items.map((l: any) => l.fullName);
    expect(named.slice(0, 2)).toEqual(['Adam', 'Bilal']);
    expect(named.at(-1)).toBeNull();
    expect((await search('sort=qualification&direction=asc')).body.items[0].id).toBe('l2');
  });

  it('rejects invalid query values', async () => {
    expect((await search('pageSize=5000')).status).toBe(400);
    expect((await search('status=nope')).status).toBe(400);
  });
});

describe('POST /api/leads/bulk-status', () => {
  it('moves the selected leads to one stage', async () => {
    const res = await leadRoutes.fetch(
      new Request('http://test/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': TENANT },
        body: JSON.stringify({ leadIds: ['l1', 'l3'], leadStatus: 'ready_for_team' }),
      }),
      env
    );
    expect(((await res.json()) as any).data.updated).toBe(2);
    expect((await search('status=ready_for_team')).body.items.map((l: any) => l.id).sort()).toEqual(['l1', 'l2', 'l3']);
  });
});
