/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/lib/auth/route-access.ts
 * phase: 3
 * domain: auth
 * purpose: Centralized configuration and helpers for role-based route access
 * spec_ref: docs/auth-routing.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: {
 *   states: ['public', 'protected', 'shared'],
 *   transitions: [
 *     'public->protected: requiresRole()',
 *     'protected->shared: inheritsRole()',
 *     'shared->protected: explicitRoleOnly()'
 *   ]
 * }
 * estimated_llm_cost: { "compute": "$0.00" }
 * offline_capability: NONE
 * dependencies: {
 *   internal: [],
 *   external: [],
 *   supabase: []
 * }
 * exports: ['routeAccessConfig', 'isPublicRoute', 'checkRouteAccess', 'canAccessRoute', 'getDashboardUrl', 'ROLE_HIERARCHY', 'listProtectedPrefixes']
 * voice_considerations: NONE
 * test_requirements: {
 *   coverage: 0,
 *   unit_tests: 'tests/middleware/auth-routing.test.ts'
 * }
 * tasks: [
 *   'Define canonical route access matrix',
 *   'Expose helper utilities for middleware and UI guards',
 *   'Provide strict typing to prevent drift between config and usage'
 * ]
 */

export type UserRole = 'admin' | 'supervisor' | 'crew';

export type RouteAccessMatrix = {
  public: string[];
  protected: Record<UserRole, string[]>;
  shared: Record<string, string[]>;
  apiProtected: string[];
};

export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  admin: ['admin'],
  supervisor: ['admin', 'supervisor'],
  crew: ['admin', 'supervisor', 'crew']
};

export const routeAccessConfig: RouteAccessMatrix = {
  public: [
    '/',
    '/sign-in',
    '/simple-signin',
    '/sign-up',
    '/reset-password',
    '/demo-crud',
    '/mobile',
    '/mobile/loading-complete',
    '/api/health',
    '/api/webhook',
    '/api/debug/auth',
    '/api/test-crud',
    '/api/demo-crud'
  ],
  protected: {
    admin: ['/admin', '/control-tower', '/control-tower/', '/vision/admin'],
    supervisor: [
      '/supervisor',
      '/supervisor/dashboard',
      '/supervisor/customers',
      '/supervisor/properties',
      '/supervisor/jobs',
      '/supervisor/inventory',
      '/jobs',
      '/jobs/',
      '/crew/job-load',
      '/crew/jobs',
      '/crew/load-verify',
      '/mobile/equipment-verification',
      '/mobile/job-load-checklist-start'
    ],
    crew: [
      '/crew',
      '/crew/jobs',
      '/crew/job-load',
      '/crew/load-verify',
      '/mobile/equipment-verification',
      '/mobile/job-load-checklist-start',
      '/mobile/loading-complete'
    ]
  },
  shared: {
    'admin,supervisor': ['/reports', '/analytics'],
    'supervisor,crew': ['/equipment', '/profile']
  },
  apiProtected: ['/api/admin', '/api/supervisor', '/api/crew', '/api/intent', '/api/inventory', '/api/scheduling', '/api/vision']
};

const withWildcard = (value: string) => (value.endsWith('*') ? value : `${value}*`);

const matchesRoute = (pathname: string, route: string) => {
  if (route === '/') {
    return pathname === '/';
  }
  if (route.endsWith('*')) {
    return pathname.startsWith(route.slice(0, -1));
  }
  if (route.endsWith('/') && pathname.startsWith(route)) {
    return true;
  }
  return pathname === route || pathname.startsWith(`${route}/`);
};

export function isPublicRoute(pathname: string): boolean {
  return routeAccessConfig.public.some(route => matchesRoute(pathname, route));
}

export function checkRouteAccess(pathname: string, userRole: UserRole): {
  allowed: boolean;
  reason?: string;
} {
  let deniedReason: string | undefined;

  for (const [role, routes] of Object.entries(routeAccessConfig.protected)) {
    if (routes.some(route => matchesRoute(pathname, route))) {
      const allowedRoles = ROLE_HIERARCHY[role as UserRole] || [];
      if (allowedRoles.includes(userRole)) {
        return { allowed: true };
      }
      deniedReason = `Role ${userRole} cannot access ${role} routes`;
    }
  }

  for (const [roles, routes] of Object.entries(routeAccessConfig.shared)) {
    if (routes.some(route => matchesRoute(pathname, route))) {
      const allowed = roles.split(',');
      if (allowed.includes(userRole)) {
        return { allowed: true };
      }
      deniedReason = `Role ${userRole} not in shared access list ${roles}`;
    }
  }

  if (pathname.startsWith('/api/')) {
    const protectedPrefix = routeAccessConfig.apiProtected.find(apiRoute => pathname.startsWith(apiRoute));
    if (!protectedPrefix) {
      return { allowed: true };
    }

    const apiRole = protectedPrefix.split('/')[2] as UserRole | undefined;
    if (!apiRole || !ROLE_HIERARCHY[apiRole]) {
      return { allowed: true };
    }

    const allowedRoles = ROLE_HIERARCHY[apiRole];
    if (allowedRoles.includes(userRole)) {
      return { allowed: true };
    }

    deniedReason = `Role ${userRole} cannot access ${protectedPrefix}`;
  }

  return { allowed: false, reason: deniedReason ?? 'Route not found in access control list' };
}

export function canAccessRoute(pathname: string, userRole: UserRole): boolean {
  if (isPublicRoute(pathname)) {
    return true;
  }
  return checkRouteAccess(pathname, userRole).allowed;
}

export function getDashboardUrl(role: string): string {
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

export function listProtectedPrefixes(): string[] {
  const protectedRoutes = Object.values(routeAccessConfig.protected).flat();
  const sharedRoutes = Object.values(routeAccessConfig.shared).flat();
  const apiRoutes = routeAccessConfig.apiProtected.map(withWildcard);
  return Array.from(new Set([...protectedRoutes, ...sharedRoutes, ...apiRoutes]));
}

