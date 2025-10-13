/**
 * @file /src/app/admin/users/page.tsx
 * @phase 3.3.2
 * @domain admin
 * @purpose Cross-tenant user management for system administrators
 * @spec_ref admin-ui-wireframes.md#phase-332--user-management
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  Search,
  Shield,
  Eye,
  AlertTriangle,
  Clock,
  MapPin,
  Smartphone
} from 'lucide-react';
import { 
  ADMIN_STATUS_COLORS, 
  ADMIN_ROLE_COLORS, 
  ADMIN_SECURITY_FLAG_COLORS,
  ADMIN_CARD_CLASSES, 
  ADMIN_CARD_ITEM_CLASSES,
  getStatusBadgeClass,
  getRoleBadgeClass,
  getSecurityFlagBadgeClass
} from '../_constants/admin-ui-constants';

interface AdminUserSummary {
  id: string;
  email: string;
  name: string | null;
  tenants: Array<{ tenantId: string; tenantName: string; role: string }>;
  status: 'active' | 'suspended' | 'pending';
  lastLoginAt: string | null;
  securityFlags: string[];
  metadata: {
    location?: string;
    deviceType?: string;
    lastIP?: string;
  };
}

interface AdminUserDetail extends AdminUserSummary {
  activity: Array<{ timestamp: string; action: string; context?: Record<string, any> }>;
  impersonationAllowed: boolean;
}

// Mock data based on contracts
const MOCK_USERS: AdminUserSummary[] = [
  {
    id: 'usr_01',
    email: 'sarah.johnson@greenworks.land',
    name: 'Sarah Johnson',
    tenants: [
      { tenantId: 'tnt_01', tenantName: 'GreenWorks Landscaping', role: 'tenant_admin' }
    ],
    status: 'active',
    lastLoginAt: '2025-10-13T09:30:00Z',
    securityFlags: [],
    metadata: {
      location: 'Seattle, WA',
      deviceType: 'mobile',
      lastIP: '192.168.1.45'
    }
  },
  {
    id: 'usr_02',
    email: 'mike.torres@precisionproperty.io',
    name: 'Mike Torres',
    tenants: [
      { tenantId: 'tnt_02', tenantName: 'Precision Property Services', role: 'supervisor' }
    ],
    status: 'pending',
    lastLoginAt: null,
    securityFlags: ['new_account'],
    metadata: {
      deviceType: 'desktop'
    }
  },
  {
    id: 'usr_03',
    email: 'jamie.chen@atlasproperty.co',
    name: 'Jamie Chen',
    tenants: [
      { tenantId: 'tnt_04', tenantName: 'Atlas Property Group', role: 'crew' }
    ],
    status: 'suspended',
    lastLoginAt: '2025-10-10T14:22:00Z',
    securityFlags: ['multiple_failed_logins', 'suspicious_activity'],
    metadata: {
      location: 'Portland, OR',
      deviceType: 'mobile',
      lastIP: '10.0.2.15'
    }
  },
  {
    id: 'usr_04',
    email: 'alex.rivera@greenworks.land',
    name: 'Alex Rivera',
    tenants: [
      { tenantId: 'tnt_01', tenantName: 'GreenWorks Landscaping', role: 'crew' }
    ],
    status: 'active',
    lastLoginAt: '2025-10-13T08:15:00Z',
    securityFlags: [],
    metadata: {
      location: 'Tacoma, WA',
      deviceType: 'mobile',
      lastIP: '192.168.1.67'
    }
  },
  {
    id: 'usr_05',
    email: 'admin@jobeye.com',
    name: 'System Administrator',
    tenants: [
      { tenantId: 'system', tenantName: 'System', role: 'system_admin' }
    ],
    status: 'active',
    lastLoginAt: '2025-10-13T12:00:00Z',
    securityFlags: ['system_admin'],
    metadata: {
      deviceType: 'desktop'
    }
  }
];

// Using shared constants from admin-ui-constants.ts

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'system_admin' | 'tenant_admin' | 'supervisor' | 'crew'>('all');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    return MOCK_USERS.filter(user => {
      const matchesSearch = searchQuery === '' || 
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.tenants.some(t => t.tenantName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      
      const matchesRole = roleFilter === 'all' || 
        user.tenants.some(t => t.role === roleFilter);
      
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [searchQuery, statusFilter, roleFilter]);

  const formatLastLogin = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleImpersonate = (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to impersonate ${userName}? This action will be logged for audit purposes.`)) {
      // TODO: Implement impersonation logic
      alert('Impersonation feature will be implemented with real authentication');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">User Management</h2>
            <p className="text-sm text-slate-400">
              Cross-tenant user administration, security monitoring, and support tools.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-200">
              <Shield className="mr-2 h-3.5 w-3.5" />
              Security Report
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className={ADMIN_CARD_CLASSES}>
          <CardContent className="py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by email, name, or tenant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-200"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </select>
                
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-200"
                >
                  <option value="all">All Roles</option>
                  <option value="system_admin">System Admin</option>
                  <option value="tenant_admin">Tenant Admin</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="crew">Crew</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Users List */}
      <section>
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="w-5 h-5" />
              Users ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={ADMIN_CARD_ITEM_CLASSES}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* User Info */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-white">
                        {user.name || 'Unnamed User'}
                      </h3>
                      <Badge className={getStatusBadgeClass(user.status)}>
                        {user.status.toUpperCase()}
                      </Badge>
                      {user.securityFlags.length > 0 && (
                        <div className="flex gap-1">
                          {user.securityFlags.map((flag) => (
                            <Badge key={flag} className={getSecurityFlagBadgeClass(flag as keyof typeof ADMIN_SECURITY_FLAG_COLORS)} variant="outline">
                              {flag.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-slate-300">{user.email}</p>
                    
                    {/* Tenant Roles */}
                    <div className="flex flex-wrap gap-2">
                      {user.tenants.map((tenant) => (
                        <div key={tenant.tenantId} className="flex items-center gap-2 text-xs">
                          <Badge className={getRoleBadgeClass(tenant.role as keyof typeof ADMIN_ROLE_COLORS)}>
                            {tenant.role.replace('_', ' ')}
                          </Badge>
                          <span className="text-slate-400">at {tenant.tenantName}</span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Last login {formatLastLogin(user.lastLoginAt)}</span>
                      </div>
                      {user.metadata.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{user.metadata.location}</span>
                        </div>
                      )}
                      {user.metadata.deviceType && (
                        <div className="flex items-center gap-1">
                          <Smartphone className="w-3 h-3" />
                          <span>{user.metadata.deviceType}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 lg:items-end">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-slate-700 text-slate-200"
                        onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        {selectedUser === user.id ? 'Hide' : 'Details'}
                      </Button>
                      
                      {user.status === 'active' && !user.securityFlags.includes('system_admin') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-700 text-blue-300 hover:bg-blue-900/20"
                          onClick={() => handleImpersonate(user.id, user.name || user.email)}
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          Impersonate
                        </Button>
                      )}
                      
                      {user.status === 'suspended' ? (
                        <Button
                          size="sm"
                          className="bg-emerald-500 text-black hover:bg-emerald-400"
                        >
                          Reactivate
                        </Button>
                      ) : user.status === 'active' && !user.securityFlags.includes('system_admin') && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="bg-red-500/90 text-white hover:bg-red-500"
                        >
                          Suspend
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedUser === user.id && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-slate-300">Recent Activity</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {/* Mock activity data */}
                        <div className="text-xs text-slate-400 bg-slate-800/50 p-2 rounded">
                          <span className="text-slate-300">2 hours ago:</span> Logged in from {user.metadata.lastIP}
                        </div>
                        <div className="text-xs text-slate-400 bg-slate-800/50 p-2 rounded">
                          <span className="text-slate-300">1 day ago:</span> Updated profile information
                        </div>
                        <div className="text-xs text-slate-400 bg-slate-800/50 p-2 rounded">
                          <span className="text-slate-300">3 days ago:</span> Created new job in {user.tenants[0]?.tenantName}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                No users match the current search and filter criteria.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}