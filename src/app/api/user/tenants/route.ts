import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TenantService } from '@/domains/tenant';

/**
 * GET /api/user/tenants - List user's tenants
 */
export async function GET(request: NextRequest) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);
    
    if (!context.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // Get user's tenants
    const tenants = await tenantService.getUserTenants(context.userId);

    return NextResponse.json({
      tenants,
      currentTenantId: context.tenantId
    });
  } catch (error) {
    console.error('Error listing user tenants:', error);
    return NextResponse.json(
      { error: 'Failed to list tenants' },
      { status: 500 }
    );
  }
}