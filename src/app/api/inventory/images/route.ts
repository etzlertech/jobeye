import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { z } from 'zod';
import { Logger } from '@/core/logger/logger';
import { createServiceSupabaseClient } from '@/lib/supabase/service-client';
import {
  CropBoxSchema,
  InventoryKindSchema,
} from '@/domains/inventory/types/inventory-types';
import { createInventoryIntakeServiceFromSupabase } from '@/domains/inventory/services/inventory-intake-service';

const logger = new Logger('inventory-images-api');

const FinalizeSchema = z.object({
  itemType: InventoryKindSchema,
  itemId: z.string().uuid(),
  storagePath: z.string().min(1),
  imageUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  aspectRatio: z.number().positive().optional(),
  originalWidth: z.number().int().positive().optional(),
  originalHeight: z.number().int().positive().optional(),
  cropBox: CropBoxSchema.optional(),
  isPrimary: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
  capturedAt: z.string().datetime().optional(),
});

const SetPrimarySchema = z.object({
  imageId: z.string().uuid(),
  itemType: InventoryKindSchema,
  itemId: z.string().uuid(),
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

  return { session: authData.session, routeClient };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.session) return auth.response;

    const body = await request.json();
    const validation = FinalizeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: validation.error.issues },
        { status: 400 },
      );
    }

    const serviceClient = createServiceSupabaseClient();
    const tenantId = await resolveTenantId(serviceClient, auth.session.user.id);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'No active tenant assignment found for user' },
        { status: 403 },
      );
    }

    const inventoryService = createInventoryIntakeServiceFromSupabase(serviceClient);
    const image = await inventoryService.finalizeUploadedImage(
      {
        tenantId,
        itemType: validation.data.itemType,
        itemId: validation.data.itemId,
      },
      {
        storagePath: validation.data.storagePath,
        imageUrl: validation.data.imageUrl,
        thumbnailUrl: validation.data.thumbnailUrl,
        aspectRatio: validation.data.aspectRatio,
        originalWidth: validation.data.originalWidth,
        originalHeight: validation.data.originalHeight,
        cropBox: validation.data.cropBox,
        isPrimary: validation.data.isPrimary,
        metadata: validation.data.metadata,
        capturedBy: auth.session.user.id,
        capturedAt: validation.data.capturedAt,
      },
    );

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    logger.error('Failed to finalize inventory image', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to finalize inventory image' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.session) return auth.response;

    const body = await request.json();
    const validation = SetPrimarySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: validation.error.issues },
        { status: 400 },
      );
    }

    const serviceClient = createServiceSupabaseClient();
    const tenantId = await resolveTenantId(serviceClient, auth.session.user.id);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'No active tenant assignment found for user' },
        { status: 403 },
      );
    }

    const inventoryService = createInventoryIntakeServiceFromSupabase(serviceClient);
    await inventoryService.setPrimaryImage(
      {
        tenantId,
        itemType: validation.data.itemType,
        itemId: validation.data.itemId,
      },
      validation.data.imageId,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to set primary inventory image', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to set primary image' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.session) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const imageId = searchParams.get('imageId');
    const itemType = searchParams.get('itemType');
    const itemId = searchParams.get('itemId');

    if (!imageId || !itemType || !itemId) {
      return NextResponse.json(
        { error: 'imageId, itemType, and itemId are required query parameters' },
        { status: 400 },
      );
    }

    const parsedItemType = InventoryKindSchema.safeParse(itemType);
    if (!parsedItemType.success) {
      return NextResponse.json(
        { error: 'Invalid itemType provided' },
        { status: 400 },
      );
    }

    const serviceClient = createServiceSupabaseClient();
    const tenantId = await resolveTenantId(serviceClient, auth.session.user.id);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'No active tenant assignment found for user' },
        { status: 403 },
      );
    }

    const inventoryService = createInventoryIntakeServiceFromSupabase(serviceClient);
    await inventoryService.deleteImage(
      {
        tenantId,
        itemType: parsedItemType.data,
        itemId,
      },
      imageId,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete inventory image', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to delete inventory image' },
      { status: 500 },
    );
  }
}
