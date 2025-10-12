'use client';

import { useEffect, useState } from 'react';
import { Building2, ChevronDown, User, Shield, AlertCircle } from 'lucide-react';

interface TenantInfo {
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    status: string;
  }>;
  currentTenantId?: string;
}

/**
 * TenantBadge - Displays current tenant context and allows switching
 * Required on all pages per MEMORY.md tenant badge verification
 */
export default function TenantBadge() {
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchTenantInfo();
  }, []);

  const fetchTenantInfo = async () => {
    try {
      const response = await fetch('/api/user/tenants');
      if (!response.ok) {
        throw new Error('Failed to fetch tenant info');
      }
      const data = await response.json();
      setTenantInfo(data);
    } catch (err) {
      console.error('Error fetching tenant info:', err);
      setError('Failed to load tenant info');
    } finally {
      setLoading(false);
    }
  };

  const switchTenant = async (tenantId: string) => {
    try {
      const response = await fetch('/api/user/tenants/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to switch tenant');
      }

      // Refresh the page to reload with new context
      window.location.reload();
    } catch (err) {
      console.error('Error switching tenant:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
        <Building2 className="h-4 w-4 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    );
  }

  if (error || !tenantInfo) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-red-50 rounded-lg">
        <AlertCircle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-600">No tenant context</span>
      </div>
    );
  }

  const currentTenant = tenantInfo.tenants.find(
    t => t.id === tenantInfo.currentTenantId
  );

  if (!currentTenant) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-50 rounded-lg">
        <AlertCircle className="h-4 w-4 text-yellow-500" />
        <span className="text-sm text-yellow-600">No active tenant</span>
      </div>
    );
  }

  const roleIcon = currentTenant.role === 'tenant_admin' ? Shield : User;
  const RoleIcon = roleIcon;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Building2 className="h-4 w-4 text-gray-600" />
        <span className="text-sm font-medium">{currentTenant.name}</span>
        <span className="text-sm text-gray-500">•</span>
        <RoleIcon className="h-3 w-3 text-gray-600" />
        <span className="text-sm text-gray-600 capitalize">{currentTenant.role.replace('_', ' ')}</span>
        {tenantInfo.tenants.length > 1 && (
          <ChevronDown className="h-3 w-3 text-gray-400 ml-1" />
        )}
      </button>

      {showDropdown && tenantInfo.tenants.length > 1 && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-50">
          <div className="p-2">
            <div className="text-xs text-gray-500 px-2 py-1 uppercase tracking-wider">
              Switch Tenant
            </div>
            {tenantInfo.tenants.map(tenant => {
              const Icon = tenant.role === 'tenant_admin' ? Shield : User;
              const isActive = tenant.id === currentTenant.id;
              
              return (
                <button
                  key={tenant.id}
                  onClick={() => {
                    if (!isActive) {
                      switchTenant(tenant.id);
                    }
                    setShowDropdown(false);
                  }}
                  disabled={isActive}
                  className={`
                    w-full flex items-center justify-between px-2 py-2 rounded text-left
                    ${isActive 
                      ? 'bg-blue-50 text-blue-700 cursor-default' 
                      : 'hover:bg-gray-100'
                    }
                  `}
                >
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm font-medium">{tenant.name}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Icon className="h-3 w-3" />
                    <span className="text-xs capitalize">
                      {tenant.role.replace('_', ' ')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}