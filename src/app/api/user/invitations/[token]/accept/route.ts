import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TenantService } from '@/domains/tenant';

interface RouteParams {
  params: {
    token: string;
  };
}

/**
 * POST /api/user/invitations/[token]/accept - Accept invitation
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);
    
    if (!context.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { token } = params;

    // Initialize service
    const supabase = await createClient();
    const tenantService = new TenantService(supabase);

    // Accept invitation
    const member = await tenantService.acceptInvitation(token, context.userId);

    // Get tenant info
    const tenant = await tenantService.getTenant(member.tenantId);

    return NextResponse.json({
      success: true,
      tenant,
      member
    });
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    
    if (error.message?.includes('Invalid invitation')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error.message?.includes('expired')) {
      return NextResponse.json(
        { error: error.message },
        { status: 410 }
      );
    }

    if (error.message?.includes('Already a member')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}