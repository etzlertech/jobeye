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
 * GET /api/system/tenants/[tenantId] - Get tenant details (system admin only)
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

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // Get tenant
    const tenant = await tenantService.getTenant(tenantId);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Error getting tenant:', error);
    return NextResponse.json(
      { error: 'Failed to get tenant' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/system/tenants/[tenantId] - Update tenant (system admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // For system admin, we'll use the repository directly instead of going through service
    const tenantRepo = (tenantService as any).tenantRepo;
    const tenant = await tenantRepo.update(tenantId, body);

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Error updating tenant:', error);
    return NextResponse.json(
      { error: 'Failed to update tenant' },
      { status: 500 }
    );
  }
}