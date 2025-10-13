/**
 * @file /src/app/tenant-admin/users/page.tsx
 * @phase 3.4.1
 * @domain tenant-admin
 * @purpose User management for tenant administrators
 * @spec_ref docs/admin-ui-specs.md#user-role-assignment-interface
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ADMIN_CARD_CLASSES, 
  ADMIN_CARD_ITEM_CLASSES,
  ADMIN_ROLE_COLORS,
  getRoleBadgeClass
} from '@/app/admin/_constants/admin-ui-constants';
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Shield,
  Clock,
  CheckCircle,
  MoreHorizontal,
  Edit2,
  UserCheck,
  UserX,
  Key
} from 'lucide-react';

interface TenantUser {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'supervisor' | 'crew';
  status: 'active' | 'inactive' | 'pending';
  invitedAt?: string;
  lastActiveAt?: string;
  jobsCompleted?: number;
}

interface InviteForm {
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'crew';
}

// Mock data
const MOCK_USERS: TenantUser[] = [
  {
    id: '1',
    email: 'sarah@greenworks.land',
    name: 'Sarah Johnson',
    role: 'admin',
    status: 'active',
    lastActiveAt: '2025-10-13T09:30:00Z',
    jobsCompleted: 0
  },
  {
    id: '2',
    email: 'mike@greenworks.land',
    name: 'Mike Torres',
    role: 'supervisor',
    status: 'active',
    lastActiveAt: '2025-10-13T14:22:00Z',
    jobsCompleted: 42
  },
  {
    id: '3',
    email: 'alex@greenworks.land',
    name: 'Alex Rivera',
    role: 'crew',
    status: 'active',
    lastActiveAt: '2025-10-13T08:15:00Z',
    jobsCompleted: 156
  },
  {
    id: '4',
    email: 'jamie.chen@greenworks.land',
    name: 'Jamie Chen',
    role: 'crew',
    status: 'pending',
    invitedAt: '2025-10-12T16:00:00Z'
  },
  {
    id: '5',
    email: 'robert.kim@greenworks.land',
    name: 'Robert Kim',
    role: 'crew',
    status: 'inactive',
    lastActiveAt: '2025-09-28T11:00:00Z',
    jobsCompleted: 89
  }
];

const ROLE_PERMISSIONS = {
  admin: [
    'Manage users and roles',
    'View all tenant data',
    'Configure integrations',
    'Approve/reject requests',
    'Access billing'
  ],
  supervisor: [
    'Create and assign jobs',
    'Manage crew schedules',
    'View reports',
    'Edit job details',
    'Track crew performance'
  ],
  crew: [
    'View assigned jobs',
    'Update job status',
    'Use voice commands',
    'Submit job photos',
    'Clock in/out'
  ]
};

export default function TenantUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'supervisor' | 'crew'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: '',
    name: '',
    role: 'crew'
  });

  const filteredUsers = useMemo(() => {
    return MOCK_USERS.filter(user => {
      const matchesSearch = searchQuery === '' ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [searchQuery, roleFilter, statusFilter]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleInviteUser = () => {
    // TODO: API call to invite user
    console.log('Inviting user:', inviteForm);
    setShowInviteModal(false);
    setInviteForm({ email: '', name: '', role: 'crew' });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleBulkRoleChange = (newRole: 'admin' | 'supervisor' | 'crew') => {
    // TODO: API call to update roles
    console.log('Changing roles for users:', selectedUsers, 'to:', newRole);
    setSelectedUsers([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">User Management</h2>
            <p className="text-sm text-slate-400">
              Manage your organization's users, roles, and permissions.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-200"
              onClick={() => setShowPermissionsModal(true)}
            >
              <Key className="mr-2 h-3.5 w-3.5" />
              View Permissions
            </Button>
            <Button
              size="sm"
              className="bg-blue-500 text-white hover:bg-blue-400"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus className="mr-2 h-3.5 w-3.5" />
              Invite User
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
                    placeholder="Search by name or email..."
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
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
                
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-200"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="crew">Crew</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <Card className="border border-blue-500/20 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-blue-300">
                  {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex gap-2">
                <select
                  onChange={(e) => handleBulkRoleChange(e.target.value as any)}
                  className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-200"
                  defaultValue=""
                >
                  <option value="" disabled>Change role to...</option>
                  <option value="admin">Admin</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="crew">Crew</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUsers([])}
                  className="text-slate-400"
                >
                  Clear selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                <div className="flex items-start gap-4">
                  {/* Selection checkbox */}
                  <div className="mt-1">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                    />
                  </div>

                  {/* User info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {user.name || 'Unnamed User'}
                        </h3>
                        <p className="text-sm text-slate-300">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadgeClass(user.role)}>
                          {user.role}
                        </Badge>
                        <Badge className={
                          user.status === 'active' ? 'bg-green-500/10 text-green-300' :
                          user.status === 'pending' ? 'bg-yellow-500/10 text-yellow-300' :
                          'bg-slate-600/20 text-slate-300'
                        }>
                          {user.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                      {user.status === 'pending' ? (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span>Invited {formatDate(user.invitedAt)}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Last active {formatDate(user.lastActiveAt)}</span>
                          </div>
                          {user.jobsCompleted !== undefined && user.jobsCompleted > 0 && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              <span>{user.jobsCompleted} jobs completed</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {user.status === 'pending' ? (
                      <Button variant="outline" size="sm" className="border-slate-700 text-slate-200">
                        <Mail className="w-3 h-3 mr-1" />
                        Resend
                      </Button>
                    ) : user.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-700 text-slate-200"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-green-500 text-white hover:bg-green-400"
                      >
                        <UserCheck className="w-3 h-3 mr-1" />
                        Reactivate
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                No users match the current filters.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">Invite New User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="border-slate-700 bg-slate-800 text-white"
                  placeholder="user@company.com"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Full Name
                </label>
                <Input
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="border-slate-700 bg-slate-800 text-white"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                >
                  <option value="admin">Admin</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="crew">Crew</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 border-slate-700 text-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInviteUser}
                  disabled={!inviteForm.email || !inviteForm.name}
                  className="flex-1 bg-blue-500 text-white hover:bg-blue-400"
                >
                  Send Invitation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Key className="w-5 h-5" />
                Role Permissions Matrix
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => (
                <div key={role}>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge className={getRoleBadgeClass(role as keyof typeof ADMIN_ROLE_COLORS)}>
                      {role}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {permissions.map((permission) => (
                      <div key={permission} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                        <span className="text-slate-300">{permission}</span>
                      </div>
                    ))}
                  </div>
                  {role !== 'crew' && <Separator className="mt-4 bg-slate-700" />}
                </div>
              ))}
              <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowPermissionsModal(false)}
                  className="border-slate-700 text-slate-200"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}