/*
AGENT DIRECTIVE BLOCK
file: /src/lib/auth/role-routing.ts
phase: 1
domain: authentication
purpose: Provide consistent mapping from user roles to dashboard routes
spec_ref: auth-routing-simplification
complexity_budget: 40
dependencies: {}
voice_considerations:
  - Voice assistants should reuse dashboard routing logic
*/

const ROLE_ROUTE_MAP = {
  admin: '/admin',
  supervisor: '/supervisor',
  crew: '/crew',
} as const;

type RoleKey = keyof typeof ROLE_ROUTE_MAP;

export function resolveDashboardRoute(role?: string): string {
  if (!role) {
    return ROLE_ROUTE_MAP.crew;
  }

  const normalized = role.toLowerCase().trim();

  if (Object.prototype.hasOwnProperty.call(ROLE_ROUTE_MAP, normalized)) {
    return ROLE_ROUTE_MAP[normalized as RoleKey];
  }

  return ROLE_ROUTE_MAP.crew;
}

export function isKnownRole(role?: string): role is RoleKey {
  if (!role) {
    return false;
  }

  const normalized = role.toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(ROLE_ROUTE_MAP, normalized);
}

export { ROLE_ROUTE_MAP };
