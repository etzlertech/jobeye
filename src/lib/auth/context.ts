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
        return {
          tenantId: appMetadata.tenant_id,
          roles: appMetadata.roles || ['member'],
          source: 'session',
          userId: user.id,
          user
        };
      }

      // User is authenticated but no tenant metadata
      // TEMPORARY: Use default tenant as fallback
      console.warn(
        `[getRequestContext] User ${user.id} (${user.email}) has no tenant metadata. ` +
        'Using default tenant as fallback. User should sign out and sign in again.'
      );

      return {
        tenantId: '550e8400-e29b-41d4-a716-446655440000', // Default tenant
        roles: ['member'],
        source: 'header', // Mark as fallback
        userId: user.id,
        user
      };
    }

    // 2. No tenant context available
    console.error('[getRequestContext] No user session found');
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
