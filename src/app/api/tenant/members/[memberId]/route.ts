import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext, isTenantAdmin } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TenantService, TenantMemberRepository } from '@/domains/tenant';

interface RouteParams {
  params: {
    memberId: string;
  };
}

/**
 * PATCH /api/tenant/members/[memberId] - Update member role/status (tenant admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { memberId } = params;
    const body = await request.json();

    // Initialize service and check member belongs to tenant
    const supabase = await createClient();
    const memberRepo = new TenantMemberRepository(supabase);
    
    const existingMember = await memberRepo.findById(memberId);
    if (!existingMember || existingMember.tenantId !== context.tenantId) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Prevent self-demotion
    if (existingMember.userId === context.userId && body.role && body.role !== existingMember.role) {
      return NextResponse.json(
        { error: 'Cannot modify own role' },
        { status: 403 }
      );
    }

    // Update member
    const tenantService = new TenantService(supabase);
    const member = await tenantService.updateMember(memberId, body, context.userId!);

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenant/members/[memberId] - Remove member from tenant (tenant admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { memberId } = params;

    // Initialize service and check member belongs to tenant
    const supabase = await createClient();
    const memberRepo = new TenantMemberRepository(supabase);
    
    const existingMember = await memberRepo.findById(memberId);
    if (!existingMember || existingMember.tenantId !== context.tenantId) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Prevent self-removal
    if (existingMember.userId === context.userId) {
      return NextResponse.json(
        { error: 'Cannot remove self' },
        { status: 403 }
      );
    }

    // Remove member
    const tenantService = new TenantService(supabase);
    await tenantService.removeMember(memberId, context.userId!);

    return NextResponse.json({ success: true }, { status: 204 });
  } catch (error: any) {
    console.error('Error removing member:', error);
    
    if (error.message?.includes('last tenant admin')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}