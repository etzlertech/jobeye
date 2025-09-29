import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { z } from 'zod';
import { Logger } from '@/core/logger/logger';
import { createServiceSupabaseClient } from '@/lib/supabase/service-client';
import { createInventoryIntakeServiceFromSupabase } from '@/domains/inventory/services/inventory-intake-service';
import { InventoryKindSchema } from '@/domains/inventory/types/inventory-types';

const logger = new Logger('inventory-item-detail-api');

const QuerySchema = z.object({
  itemType: InventoryKindSchema,
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

export async function GET(request: NextRequest, { params }: { params: { itemId: string } }) {
  try {
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: authData, error } = await routeClient.auth.getSession();

    if (error || !authData.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    if (!query.success) {
      return NextResponse.json(
        { error: 'itemType query parameter is required and must be valid', issues: query.error.issues },
        { status: 400 },
      );
    }

    const serviceClient = createServiceSupabaseClient();
    const tenantId = await resolveTenantId(serviceClient, authData.session.user.id);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'No active tenant assignment found for user' },
        { status: 403 },
      );
    }

    const inventoryService = createInventoryIntakeServiceFromSupabase(serviceClient);
    const item = await inventoryService.getItemDetail(query.data.itemType, params.itemId, { tenantId });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (err) {
    logger.error('Failed to load inventory item detail', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to load item detail' },
      { status: 500 },
    );
  }
}
