'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertCircle, Loader2 } from 'lucide-react';

interface TenantGuardProps {
  requiredRole?: 'tenant_admin' | 'system_admin';
  requireActive?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface TenantContext {
  tenants: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
  }>;
  currentTenantId?: string;
}

/**
 * TenantGuard - Protects UI components based on tenant role/status
 * Use this to conditionally render based on user's tenant permissions
 */
export default function TenantGuard({
  requiredRole,
  requireActive = true,
  fallback,
  children
}: TenantGuardProps) {
  const [context, setContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAuthorization();
  }, [requiredRole, requireActive]);

  const checkAuthorization = async () => {
    try {
      const response = await fetch('/api/user/tenants');
      if (!response.ok) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      const data: TenantContext = await response.json();
      setContext(data);

      // Check if user meets requirements
      const currentTenant = data.tenants.find(t => t.id === data.currentTenantId);
      
      if (!currentTenant) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Check status requirement
      if (requireActive && currentTenant.status !== 'active') {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Check role requirement
      if (requiredRole) {
        if (requiredRole === 'system_admin') {
          // This would need to check system roles from metadata
          // For now, we'll need a different endpoint
          setAuthorized(false);
        } else if (requiredRole === 'tenant_admin') {
          setAuthorized(currentTenant.role === 'tenant_admin');
        }
      } else {
        // No specific role required, just needs to be a member
        setAuthorized(true);
      }
    } catch (error) {
      console.error('Error checking authorization:', error);
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!authorized) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 p-3 bg-yellow-50 rounded-full">
          <Shield className="h-8 w-8 text-yellow-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          Access Restricted
        </h3>
        <p className="text-sm text-gray-600 max-w-sm">
          {requiredRole === 'tenant_admin' 
            ? 'You need tenant admin permissions to access this area.'
            : requiredRole === 'system_admin'
            ? 'This area is restricted to system administrators.'
            : 'You do not have permission to access this area.'}
        </p>
        {context?.currentTenantId && !context.tenants.find(t => t.id === context.currentTenantId) && (
          <div className="mt-4 flex items-center text-sm text-yellow-600">
            <AlertCircle className="h-4 w-4 mr-1" />
            No active tenant selected
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook version for programmatic access
 */
export function useTenantGuard(
  requiredRole?: 'tenant_admin' | 'system_admin',
  requireActive = true
) {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch('/api/user/tenants');
        if (!response.ok) {
          setAuthorized(false);
          return;
        }

        const data: TenantContext = await response.json();
        const currentTenant = data.tenants.find(t => t.id === data.currentTenantId);
        
        if (!currentTenant) {
          setAuthorized(false);
          return;
        }

        if (requireActive && currentTenant.status !== 'active') {
          setAuthorized(false);
          return;
        }

        if (requiredRole === 'tenant_admin') {
          setAuthorized(currentTenant.role === 'tenant_admin');
        } else {
          setAuthorized(true);
        }
      } catch (error) {
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [requiredRole, requireActive]);

  return { authorized, loading };
}