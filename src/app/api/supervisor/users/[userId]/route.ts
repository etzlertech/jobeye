/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/app/api/supervisor/users/[userId]/route.ts
 * phase: 2
 * domain: user-management
 * purpose: Supervisor user detail + update API endpoints
 * spec_ref: docs/PLAN-USER-MANAGEMENT-WITH-IMAGES.md#phase-2-backend-api-routes-day-1-afternoon
 * complexity_budget: 220
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/auth/context';
import { createServiceClient } from '@/lib/supabase/server';
import { UserManagementService } from '@/domains/user-management/services/user.service';
import { AppError, ErrorCode } from '@/core/errors/error-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const updateSchema = z
  .object({
    display_name: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    role: z.string().optional(),
    timezone: z.string().optional(),
    preferred_language: z.string().optional(),
    is_active: z.boolean().optional()
  })
  .refine(
    (payload) => Object.keys(payload).length > 0,
    'At least one field must be provided'
  );

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const context = await getRequestContext(request);
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can access user management',
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();
    const service = new UserManagementService(supabase);
    const user = await service.getUser(context, params.userId);

    if (!user) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: 'User not found',
          code: 'RESOURCE_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const context = await getRequestContext(request);

    console.log('[PATCH /api/supervisor/users/[userId]] Request received', {
      userId: params.userId,
      tenantId: context.tenantId,
      isSupervisor: context.isSupervisor,
      roles: context.roles,
      source: context.source
    });

    if (!context.isSupervisor) {
      console.log('[PATCH /api/supervisor/users/[userId]] Access denied - not supervisor');
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can modify users',
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    const payload = await request.json();
    console.log('[PATCH /api/supervisor/users/[userId]] Payload received', {
      keys: Object.keys(payload),
      payload
    });

    const parsed = updateSchema.safeParse(payload);
    if (!parsed.success) {
      console.log('[PATCH /api/supervisor/users/[userId]] Validation failed', {
        error: parsed.error.flatten()
      });
      return NextResponse.json(
        {
          error: 'Invalid payload',
          details: parsed.error.flatten(),
          code: 'INVALID_INPUT'
        },
        { status: 400 }
      );
    }

    // Debug: Check if user exists at all (without tenant filter)
    const supabase = createServiceClient();
    const { data: userCheck, error: checkError } = await supabase
      .from('users_extended')
      .select('id, tenant_id, display_name, role')
      .eq('id', params.userId)
      .single();

    console.log('[PATCH /api/supervisor/users/[userId]] User lookup', {
      userId: params.userId,
      userFound: !!userCheck,
      userTenantId: userCheck?.tenant_id,
      contextTenantId: context.tenantId,
      tenantMatch: userCheck?.tenant_id === context.tenantId,
      userRole: userCheck?.role,
      checkError: checkError?.message
    });

    const service = new UserManagementService(supabase);
    const user = await service.updateUser(context, params.userId, parsed.data);

    if (!user) {
      const message = userCheck && userCheck.tenant_id !== context.tenantId
        ? 'User belongs to a different organization'
        : 'User not found or does not belong to your organization';

      console.log('[PATCH /api/supervisor/users/[userId]] Update failed', {
        userId: params.userId,
        reason: message
      });

      return NextResponse.json(
        {
          error: 'Not found',
          message,
          code: 'RESOURCE_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    console.log('[PATCH /api/supervisor/users/[userId]] Update successful', {
      userId: params.userId,
      updatedFields: Object.keys(parsed.data)
    });

    return NextResponse.json({
      success: true,
      user
    });
  } catch (error) {
    return mapError(error);
  }
}

function mapError(error: unknown) {
  console.error('[api/supervisor/users/[userId]] error', error);

  if (error instanceof AppError) {
    const status =
      error.code === ErrorCode.FORBIDDEN
        ? 403
        : error.code === ErrorCode.INVALID_INPUT
          ? 400
          : 500;

    return NextResponse.json(
      {
        error: 'User management error',
        message: error.message,
        code: ErrorCode[error.code] ?? 'UNKNOWN'
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR'
    },
    { status: 500 }
  );
}
