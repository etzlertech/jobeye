/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/app/api/supervisor/users/route.ts
 * phase: 2
 * domain: user-management
 * purpose: Supervisor user list API with profile image metadata
 * spec_ref: docs/PLAN-USER-MANAGEMENT-WITH-IMAGES.md#phase-2-backend-api-routes-day-1-afternoon
 * complexity_budget: 180
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { UserManagementService } from '@/domains/user-management/services/user.service';
import { AppError, ErrorCode } from '@/core/errors/error-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({
  role: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  search: z.string().optional(),
  limit: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .pipe(z.number().int().positive())
    .optional(),
  offset: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .pipe(z.number().int().nonnegative())
    .optional()
});

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parsed.error.flatten(),
          code: 'INVALID_INPUT'
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const service = new UserManagementService(supabase);

    const filters = {
      role: parsed.data.role as any,
      status: parsed.data.status ?? 'all',
      search: parsed.data.search,
      limit: parsed.data.limit ?? 20,
      offset: parsed.data.offset ?? 0
    };

    const result = await service.listUsers(context, filters);

    return NextResponse.json({
      success: true,
      users: result.users,
      total: result.total,
      hasMore: result.hasMore,
      limit: result.limit,
      offset: result.offset
    });
  } catch (error) {
    console.error('[GET /api/supervisor/users] Unexpected error', error);

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
}
