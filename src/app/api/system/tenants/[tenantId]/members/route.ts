import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext, isSystemAdmin } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TenantService } from '@/domains/tenant';

interface RouteParams {
  params: {
    tenantId: string;
  };
}

/**
 * GET /api/system/tenants/[tenantId]/members - List tenant members (system admin only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);
    
    if (!isSystemAdmin(context)) {
      return NextResponse.json(
        { error: 'Unauthorized: System admin required' },
        { status: 403 }
      );
    }

    const { tenantId } = params;

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
    const result = await tenantService.listMembers(tenantId, {
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

/**
 * POST /api/system/tenants/[tenantId]/members - Add member to tenant (system admin only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);
    
    if (!isSystemAdmin(context)) {
      return NextResponse.json(
        { error: 'Unauthorized: System admin required' },
        { status: 403 }
      );
    }

    const { tenantId } = params;
    const body = await request.json();
    const { userId, role } = body;

    // Validate required fields
    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId and role are required' },
        { status: 400 }
      );
    }

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // Add member
    const member = await tenantService.addMember(
      tenantId,
      { userId, role, status: 'active' },
      context.userId!
    );

    return NextResponse.json({ member }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding member:', error);
    
    if (error.message?.includes('already a member')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add member' },
      { status: 500 }
    );
  }
}