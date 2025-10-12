import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext, isTenantAdmin } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TenantService } from '@/domains/tenant';

/**
 * GET /api/tenant/members - List tenant members (tenant admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);
    
    if (!context.tenantId) {
      return NextResponse.json(
        { error: 'No tenant context' },
        { status: 400 }
      );
    }

    if (!isTenantAdmin(context)) {
      return NextResponse.json(
        { error: 'Unauthorized: Tenant admin required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as any;
    const role = searchParams.get('role') as any;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // List members
    const result = await tenantService.listMembers(context.tenantId, {
      status,
      role,
      limit,
      offset
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing members:', error);
    return NextResponse.json(
      { error: 'Failed to list members' },
      { status: 500 }
    );
  }
}