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

// Route configurations
const ROUTE_CONFIG = {
  // Public routes (no auth required)
  public: [
    '/',
    '/sign-in',
    '/sign-up', 
    '/reset-password',
    '/api/health',
    '/api/webhook'
  ],

  // Role-based protected routes
  protected: {
    admin: [
      '/admin'
    ],
    supervisor: [
      '/supervisor',
      '/supervisor/inventory', 
      '/supervisor/jobs',
      '/supervisor/dashboard',
      '/supervisor/customers',
      '/supervisor/properties'
    ],
    crew: [
      '/crew',
      '/crew/jobs',
      '/crew/load-verify',
      '/crew/maintenance'
    ]
  },

  // API routes that require authentication
  apiProtected: [
    '/api/crew',
    '/api/supervisor', 
    '/api/intent',
    '/api/admin'
  ],

  // Shared routes accessible by multiple roles
  shared: {
    // Routes accessible by both supervisor and crew
    'supervisor,crew': [
      '/jobs', // Generic job routes
      '/equipment',
      '/profile',
      '/crew/load-verify', // Supervisors need access to load verification
      '/crew/job-load', // Supervisors can view job loads
      '/crew/jobs' // Supervisors can view crew job pages
    ],
    // Routes accessible by admin and supervisor  
    'admin,supervisor': [
      '/reports',
      '/analytics'
    ]
  }
};

// Role hierarchy for access control
const ROLE_HIERARCHY = {
  admin: ['admin', 'supervisor', 'crew'],
  supervisor: ['supervisor', 'crew'], 
  crew: ['crew']
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
    const supabase = createMiddlewareClient({ req: request, res });

    // Check if route is public
    if (isPublicRoute(pathname)) {
      return res;
    }

    // Check for demo mode first
    const demoRole = request.cookies.get('demoRole')?.value;
    const isDemo = request.cookies.get('isDemo')?.value === 'true';

    let userRole: string;
    let userId: string;
    let session: any = null;

    if (isDemo && demoRole) {
      // Demo mode - bypass authentication
      userRole = demoRole;
      userId = `demo-${demoRole}-user`;
    } else {
      // Normal authentication flow
      const { data: { session: authSession }, error } = await supabase.auth.getSession();

      if (error || !authSession) {
        // Redirect to sign-in for protected routes
        const signInUrl = new URL('/sign-in', request.url);
        signInUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(signInUrl);
      }

      session = authSession;
      // Check both app_metadata and user_metadata for role (demo users use user_metadata)
      userRole = (session.user.app_metadata?.role || session.user.user_metadata?.role) as string;
      userId = session.user.id;
    }

    if (!userRole) {
      // User has no role assigned - redirect to sign-in
      const signInUrl = new URL('/sign-in', request.url);
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

    // Add user context to headers for API routes
    if (pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', userId);
      requestHeaders.set('x-user-role', userRole);
      requestHeaders.set('x-tenant-id', session?.user?.app_metadata?.company_id || 'demo-company');
      requestHeaders.set('x-is-demo', isDemo ? 'true' : 'false');
      
      return NextResponse.next({
        request: {
          headers: requestHeaders
        }
      });
    }

    // Handle root redirect based on role
    if (pathname === '/') {
      const dashboardUrl = getDashboardUrl(userRole);
      return NextResponse.redirect(new URL(dashboardUrl, request.url));
    }

    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // On error, redirect to sign-in
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('error', 'middleware_error');
    return NextResponse.redirect(signInUrl);
  }
}

/**
 * Check if a route is public (no auth required)
 */
function isPublicRoute(pathname: string): boolean {
  return ROUTE_CONFIG.public.some(route => {
    if (route === pathname) return true;
    if (route.endsWith('*')) {
      return pathname.startsWith(route.slice(0, -1));
    }
    return false;
  });
}

/**
 * Check if user has access to a specific route
 */
function checkRouteAccess(pathname: string, userRole: string): { 
  allowed: boolean; 
  reason?: string; 
} {
  // Check exact role-based routes
  for (const [role, routes] of Object.entries(ROUTE_CONFIG.protected)) {
    if (routes.some(route => pathname.startsWith(route))) {
      // Check if user's role hierarchy includes required role
      const allowedRoles = ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || [];
      if (allowedRoles.includes(userRole)) {
        return { allowed: true };
      } else {
        return { 
          allowed: false, 
          reason: `Role ${userRole} cannot access ${role} routes` 
        };
      }
    }
  }

  // Check shared routes
  for (const [allowedRoles, routes] of Object.entries(ROUTE_CONFIG.shared)) {
    if (routes.some(route => pathname.startsWith(route))) {
      const roles = allowedRoles.split(',');
      if (roles.includes(userRole)) {
        return { allowed: true };
      }
    }
  }

  // Check API routes
  if (pathname.startsWith('/api/')) {
    const isProtectedApi = ROUTE_CONFIG.apiProtected.some(route => 
      pathname.startsWith(route)
    );
    
    if (isProtectedApi) {
      // Extract role from API path
      const pathParts = pathname.split('/');
      const apiRole = pathParts[2]; // /api/[role]/...
      
      if (apiRole && ROUTE_CONFIG.protected[apiRole as keyof typeof ROUTE_CONFIG.protected]) {
        const allowedRoles = ROLE_HIERARCHY[apiRole as keyof typeof ROLE_HIERARCHY] || [];
        if (allowedRoles.includes(userRole)) {
          return { allowed: true };
        } else {
          return { 
            allowed: false, 
            reason: `Role ${userRole} cannot access ${apiRole} API` 
          };
        }
      }
    }
    
    // Allow access to non-protected API routes
    return { allowed: true };
  }

  // Default deny for unmatched protected routes
  return { 
    allowed: false, 
    reason: 'Route not found in access control list' 
  };
}

/**
 * Get appropriate dashboard URL for user role
 */
function getDashboardUrl(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'supervisor':
      return '/supervisor';
    case 'crew':
      return '/crew';
    default:
      return '/sign-in';
  }
}

/**
 * Extract role from API pathname
 */
function extractApiRole(pathname: string): string | null {
  const match = pathname.match(/^\/api\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * Check if user can access API endpoint based on role
 */
function canAccessApiEndpoint(pathname: string, userRole: string): boolean {
  const apiRole = extractApiRole(pathname);
  
  if (!apiRole) {
    return true; // Allow access to non-role-specific APIs
  }

  // Check if user's role can access this API
  const allowedRoles = ROLE_HIERARCHY[apiRole as keyof typeof ROLE_HIERARCHY];
  return allowedRoles ? allowedRoles.includes(userRole) : false;
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
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};