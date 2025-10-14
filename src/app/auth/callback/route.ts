/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/auth/callback/route.ts
 * phase: 3
 * domain: auth
 * purpose: Sync Supabase session cookies after client-side auth state changes
 * spec_ref: 007-mvp-intent-driven/contracts/auth.md
 * complexity_budget: 150
 * dependencies: {
 *   internal: [],
 *   external: ['next/server', '@supabase/auth-helpers-nextjs'],
 *   supabase: ['auth']
 * }
 * exports: ['POST']
 * voice_considerations: N/A
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'src/__tests__/auth/api/auth-callback.test.ts'
 * }
 * tasks: [
 *   'Accept auth state payload from client',
 *   'Persist Supabase session cookies on sign-in/refresh',
 *   'Clear session cookies on sign-out',
 *   'Support optional redirect parameter'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { Session } from '@supabase/supabase-js';

interface AuthCallbackPayload {
  event?: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';
  session?: Session;
  redirectTo?: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as AuthCallbackPayload;
    const { event, session, redirectTo } = payload;

    if (!event) {
      return NextResponse.json(
        { error: 'Missing auth event' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    switch (event) {
      case 'SIGNED_IN':
      case 'TOKEN_REFRESHED': {
        if (!session) {
          return NextResponse.json(
            { error: 'Missing session for auth callback' },
            { status: 400 }
          );
        }

        const { error } = await supabase.auth.setSession(session);
        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }
        break;
      }

      case 'SIGNED_OUT': {
        const { error } = await supabase.auth.signOut();
        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Unsupported auth event' },
          { status: 400 }
        );
    }

    if (redirectTo) {
      const redirectUrl = new URL(redirectTo, request.nextUrl.origin);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth callback failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
