import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { z } from 'zod';
import { Logger } from '@/core/logger/logger';
import { createServiceSupabaseClient } from '@/lib/supabase/service-client';
import { InventoryKindSchema } from '@/domains/inventory/types/inventory-types';
import { createInventoryIntakeServiceFromSupabase } from '@/domains/inventory/services/inventory-intake-service';

const logger = new Logger('inventory-image-upload-url');

const UploadUrlRequestSchema = z.object({
  itemType: InventoryKindSchema,
  itemId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(150),
  fileSize: z.number().positive().max(25 * 1024 * 1024).optional(),
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

export async function POST(request: NextRequest) {
  try {
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: authData, error: authError } = await routeClient.auth.getSession();

    if (authError || !authData.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = UploadUrlRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: validation.error.issues },
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
    const uploadSession = await inventoryService.createUploadSession(
      {
        tenantId,
        itemType: validation.data.itemType,
        itemId: validation.data.itemId,
      },
      {
        fileName: validation.data.fileName,
        mimeType: validation.data.mimeType,
        fileSize: validation.data.fileSize,
        capturedBy: authData.session.user.id,
      },
    );

    logger.info('Created inventory image upload session', {
      tenantId,
      itemType: validation.data.itemType,
      itemId: validation.data.itemId,
      userId: authData.session.user.id,
    });

    return NextResponse.json(uploadSession, { status: 200 });
  } catch (error) {
    logger.error('Failed to create inventory image upload URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to create upload URL' },
      { status: 500 },
    );
  }
}
