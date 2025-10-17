/**
 * GET /api/users
 * Fetch users filtered by role
 *
 * @feature 010-job-assignment-and
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // CRITICAL: Get request context first
    const context = await getRequestContext(request);

    // Only supervisors can list users
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can list users',
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    // Use service role client to bypass RLS for supervisor queries
    // The supervisor permission check was already done above via context.isSupervisor
    const {createClient: createServiceClient} = await import('@supabase/supabase-js');
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role');

    // Build query for users_extended
    let query = supabase
      .from('users_extended')
      .select('id, display_name, role')
      .eq('tenant_id', context.tenantId);

    // Apply role filter if provided
    if (roleFilter) {
      query = query.eq('role', roleFilter);
    }

    const { data: usersData, error } = await query.order('display_name', { ascending: true });

    if (error) {
      throw error;
    }

    // Now fetch emails for these users from auth.users
    // We can reuse the service role client from above
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();

    // Map emails to user IDs
    const emailMap = new Map(
      authUsers?.map(u => [u.id, u.email]) || []
    );

    // Combine the data
    const data = usersData?.map(u => ({
      id: u.id,
      email: emailMap.get(u.id) || '',
      full_name: u.display_name || emailMap.get(u.id) || '',
      role: u.role
    }));

    console.log('[GET /api/users] Returning data:', {
      roleFilter,
      tenantId: context.tenantId,
      usersDataCount: usersData?.length || 0,
      authUsersCount: authUsers?.length || 0,
      resultCount: data?.length || 0,
      sampleData: data?.slice(0, 2)
    });

    return NextResponse.json(
      {
        users: data || [],
        count: data?.length || 0
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[GET /api/users] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to fetch users',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
