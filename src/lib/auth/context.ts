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
    
    if (user && !error) {
      // Check app_metadata for tenant info
      const appMetadata = user.app_metadata;
      
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
      console.warn(
        `User ${user.id} (${user.email}) has no tenant metadata. ` +
        'Run backfill-metadata script or use header fallback.'
      );
    }
    
    // 2. Fallback to header (with warning)
    const headerTenantId = request.headers.get('x-tenant-id');
    
    if (headerTenantId) {
      console.warn(
        `Using header fallback for tenant: ${headerTenantId}. ` +
        'This should only be used during migration. ' +
        `User: ${user?.email || 'anonymous'}`
      );
      
      return {
        tenantId: headerTenantId,
        roles: ['member'], // Conservative default for header-based access
        source: 'header',
        userId: user?.id,
        user
      };
    }
    
    // 3. No context available
    throw new Error(
      'No tenant context available. ' +
      'User must have tenant_id in JWT metadata or provide x-tenant-id header.'
    );
    
  } catch (error) {
    // Re-throw if it's our context error
    if (error instanceof Error && error.message.includes('No tenant context')) {
      throw error;
    }
    
    // Log and re-throw other errors
    console.error('Error resolving request context:', error);
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