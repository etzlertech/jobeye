import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext, isTenantAdmin } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TenantService } from '@/domains/tenant';

/**
 * GET /api/tenant/invitations - List pending invitations (tenant admin only)
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
    const status = searchParams.get('status') as any || 'pending';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // List invitations
    const result = await tenantService.listInvitations(context.tenantId, {
      status,
      limit,
      offset
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing invitations:', error);
    return NextResponse.json(
      { error: 'Failed to list invitations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenant/invitations - Create invitation (tenant admin only)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { email, role, expiresIn } = body;

    // Validate required fields
    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      );
    }

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // Create invitation
    const invitation = await tenantService.createInvitation(
      context.tenantId,
      { email, role, expiresIn },
      context.userId!
    );

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating invitation:', error);
    
    if (error.message?.includes('already')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}