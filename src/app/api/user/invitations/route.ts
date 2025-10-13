import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TenantInvitationRepository } from '@/domains/tenant';

/**
 * GET /api/user/invitations - Get invitations for current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);
    
    // Handle header fallback - no invitations in header mode
    if (context.source === 'header') {
      return NextResponse.json({ invitations: [] });
    }
    
    if (!context.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Initialize repository
    const supabase = await createClient();
    const invitationRepo = new TenantInvitationRepository(supabase);

    // Get pending invitations for user's email
    const invitations = await invitationRepo.findByEmail(
      context.user.email,
      'pending' as any
    );

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error listing invitations:', error);
    return NextResponse.json(
      { error: 'Failed to list invitations' },
      { status: 500 }
    );
  }
}