/*
AGENT DIRECTIVE BLOCK
file: /src/lib/auth/with-auth.ts
phase: 1
domain: authentication
purpose: Server-side auth wrapper that enforces Supabase session and tenant context
spec_ref: auth-routing-simplification
complexity_budget: 120
dependencies:
  external:
    - next/headers
    - next/server
    - @supabase/auth-helpers-nextjs
  internal:
    - /src/types/database
voice_considerations:
  - Voice endpoints reuse this guard, so errors must be voice-friendly upstream
*/

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type AuthenticatedHandler = (
  user: User,
  tenantId: string
) => Promise<NextResponse>;

export async function withAuth(
  _req: NextRequest,
  handler: AuthenticatedHandler
): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => cookieStore
    });

    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error('[Auth] Failed to fetch session:', error);
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const user = session?.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant context missing for user' },
        { status: 403 }
      );
    }

    return await handler(user, tenantId);
  } catch (authError) {
    console.error('[Auth] Error resolving user session:', authError);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
