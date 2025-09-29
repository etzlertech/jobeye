import { createClient } from '@supabase/supabase-js';
import { KitRepository } from '@/domains/repos/scheduling-kits/kit-repository';
import { KitVariantRepository } from '@/domains/repos/scheduling-kits/kit-variant-repository';
import { KitAssignmentRepository } from '@/domains/repos/scheduling-kits/kit-assignment-repository';
import { KitOverrideLogRepository } from '@/domains/repos/scheduling-kits/kit-override-log-repository';
import { KitService } from '@/domains/services/scheduling-kits/kit-service';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase credentials are required for integration tests.');
}

const COMPANY_A = '00000000-0000-4000-a000-000000000003';
const COMPANY_B = '00000000-0000-4000-a000-0000000000bb';
const FIXED_NOW = new Date('2025-01-01T00:00:00.000Z');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const kitRepository = new KitRepository(supabase as unknown as any);
const kitVariantRepository = new KitVariantRepository(supabase as unknown as any);
const kitAssignmentRepository = new KitAssignmentRepository(supabase as unknown as any);
const kitOverrideLogRepository = new KitOverrideLogRepository(supabase as unknown as any);

const service = new KitService({
  kitRepository,
  kitVariantRepository,
  kitAssignmentRepository,
  kitOverrideLogRepository,
  clock: {
    now: () => FIXED_NOW,
  },
});

describe('KitService integration', () => {
  const kitIds: string[] = [];
  let createdKitId: string | null = null;
  let lastAssignmentId: string | null = null;

  afterAll(async () => {
    if (kitIds.length === 0) {
      return;
    }

    await supabase.from('kits').delete().in('id', kitIds);
  });

  it('createKitWithSteps persists kit and items', async () => {
    const kitCode = `SERVICE-KIT-${Date.now()}`;

    const created = await service.createKitWithSteps(
      {
        kitCode,
        name: 'Service Created Kit',
        items: [
          { itemType: 'tool', quantity: 3, unit: 'pcs', isRequired: true },
          { itemType: 'material', quantity: 1, unit: 'bag', isRequired: false },
        ],
      },
      COMPANY_A
    );

    createdKitId = created.id;
    kitIds.push(created.id);

    expect(created.items).toHaveLength(2);
    expect(created.kitCode).toBe(kitCode);

    const reloaded = await kitRepository.getKitById(created.id, COMPANY_A);
    expect(reloaded?.items.length).toBe(2);
  });

  it('assignKitByCode stores assignment with default variant metadata', async () => {
    if (!createdKitId) {
      throw new Error('Kit not created for assignment test.');
    }

    const variant = await kitVariantRepository.createVariant({
      kitId: createdKitId,
      companyId: COMPANY_A,
      variantCode: 'DEFAULT',
      name: 'Default Variant',
      isDefault: true,
      metadata: { tier: 'default' },
    });

    const assignment = await service.assignKitByCode({
      companyId: COMPANY_A,
      kitCode: (await kitRepository.getKitById(createdKitId, COMPANY_A))!.kitCode,
      externalRef: `ASSIGN-${Date.now()}`,
      metadata: { source: 'integration-test' },
    });

    lastAssignmentId = assignment.id;

    expect(assignment.variantId).toBe(variant.id);
    expect(assignment.metadata && typeof assignment.metadata === 'object').toBe(true);
    expect((assignment.metadata as Record<string, unknown>).kitCode).toBeDefined();
  });

  it('recordOverride writes an override log for the assignment', async () => {
    if (!lastAssignmentId || !createdKitId) {
      throw new Error('Assignment not created before override test.');
    }

    const override = await service.recordOverride({
      companyId: COMPANY_A,
      assignmentId: lastAssignmentId,
      itemId: null,
      reason: 'Technician reported missing cones',
      delta: { missingItems: ['cones'] },
      metadata: { reporter: 'integration-test' },
    });

    expect(override.id).toBeDefined();

    const { data } = await supabase
      .from('kit_override_logs')
      .select('id')
      .eq('id', override.id)
      .single();

    expect(data?.id).toBe(override.id);
  });

  it('getKitOrThrow enforces tenant isolation', async () => {
    if (!createdKitId) {
      throw new Error('Kit not created for isolation test.');
    }

    await expect(service.getKitOrThrow(COMPANY_B, createdKitId)).rejects.toThrow('Kit not found');
  });
});
