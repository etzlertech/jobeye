import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TenantService } from '@/domains/tenant';

/**
 * POST /api/user/tenants/switch - Switch active tenant
 */
export async function POST(request: NextRequest) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);
    
    if (!context.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // Switch tenant
    await tenantService.switchTenant(context.userId, tenantId);

    // Get tenant info for response
    const tenant = await tenantService.getTenant(tenantId);

    return NextResponse.json({
      success: true,
      tenant
    });
  } catch (error: any) {
    console.error('Error switching tenant:', error);
    
    if (error.message?.includes('Not an active member')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to switch tenant' },
      { status: 500 }
    );
  }
}