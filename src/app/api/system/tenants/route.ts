import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext, isSystemAdmin } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TenantService } from '@/domains/tenant';

/**
 * GET /api/system/tenants - List all tenants (system admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);
    
    if (!isSystemAdmin(context)) {
      return NextResponse.json(
        { error: 'Unauthorized: System admin required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // List tenants
    const result = await tenantService.listTenants({
      status,
      limit,
      offset
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing tenants:', error);
    return NextResponse.json(
      { error: 'Failed to list tenants' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/system/tenants - Create new tenant (system admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);
    
    if (!isSystemAdmin(context)) {
      return NextResponse.json(
        { error: 'Unauthorized: System admin required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, slug, plan, adminEmail, settings } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // Create tenant
    const result = await tenantService.createTenant(
      {
        name,
        slug,
        plan,
        adminEmail,
        settings
      },
      context.userId!
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error creating tenant:', error);
    
    // Handle specific errors
    if (error.message?.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create tenant' },
      { status: 500 }
    );
  }
}