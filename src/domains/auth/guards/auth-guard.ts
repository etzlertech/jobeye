// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/auth/guards/auth-guard.ts
// purpose: Next.js middleware and HOCs for route protection with RBAC, multi-tenant isolation, and voice session validation
// spec_ref: auth#guard
// version: 2025-08-1
// domain: authentication
// phase: 1
// complexity_budget: medium
// offline_capability: NONE
//
// dependencies:
//   - internal: ['src/domains/auth/types/auth-types.ts', 'src/domains/auth/utils/auth-helpers.ts', 'src/core/database/connection.ts']
//   - external: ['next/server', 'next', '@supabase/supabase-js']
//
// exports:
//   - withAuth - HOC for protecting React components and pages
//   - middleware - Next.js middleware function for route protection
//   - checkRoutePermission - Permission-based route access validation
//   - redirectToLogin - Redirect logic with return URL preservation
//   - validateTenantAccess - Multi-tenant route isolation enforcement
//   - checkVoiceSession - Voice session validation for voice-enabled routes
//   - AuthGuardProvider - React context provider for auth state
//   - useAuthGuard - Hook for accessing auth guard state
//   - withRoleAccess - HOC for role-based component access
//   - getServerAuthState - Server-side auth state retrieval
//
// voice_considerations: >
//   Voice routes should have extended session timeouts and different validation rules.
//   Voice session validation should handle device sleep/wake cycles gracefully.
//   Authentication failures should provide voice-friendly error messages and alternatives.
//
// security_considerations: >
//   All route protection must enforce Row Level Security policies for multi-tenant data isolation.
//   Session validation must be cryptographically secure and resistant to tampering.
//   Permission checks must use server-side validation and never rely on client-side state alone.
//   Tenant access validation must prevent cross-tenant data access through URL manipulation.
//   Voice session validation must include additional security checks for sensitive operations.
//
// performance_considerations: >
//   Middleware should cache permission checks to avoid repeated database queries.
//   Route protection should fail fast for unauthorized access to minimize server load.
//   Session validation should use efficient caching strategies for frequently accessed routes.
//   HOCs should minimize re-renders and only update when auth state actually changes.
//
// tasks:
//   1. [SETUP] Import Next.js middleware types, Supabase client, and auth utilities
//   2. [MIDDLEWARE] Create Next.js middleware function for server-side route protection
//   3. [PERMISSION] Implement checkRoutePermission with role and resource validation
//   4. [REDIRECT] Build redirectToLogin with return URL preservation and voice handling
//   5. [TENANT] Create validateTenantAccess for multi-tenant route isolation
//   6. [VOICE] Implement checkVoiceSession for voice-enabled route validation
//   7. [HOC] Build withAuth HOC for protecting React components and pages
//   8. [CONTEXT] Create React context provider for auth guard state management
//   9. [ROLE_HOC] Implement withRoleAccess HOC for role-based component rendering
//  10. [SERVER] Add getServerAuthState for server-side auth state retrieval
// --- END DIRECTIVE BLOCK ---

import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { ComponentType, createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Role, type UserProfile, type Session } from '../types/auth-types';
import { isSessionExpired, hasPermission, isVoiceSessionActive, sanitizeAuthError } from '../utils/auth-helpers';

// Auth Guard Context
interface AuthGuardState {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

const AuthGuardContext = createContext<AuthGuardState>({
  user: null,
  session: null,
  loading: true,
  error: null
});

// Route protection configuration
interface RouteConfig {
  requireAuth?: boolean;
  requiredRole?: Role;
  requiredPermissions?: Array<{ action: string; subject: string }>;
  allowedTenants?: string[];
  requireVoiceSession?: boolean;
  publicRoute?: boolean;
}

// Route patterns with their protection rules
const ROUTE_PATTERNS: Record<string, RouteConfig> = {
  '/': { publicRoute: true },
  '/login': { publicRoute: true },
  '/register': { publicRoute: true },
  '/forgot-password': { publicRoute: true },
  '/dashboard': { requireAuth: true },
  '/admin': { requireAuth: true, requiredRole: Role.ADMIN },
  '/manager': { requireAuth: true, requiredRole: Role.MANAGER },
  '/technician': { requireAuth: true, requiredRole: Role.TECHNICIAN },
  '/voice': { requireAuth: true, requireVoiceSession: true },
  '/api/admin': { requireAuth: true, requiredRole: Role.ADMIN },
  '/api/manager': { requireAuth: true, requiredRole: Role.MANAGER }
};

/**
 * Next.js middleware function for server-side route protection
 * Handles authentication, authorization, and tenant isolation
 */
export async function middleware(request: NextRequest) {
  try {
    const response = NextResponse.next();
    const supabase = createMiddlewareClient({ req: request, res: response });

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Auth middleware error:', error);
      return redirectToLogin(request, 'Session validation failed');
    }

    const pathname = request.nextUrl.pathname;
    const routeConfig = getRouteConfig(pathname);

    // Allow public routes
    if (routeConfig.publicRoute) {
      return response;
    }

    // Check authentication requirement
    if (routeConfig.requireAuth && (!session || isSessionExpired(session))) {
      return redirectToLogin(request, 'Authentication required');
    }

    // If we have a session, validate user and permissions
    if (session) {
      const { data: user } = await supabase
        .from('users')
        .select('*, profile:user_profiles(*)')
        .eq('id', session.user.id)
        .single();

      if (!user) {
        return redirectToLogin(request, 'User not found');
      }

      // Check role requirements
      if (routeConfig.requiredRole) {
        const hasRequiredRole = hasRoleOrHigher(user.role, routeConfig.requiredRole);
        if (!hasRequiredRole) {
          return new NextResponse('Forbidden: Insufficient permissions', { status: 403 });
        }
      }

      // Check specific permissions
      if (routeConfig.requiredPermissions) {
        const hasAllPermissions = routeConfig.requiredPermissions.every(perm =>
          hasPermission(user.role, perm.action, perm.subject)
        );
        if (!hasAllPermissions) {
          return new NextResponse('Forbidden: Missing required permissions', { status: 403 });
        }
      }

      // Validate tenant access
      const tenantValid = await validateTenantAccess(request, user);
      if (!tenantValid) {
        return new NextResponse('Forbidden: Tenant access denied', { status: 403 });
      }

      // Check voice session requirements
      if (routeConfig.requireVoiceSession) {
        const voiceSessionValid = await checkVoiceSession(request, session as Session);
        if (!voiceSessionValid) {
          return redirectToLogin(request, 'Voice session required');
        }
      }
    }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    return redirectToLogin(request, 'Authentication error');
  }
}

/**
 * Get route configuration based on pathname
 */
function getRouteConfig(pathname: string): RouteConfig {
  // Exact match first
  if (ROUTE_PATTERNS[pathname]) {
    return ROUTE_PATTERNS[pathname];
  }

  // Pattern matching for dynamic routes
  for (const [pattern, config] of Object.entries(ROUTE_PATTERNS)) {
    if (pathname.startsWith(pattern)) {
      return config;
    }
  }

  // Default: require authentication
  return { requireAuth: true };
}

/**
 * Check if user has required role or higher
 */
function hasRoleOrHigher(userRole: Role, requiredRole: Role): boolean {
  const roleHierarchy = {
    [Role.CUSTOMER]: 1,
    [Role.TECHNICIAN]: 2,
    [Role.MANAGER]: 3,
    [Role.ADMIN]: 4
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Redirect to login with return URL preservation
 */
export function redirectToLogin(request: NextRequest, reason?: string): NextResponse {
  const loginUrl = new URL('/login', request.url);
  
  // Preserve return URL for post-login redirect
  if (request.nextUrl.pathname !== '/login') {
    loginUrl.searchParams.set('returnUrl', request.nextUrl.pathname);
  }

  // Add error reason for display
  if (reason) {
    loginUrl.searchParams.set('error', reason);
  }

  return NextResponse.redirect(loginUrl);
}

/**
 * Validate tenant access for multi-tenant isolation
 */
export async function validateTenantAccess(request: NextRequest, user: UserProfile): Promise<boolean> {
  try {
    // Extract tenant from URL or user context
    const urlTenant = request.nextUrl.searchParams.get('tenant');
    const userTenant = user.active_tenant_id;

    // If URL specifies tenant, ensure user has access
    if (urlTenant && urlTenant !== userTenant) {
      // Check if user has access to multiple tenants (admin feature)
      if (user.role !== Role.ADMIN) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Tenant validation error:', error);
    return false;
  }
}

/**
 * Validate voice session for voice-enabled routes
 */
export async function checkVoiceSession(request: NextRequest, session: Session): Promise<boolean> {
  try {
    // Check if route requires voice session
    const isVoiceRoute = request.nextUrl.pathname.startsWith('/voice');
    if (!isVoiceRoute) return true;

    // Validate voice session is active
    return isVoiceSessionActive(session);
  } catch (error) {
    console.error('Voice session validation error:', error);
    return false;
  }
}

/**
 * Check route-specific permissions
 */
export async function checkRoutePermission(
  pathname: string,
  user: UserProfile,
  method: string = 'GET'
): Promise<boolean> {
  try {
    const routeConfig = getRouteConfig(pathname);

    // Check role requirements
    if (routeConfig.requiredRole) {
      if (!hasRoleOrHigher(user.role, routeConfig.requiredRole)) {
        return false;
      }
    }

    // Check specific permissions
    if (routeConfig.requiredPermissions) {
      return routeConfig.requiredPermissions.every(perm =>
        hasPermission(user.role, perm.action, perm.subject)
      );
    }

    return true;
  } catch (error) {
    console.error('Route permission check error:', error);
    return false;
  }
}

/**
 * Higher-Order Component for protecting pages and components
 */
export function withAuth<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: RouteConfig = { requireAuth: true }
) {
  return function AuthenticatedComponent(props: P) {
    const { user, session, loading, error } = useAuthGuard();

    // Show loading state
    if (loading) {
      return <div>Loading...</div>;
    }

    // Handle authentication errors
    if (error) {
      return <div>Error: {error}</div>;
    }

    // Check authentication requirement
    if (options.requireAuth && !user) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return <div>Redirecting to login...</div>;
    }

    // Check role requirements
    if (options.requiredRole && user) {
      if (!hasRoleOrHigher(user.role, options.requiredRole)) {
        return <div>Access denied: Insufficient permissions</div>;
      }
    }

    // Check voice session requirements
    if (options.requireVoiceSession && session) {
      if (!isVoiceSessionActive(session)) {
        return <div>Voice session expired. Please refresh.</div>;
      }
    }

    return <WrappedComponent {...props} />;
  };
}

/**
 * Higher-Order Component for role-based access control
 */
export function withRoleAccess<P extends object>(
  WrappedComponent: ComponentType<P>,
  allowedRoles: Role[]
) {
  return function RoleProtectedComponent(props: P) {
    const { user } = useAuthGuard();

    if (!user || !allowedRoles.includes(user.role)) {
      return <div>Access denied</div>;
    }

    return <WrappedComponent {...props} />;
  };
}

/**
 * Auth Guard Provider component
 */
export function AuthGuardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthGuardState>({
    user: null,
    session: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    // Initialize auth state
    // This would typically connect to your Supabase client
    // and listen for auth state changes
    setState(prev => ({ ...prev, loading: false }));
  }, []);

  return (
    <AuthGuardContext.Provider value={state}>
      {children}
    </AuthGuardContext.Provider>
  );
}

/**
 * Hook for accessing auth guard state
 */
export function useAuthGuard(): AuthGuardState {
  const context = useContext(AuthGuardContext);
  if (!context) {
    throw new Error('useAuthGuard must be used within AuthGuardProvider');
  }
  return context;
}

/**
 * Server-side auth state retrieval
 */
export async function getServerAuthState(request: NextRequest): Promise<{
  user: UserProfile | null;
  session: Session | null;
  error: string | null;
}> {
  try {
    const response = NextResponse.next();
    const supabase = createMiddlewareClient({ req: request, res: response });

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return { user: null, session: null, error: error?.message || 'No session' };
    }

    const { data: user } = await supabase
      .from('users')
      .select('*, profile:user_profiles(*)')
      .eq('id', session.user.id)
      .single();

    return {
      user: user as UserProfile,
      session: session as Session,
      error: null
    };
  } catch (error) {
    return {
      user: null,
      session: null,
      error: sanitizeAuthError(error).message
    };
  }
}

// Configure middleware matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};