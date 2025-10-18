/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/app/api/supervisor/users/[userId]/image/route.ts
 * phase: 2
 * domain: user-management
 * purpose: Upload and process supervisor-managed user profile images
 * spec_ref: docs/PLAN-USER-MANAGEMENT-WITH-IMAGES.md#phase-2-backend-api-routes-day-1-afternoon
 * complexity_budget: 200
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { UserManagementService } from '@/domains/user-management/services/user.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ImagePayload {
  images?: {
    thumbnail?: string;
    medium?: string;
    full?: string;
  };
}

const BUCKET = 'equipment-images';

function dataUrlToBuffer(dataUrl: string): Buffer {
  const [header, base64] = dataUrl.split(',');
  const match = header.match(/data:(.*);base64/);
  if (!match) throw new Error('Invalid data URL');
  return Buffer.from(base64, 'base64');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const context = await getRequestContext(request);

    console.log('[POST /api/supervisor/users/[userId]/image] Request received', {
      userId: params.userId,
      tenantId: context.tenantId,
      isSupervisor: context.isSupervisor,
      roles: context.roles
    });

    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can upload user images',
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as ImagePayload;
    const { images } = body;

    if (
      !images?.thumbnail ||
      !images?.medium ||
      !images?.full
    ) {
      return NextResponse.json(
        {
          error: 'Invalid payload',
          message: 'Missing processed image data',
          code: 'INVALID_INPUT'
        },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();
    const timestamp = Date.now();

    const uploadTargets = [
      { key: 'thumbnail_url', dataUrl: images.thumbnail, suffix: 'thumbnail' },
      { key: 'medium_url', dataUrl: images.medium, suffix: 'medium' },
      { key: 'primary_image_url', dataUrl: images.full, suffix: 'full' }
    ] as const;

    const uploaded: Record<typeof uploadTargets[number]['key'], string> = {
      thumbnail_url: '',
      medium_url: '',
      primary_image_url: ''
    };

    for (const target of uploadTargets) {
      const fileBuffer = dataUrlToBuffer(target.dataUrl);
      const path = `user-avatars/${params.userId}/${timestamp}-${target.suffix}.jpg`;

      const { error: uploadError } = await serviceClient.storage
        .from(BUCKET)
        .upload(path, fileBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        return NextResponse.json(
          {
            error: 'Upload failed',
            message: uploadError.message,
            code: 'UPLOAD_FAILED'
          },
          { status: 500 }
        );
      }

      const {
        data: { publicUrl }
      } = serviceClient.storage.from(BUCKET).getPublicUrl(path);

      uploaded[target.key] = publicUrl;
    }

    const supabase = await createClient();

    // Debug: Check if user exists at all (without tenant filter)
    const { data: userCheck, error: checkError } = await supabase
      .from('users_extended')
      .select('id, tenant_id, display_name')
      .eq('id', params.userId)
      .single();

    console.log('[POST /api/supervisor/users/[userId]/image] User lookup', {
      userId: params.userId,
      userFound: !!userCheck,
      userTenantId: userCheck?.tenant_id,
      contextTenantId: context.tenantId,
      tenantMatch: userCheck?.tenant_id === context.tenantId,
      checkError: checkError?.message
    });

    const service = new UserManagementService(supabase);

    const updatedUser = await service.updateUserImages(context, params.userId, {
      primaryImageUrl: uploaded.primary_image_url,
      mediumImageUrl: uploaded.medium_url,
      thumbnailImageUrl: uploaded.thumbnail_url
    });

    if (!updatedUser) {
      console.error('[POST /api/supervisor/users/[userId]/image] User not found', {
        userId: params.userId,
        tenantId: context.tenantId,
        isSupervisor: context.isSupervisor,
        userExistsGlobally: !!userCheck,
        userTenantId: userCheck?.tenant_id
      });

      const message = userCheck && userCheck.tenant_id !== context.tenantId
        ? 'User belongs to a different organization'
        : 'User not found';

      return NextResponse.json(
        {
          error: 'Not found',
          message,
          code: 'RESOURCE_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      imageUrls: {
        primary: uploaded.primary_image_url,
        medium: uploaded.medium_url,
        thumbnail: uploaded.thumbnail_url
      }
    });
  } catch (error) {
    console.error('[POST /api/supervisor/users/[userId]/image] error', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process user images',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
