/**
 * Request context helpers for tenant and role resolution
 * Provides a unified way to get tenant context from session or header fallback
 */

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export interface RequestContext {
  tenantId: string;
  roles: string[];
  source: 'session' | 'header';
  userId?: string;
  user?: User;
  // NEW: Role helpers for Job Assignment feature (010-job-assignment-and)
  isCrew: boolean;       // role === 'crew' or role === 'technician'
  isSupervisor: boolean; // role === 'supervisor' or role === 'manager' or role === 'admin'
}

/**
 * Get request context from session or header fallback
 * 
 * Priority order:
 * 1. Session JWT app_metadata (preferred)
 * 2. x-tenant-id header (logs warning, for backwards compatibility)
 * 
 * @throws Error if no tenant context is available
 */
export async function getRequestContext(request: Request): Promise<RequestContext> {
  try {
    // 1. Try session first (preferred method)
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    console.log('[getRequestContext] Checking user session:', {
      hasUser: !!user,
      userEmail: user?.email,
      hasError: !!error,
      errorMessage: error?.message
    });

    if (user && !error) {
      // Check app_metadata for tenant info
      const appMetadata = user.app_metadata;

      console.log('[getRequestContext] User app_metadata:', {
        userId: user.id,
        email: user.email,
        hasTenantId: !!appMetadata?.tenant_id,
        hasRoles: !!appMetadata?.roles,
        metadata: appMetadata
      });

      if (appMetadata?.tenant_id) {
        const roles = appMetadata.roles || ['member'];
        const role = appMetadata.role || roles[0]; // Single role field for backward compat

        return {
          tenantId: appMetadata.tenant_id,
          roles,
          source: 'session',
          userId: user.id,
          user,
          // Compute role helpers based on app_metadata.role or roles array
          isCrew: role === 'crew' || role === 'technician' || roles.includes('crew') || roles.includes('technician'),
          isSupervisor: role === 'supervisor' || role === 'manager' || role === 'admin' ||
                        roles.includes('supervisor') || roles.includes('manager') || roles.includes('admin')
        };
      }

      // User is authenticated but no tenant metadata
      // Check for x-tenant-id header before falling back to default
      const headerTenant = request.headers.get('x-tenant-id');
      if (headerTenant) {
        console.warn(
          `[getRequestContext] User ${user.id} (${user.email}) has no tenant metadata. ` +
          `Using tenant from x-tenant-id header: ${headerTenant}`
        );

        return {
          tenantId: headerTenant,
          roles: ['member'],
          source: 'header',
          userId: user.id,
          user,
          isCrew: false,      // Fallback mode - cannot determine role
          isSupervisor: false // Fallback mode - cannot determine role
        };
      }

      // TEMPORARY: Use default tenant as ultimate fallback
      console.warn(
        `[getRequestContext] User ${user.id} (${user.email}) has no tenant metadata and no header. ` +
        'Using default tenant as fallback. User should sign out and sign in again.'
      );

      return {
        tenantId: '550e8400-e29b-41d4-a716-446655440000', // Default tenant
        roles: ['member'],
        source: 'header', // Mark as fallback
        userId: user.id,
        user,
        isCrew: false,      // Fallback mode - cannot determine role
        isSupervisor: false // Fallback mode - cannot determine role
      };
    }

    // 2. No user session - check for x-tenant-id header
    const headerTenant = request.headers.get('x-tenant-id');
    if (headerTenant) {
      console.warn('[getRequestContext] No user session, using x-tenant-id header:', headerTenant);

      return {
        tenantId: headerTenant,
        roles: ['member'],
        source: 'header',
        isCrew: false,      // No session - cannot determine role
        isSupervisor: false // No session - cannot determine role
      };
    }

    // 3. No tenant context available
    console.error('[getRequestContext] No user session and no tenant header found');
    throw new Error(
      'No tenant context available. ' +
      'User must be authenticated and have tenant_id in JWT metadata.'
    );

  } catch (error) {
    // Re-throw if it's our context error
    if (error instanceof Error && error.message.includes('No tenant context')) {
      throw error;
    }

    // Log and re-throw other errors
    console.error('[getRequestContext] Error resolving request context:', error);
    throw new Error('Failed to resolve request context');
  }
}

/**
 * Check if user has a specific role in their current tenant context
 */
export function hasRole(context: RequestContext, role: string): boolean {
  return context.roles.includes(role);
}

/**
 * Check if user is a system admin
 */
export function isSystemAdmin(context: RequestContext): boolean {
  return context.roles.includes('system_admin');
}

/**
 * Check if user is a tenant admin for their current tenant
 */
export function isTenantAdmin(context: RequestContext): boolean {
  return context.roles.includes('tenant_admin');
}

/**
 * Assert that user has required role, throw if not
 */
export function requireRole(context: RequestContext, role: string, action?: string): void {
  if (!hasRole(context, role)) {
    throw new Error(
      `Unauthorized: ${action || 'This action'} requires ${role} role. ` +
      `Current roles: ${context.roles.join(', ')}`
    );
  }
}

/**
 * Get context for use in client components (partial data only)
 * Note: This returns only safe-to-expose data, not full context
 */
export function getClientSafeContext(context: RequestContext) {
  return {
    tenantId: context.tenantId,
    roles: context.roles,
    source: context.source
  };
}

/**
 * Check if user is a crew member (technician)
 * NEW: Added for Job Assignment feature (010-job-assignment-and)
 */
export function isCrew(context: RequestContext): boolean {
  return context.isCrew;
}

/**
 * Check if user is a supervisor (manager, admin, or supervisor role)
 * NEW: Added for Job Assignment feature (010-job-assignment-and)
 */
export function isSupervisor(context: RequestContext): boolean {
  return context.isSupervisor;
}

/**
 * Assert that user is a crew member, throw if not
 */
export function requireCrew(context: RequestContext, action?: string): void {
  if (!context.isCrew) {
    throw new Error(
      `Unauthorized: ${action || 'This action'} requires crew member role. ` +
      `Current roles: ${context.roles.join(', ')}`
    );
  }
}

/**
 * Assert that user is a supervisor, throw if not
 */
export function requireSupervisor(context: RequestContext, action?: string): void {
  if (!context.isSupervisor) {
    throw new Error(
      `Unauthorized: ${action || 'This action'} requires supervisor role. ` +
      `Current roles: ${context.roles.join(', ')}`
    );
  }
}
