/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/middleware.ts
 * phase: 3
 * domain: auth
 * purpose: Next.js middleware for role-based routing and authentication
 * spec_ref: 007-mvp-intent-driven/contracts/auth-middleware.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: {
 *   states: ['unauthenticated', 'authenticated', 'role_verified', 'access_denied'],
 *   transitions: [
 *     'unauthenticated->authenticated: validToken()',
 *     'authenticated->role_verified: checkRole()',
 *     'authenticated->access_denied: invalidRole()',
 *     'role_verified->access_granted: allowAccess()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "middleware": "$0.00 (no AI operations)"
 * }
 * offline_capability: NONE
 * dependencies: {
 *   internal: ['@/lib/supabase/middleware'],
 *   external: ['next/server'],
 *   supabase: ['auth']
 * }
 * exports: ['middleware', 'config']
 * voice_considerations: N/A (server-side middleware)
 * test_requirements: {
 *   coverage: 95,
 *   unit_tests: 'tests/middleware/auth-routing.test.ts'
 * }
 * tasks: [
 *   'Implement authentication check',
 *   'Add role-based route protection',
 *   'Handle redirects for unauthorized access',
 *   'Support public routes and API endpoints'
 * ]
 */

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPublicRoute, checkRouteAccess, getDashboardUrl, type UserRole } from '@/lib/auth/route-access';
import type { Database } from '@/lib/supabase/types';

const normalizeUserRole = (role: unknown): UserRole | undefined => {
  const candidate = Array.isArray(role) ? role[0] : role;
  if (
    candidate === 'admin' ||
    candidate === 'supervisor' ||
    candidate === 'crew' ||
    candidate === 'tenant_admin'
  ) {
    return candidate;
  }
  return undefined;
};


export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    
    // Skip middleware for static files and Next.js internals
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.includes('.') // Skip files with extensions
    ) {
      return NextResponse.next();
    }

    // Create Supabase client
    const res = NextResponse.next();
    const supabase = createMiddlewareClient<Database>({ req: request, res });

    // Check if route is public
    if (isPublicRoute(pathname)) {
      return res;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
      const signInUrl = new URL('/', request.url);
      signInUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(signInUrl);
    }

    const roleSource =
      session.user.app_metadata?.role ??
      session.user.app_metadata?.roles ??
      session.user.user_metadata?.role ??
      session.user.user_metadata?.roles;
    const userRole = normalizeUserRole(roleSource);
    const userId = session.user.id;

    if (!userRole) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'no_role_assigned' }, { status: 403 });
      }
      const signInUrl = new URL('/', request.url);
      signInUrl.searchParams.set('error', 'no_role_assigned');
      return NextResponse.redirect(signInUrl);
    }

    // Check route access permissions
    const accessResult = checkRouteAccess(pathname, userRole);
    
    if (!accessResult.allowed) {
      // Access denied - redirect to appropriate dashboard
      const dashboardUrl = getDashboardUrl(userRole);
      const redirectUrl = new URL(dashboardUrl, request.url);
      redirectUrl.searchParams.set('error', 'access_denied');
      return NextResponse.redirect(redirectUrl);
    }

    const tenantId =
      (session.user.app_metadata?.tenant_id as string | undefined) ??
      (session.user.user_metadata?.tenant_id as string | undefined);

    if (!tenantId) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'missing_tenant' }, { status: 403 });
      }
      const signInUrl = new URL('/', request.url);
      signInUrl.searchParams.set('error', 'missing_tenant');
      return NextResponse.redirect(signInUrl);
    }

    // Add user context to headers for API routes
    if (pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', userId);
      requestHeaders.set('x-user-role', userRole);
      requestHeaders.set('x-tenant-id', tenantId);
      if (session?.user?.user_metadata) {
        requestHeaders.set('x-user-metadata', JSON.stringify(session.user.user_metadata));
      }
      const response = NextResponse.next({
        request: {
          headers: requestHeaders
        }
      });
      res.cookies.getAll().forEach(cookie => {
        response.cookies.set(cookie);
      });
      return response;
    }

    // Handle root redirect based on role
    if (pathname === '/') {
      const dashboardUrl = getDashboardUrl(userRole);
      return NextResponse.redirect(new URL(dashboardUrl, request.url));
    }

    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // On error, redirect to main page (simple-signin)
    const signInUrl = new URL('/', request.url);
    signInUrl.searchParams.set('error', 'middleware_error');
    return NextResponse.redirect(signInUrl);
  }
}


// Configure which paths should run this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - auth/callback (Supabase session sync)
     */
    '/((?!auth/callback|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
