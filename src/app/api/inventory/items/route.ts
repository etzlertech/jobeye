import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { z } from 'zod';
import { Logger } from '@/core/logger/logger';
import { createServiceSupabaseClient } from '@/lib/supabase/service-client';
import { createInventoryIntakeServiceFromSupabase } from '@/domains/inventory/services/inventory-intake-service';
import {
  InventoryKindSchema,
  InventoryItemSummary,
} from '@/domains/inventory/types/inventory-types';
import { EquipmentRepository } from '@/domains/equipment/repositories/equipment-repository';
import { MaterialRepository } from '@/domains/material/repositories/material-repository';
import { EquipmentType, EquipmentCategory } from '@/domains/equipment/types/equipment-types';
import { MaterialType, MaterialCategory, MaterialUnit } from '@/domains/material/types/material-types';

const logger = new Logger('inventory-items-api');

const CreateItemSchema = z.object({
  itemType: InventoryKindSchema,
  name: z.string().min(1).max(120),
  sku: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  equipmentType: z.nativeEnum(EquipmentType).optional(),
  equipmentCategory: z.nativeEnum(EquipmentCategory).optional(),
  materialType: z.nativeEnum(MaterialType).optional(),
  materialCategory: z.nativeEnum(MaterialCategory).optional(),
  materialUnit: z.nativeEnum(MaterialUnit).optional(),
});

async function resolveTenantId(serviceClient: ReturnType<typeof createServiceSupabaseClient>, userId: string) {
  const { data, error } = await serviceClient
    .from('tenant_assignments')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('Failed to resolve tenant assignment', { error, userId });
    throw error;
  }

  return data?.tenant_id ?? null;
}

async function requireAuth() {
  const routeClient = createRouteHandlerClient({ cookies });
  const { data: authData, error } = await routeClient.auth.getSession();

  if (error || !authData.session) {
    return { session: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { session: authData.session };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.session) return auth.response;

    const serviceClient = createServiceSupabaseClient();
    const tenantId = await resolveTenantId(serviceClient, auth.session.user.id);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'No active tenant assignment found for user' },
        { status: 403 },
      );
    }

    const itemTypeParam = request.nextUrl.searchParams.get('itemType');
    const parsedType = itemTypeParam ? InventoryKindSchema.safeParse(itemTypeParam) : null;

    const inventoryService = createInventoryIntakeServiceFromSupabase(serviceClient);

    let results: InventoryItemSummary[] = [];
    if (parsedType?.success) {
      results = await inventoryService.listItemSummaries(parsedType.data, { tenantId });
    } else {
      const [equipment, materials] = await Promise.all([
        inventoryService.listItemSummaries('equipment', { tenantId }),
        inventoryService.listItemSummaries('material', { tenantId }),
      ]);
      results = [...equipment, ...materials];
    }

    return NextResponse.json({ items: results }, { status: 200 });
  } catch (error) {
    logger.error('Failed to list inventory items', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to list inventory items' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.session) return auth.response;

    const body = await request.json();
    const validation = CreateItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: validation.error.issues },
        { status: 400 },
      );
    }

    const input = validation.data;

    const serviceClient = createServiceSupabaseClient();
    const tenantId = await resolveTenantId(serviceClient, auth.session.user.id);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'No active tenant assignment found for user' },
        { status: 403 },
      );
    }

    if (input.itemType === 'equipment') {
      const repository = new EquipmentRepository(serviceClient);
      const equipment = await repository.createEquipment(
        {
          name: input.name,
          type: input.equipmentType || EquipmentType.OTHER,
          category: input.equipmentCategory || EquipmentCategory.TOOL,
          manufacturer: {
            name: 'Unspecified',
            model: input.sku || 'N/A',
          },
          serialNumber: input.sku,
          location: {
            type: 'warehouse',
            id: 'unassigned',
            name: 'Unassigned',
          },
          notes: input.notes,
          tags: [],
          customFields: {},
        },
        tenantId,
      );

      return NextResponse.json({ item: equipment }, { status: 201 });
    }

    if (input.itemType === 'material') {
      const repository = new MaterialRepository(serviceClient);
      const material = await repository.createMaterial(
        {
          name: input.name,
          description: input.description,
          sku: input.sku,
          type: input.materialType || MaterialType.OTHER,
          category: input.materialCategory || MaterialCategory.CONSUMABLES,
          unit: input.materialUnit || MaterialUnit.EACH,
          pricing: [],
          initialInventory: [],
          tags: [],
          customFields: {},
        },
        tenantId,
      );

      return NextResponse.json({ item: material }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unsupported item type' }, { status: 400 });
  } catch (error) {
    logger.error('Failed to create inventory item', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to create inventory item' },
      { status: 500 },
    );
  }
}
