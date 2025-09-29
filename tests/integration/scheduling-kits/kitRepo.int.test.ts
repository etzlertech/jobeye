import { createClient } from '@supabase/supabase-js';
import { KitRepository } from '@/domains/repos/scheduling-kits/kit-repository';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase credentials are required for integration tests.');
}

const COMPANY_A = '00000000-0000-4000-a000-000000000003';
const COMPANY_B = '00000000-0000-4000-a000-0000000000bb';
const TENANT_B = '00000000-0000-4000-a000-0000000000bc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const repository = new KitRepository(supabase as unknown as any);

async function ensureCompany(companyId: string, tenantId: string, name: string) {
  await supabase
    .from('companies')
    .upsert(
      {
        id: companyId,
        tenant_id: tenantId,
        name,
        domain: `${companyId}.example.test`,
        is_active: true,
      },
      { onConflict: 'id' }
    );
}

describe('KitRepository integration', () => {
  const kitIds: string[] = [];

  beforeAll(async () => {
    await ensureCompany(COMPANY_A, '00000000-0000-4000-a000-0000000000aa', 'Seed Org A');
    await ensureCompany(COMPANY_B, TENANT_B, 'Seed Org B');
  });

  afterAll(async () => {
    if (kitIds.length === 0) {
      return;
    }

    await supabase.from('kits').delete().in('id', kitIds);
  });

  it('createKit inserts kit and items atomically', async () => {
    const kitCode = `TEST-KIT-${Date.now()}`;

    const created = await repository.createKit(
      {
        kitCode,
        name: 'Winter Response',
        items: [
          { itemType: 'equipment', quantity: 1, unit: 'set', isRequired: true },
          { itemType: 'material', quantity: 2, unit: 'bags', isRequired: false },
        ],
        metadata: { scenario: 'integration-test' },
      },
      COMPANY_A
    );

    kitIds.push(created.id);

    expect(created.items).toHaveLength(2);
    expect(created.kitCode).toBe(kitCode);

    const { data: itemRecords } = await supabase
      .from('kit_items')
      .select('id')
      .eq('kit_id', created.id);

    expect(itemRecords?.length).toBe(2);
  });

  it('listKits returns only kits for requested company', async () => {
    const kitA = await repository.createKit(
      {
        kitCode: `TEST-KIT-A-${Date.now()}`,
        name: 'Company A Kit',
        items: [
          { itemType: 'tool', quantity: 1, unit: 'pcs', isRequired: true },
        ],
      },
      COMPANY_A
    );
    kitIds.push(kitA.id);

    const kitB = await repository.createKit(
      {
        kitCode: `TEST-KIT-B-${Date.now()}`,
        name: 'Company B Kit',
        items: [
          { itemType: 'tool', quantity: 1, unit: 'pcs', isRequired: true },
        ],
      },
      COMPANY_B
    );
    kitIds.push(kitB.id);

    const companyAKits = await repository.listKits(COMPANY_A);
    const companyBKits = await repository.listKits(COMPANY_B);

    expect(companyAKits.some((kit) => kit.id === kitA.id)).toBe(true);
    expect(companyAKits.some((kit) => kit.id === kitB.id)).toBe(false);
    expect(companyBKits.some((kit) => kit.id === kitB.id)).toBe(true);
  });

  it('getKitById returns kit with items or null when company mismatch', async () => {
    const kit = await repository.createKit(
      {
        kitCode: `TEST-KIT-C-${Date.now()}`,
        name: 'Lookup Kit',
        items: [
          { itemType: 'equipment', quantity: 1, unit: 'set', isRequired: true },
        ],
      },
      COMPANY_A
    );

    kitIds.push(kit.id);

    const fetched = await repository.getKitById(kit.id, COMPANY_A);
    expect(fetched).not.toBeNull();
    expect(fetched?.items).toHaveLength(1);

    const crossTenant = await repository.getKitById(kit.id, COMPANY_B);
    expect(crossTenant).toBeNull();
  });
});
