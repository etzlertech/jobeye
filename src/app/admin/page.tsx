/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/admin/page.tsx
 * phase: 3
 * domain: admin
 * purpose: Super Admin dashboard for role management and system oversight
 * spec_ref: 007-mvp-intent-driven/contracts/admin-ui.md
 * complexity_budget: 350
 * migrations_touched: []
 * state_machine: {
 *   states: ['dashboard', 'role_management', 'user_editing', 'company_settings'],
 *   transitions: [
 *     'dashboard->role_management: manageRoles()',
 *     'role_management->user_editing: editUser()',
 *     'dashboard->company_settings: configureCompany()',
 *     'user_editing->role_management: saveUser()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "roleAnalysis": "$0.00 (no AI operations)"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: [
 *     '@/components/ui/ButtonLimiter',
 *     '@/components/voice/VoiceCommandButton'
 *   ],
 *   external: ['react', 'next/navigation'],
 *   supabase: ['users', 'companies', 'roles']
 * }
 * exports: ['default']
 * voice_considerations: Voice commands for admin operations
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/admin-role-management-flow.test.ts'
 * }
 * tasks: [
 *   'Create admin dashboard with system overview',
 *   'Implement user role management interface',
 *   'Add company configuration settings',
 *   'Create user creation and editing workflows'
 * ]
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Building,
  Shield,
  Settings,
  UserPlus,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle,
  Crown,
  Briefcase,
  Wrench,
  BarChart3,
  Clock,
  DollarSign
} from 'lucide-react';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';
import { VoiceCommandButton } from '@/components/voice/VoiceCommandButton';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'supervisor' | 'crew';
  companyId: string;
  companyName: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending';
  crewId?: string;
  jobsCompleted?: number;
}

interface Company {
  id: string;
  name: string;
  userCount: number;
  activeJobs: number;
  monthlySpend: number;
  status: 'active' | 'trial' | 'suspended';
  plan: 'basic' | 'pro' | 'enterprise';
}

interface SystemStats {
  totalUsers: number;
  totalCompanies: number;
  activeJobs: number;
  monthlyRevenue: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { actions, addAction, clearActions } = useButtonActions();

  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'companies' | 'settings'>('overview');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // New user form state
  const [newUser, setNewUser] = useState({
    email: '',
    fullName: '',
    role: 'crew' as const,
    companyId: ''
  });

  // Setup button actions
  useEffect(() => {
    clearActions();

    if (activeTab === 'overview') {
      addAction({
        id: 'manage-users',
        label: 'Manage Users',
        priority: 'high',
        icon: Users,
        onClick: () => setActiveTab('users'),
        className: 'bg-blue-600 text-white hover:bg-blue-700'
      });

      addAction({
        id: 'manage-companies',
        label: 'Companies',
        priority: 'high',
        icon: Building,
        onClick: () => setActiveTab('companies'),
        className: 'bg-purple-600 text-white hover:bg-purple-700'
      });

      addAction({
        id: 'system-settings',
        label: 'Settings',
        priority: 'medium',
        icon: Settings,
        onClick: () => setActiveTab('settings'),
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });
    } else if (activeTab === 'users') {
      addAction({
        id: 'add-user',
        label: 'Add User',
        priority: 'critical',
        icon: UserPlus,
        onClick: () => {
          setSelectedUser(null);
          setNewUser({ email: '', fullName: '', role: 'crew', companyId: '' });
          setShowUserModal(true);
        },
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });

      addAction({
        id: 'back-to-overview',
        label: 'Overview',
        priority: 'medium',
        icon: BarChart3,
        onClick: () => setActiveTab('overview'),
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });
    } else {
      addAction({
        id: 'back-to-overview',
        label: 'Overview',
        priority: 'medium',
        icon: BarChart3,
        onClick: () => setActiveTab('overview'),
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });
    }
  }, [activeTab, clearActions, addAction]);

  // Load data
  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const [usersRes, companiesRes, statsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/companies'),
        fetch('/api/admin/stats')
      ]);

      const [usersData, companiesData, statsData] = await Promise.all([
        usersRes.json(),
        companiesRes.json(),
        statsRes.json()
      ]);

      setUsers(usersData.users || []);
      setCompanies(companiesData.companies || []);
      setStats(statsData.stats);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      const result = await response.json();

      if (result.success) {
        setUsers(prev => [...prev, result.user]);
        setShowUserModal(false);
        setNewUser({ email: '', fullName: '', role: 'crew', companyId: '' });
      }
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });

      const result = await response.json();

      if (result.success) {
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, role: newRole as any } : user
        ));
      }
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  };

  const handleVoiceCommand = async (transcript: string) => {
    try {
      const response = await fetch('/api/admin/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          context: {
            currentPage: 'admin_dashboard',
            activeTab
          }
        })
      });

      const result = await response.json();
      
      // Handle voice actions
      if (result.response.actions) {
        for (const action of result.response.actions) {
          if (action.type === 'navigate' && action.target) {
            setActiveTab(action.target);
          } else if (action.type === 'create_user') {
            setShowUserModal(true);
          }
        }
      }
    } catch (error) {
      console.error('Voice command error:', error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Crown;
      case 'supervisor': return Briefcase;
      case 'crew': return Wrench;
      default: return Users;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-purple-600 bg-purple-100';
      case 'supervisor': return 'text-blue-600 bg-blue-100';
      case 'crew': return 'text-emerald-600 bg-emerald-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-8 h-8 animate-pulse text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // User creation/edit modal
  if (showUserModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {selectedUser ? 'Edit User' : 'Create New User'}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="user@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={newUser.fullName}
                onChange={(e) => setNewUser(prev => ({ ...prev, fullName: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="John Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as any }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="crew">Crew Member</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <select
                value={newUser.companyId}
                onChange={(e) => setNewUser(prev => ({ ...prev, companyId: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select company...</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCreateUser}
              disabled={!newUser.email || !newUser.fullName || !newUser.companyId}
              className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {selectedUser ? 'Update User' : 'Create User'}
            </button>
            <button
              onClick={() => setShowUserModal(false)}
              className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Shield className="w-8 h-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
            </div>
            
            {stats && (
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                stats.systemHealth === 'healthy' ? 'bg-emerald-100 text-emerald-800' :
                stats.systemHealth === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                System {stats.systemHealth}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'companies', label: 'Companies', icon: Building },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <Users className="w-8 h-8 text-blue-500" />
                      <div className="ml-4">
                        <p className="text-sm text-gray-600">Total Users</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <Building className="w-8 h-8 text-purple-500" />
                      <div className="ml-4">
                        <p className="text-sm text-gray-600">Companies</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <Briefcase className="w-8 h-8 text-emerald-500" />
                      <div className="ml-4">
                        <p className="text-sm text-gray-600">Active Jobs</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.activeJobs}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <DollarSign className="w-8 h-8 text-yellow-500" />
                      <div className="ml-4">
                        <p className="text-sm text-gray-600">Monthly Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(stats.monthlyRevenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Companies</h2>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {companies.slice(0, 5).map(company => (
                        <div key={company.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <h3 className="font-medium text-gray-900">{company.name}</h3>
                            <p className="text-sm text-gray-600">
                              {company.userCount} users • {company.activeJobs} active jobs
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {formatCurrency(company.monthlySpend)}/mo
                            </p>
                            <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              company.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                              company.status === 'trial' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {company.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    User Management ({users.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Active
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map(user => {
                        const RoleIcon = getRoleIcon(user.role);
                        return (
                          <tr key={user.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                                <RoleIcon className="w-3 h-3" />
                                {user.role}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {user.companyName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                user.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                                user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {user.status}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(user.lastActive)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowUserModal(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <select
                                  value={user.role}
                                  onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                                  className="text-xs border rounded px-2 py-1"
                                >
                                  <option value="crew">Crew</option>
                                  <option value="supervisor">Supervisor</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Companies Tab */}
            {activeTab === 'companies' && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Companies ({companies.length})
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {companies.map(company => (
                      <div key={company.id} className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">{company.name}</h3>
                            <p className="text-sm text-gray-600">{company.plan} plan</p>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            company.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            company.status === 'trial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {company.status}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Users</span>
                            <span className="text-sm font-medium">{company.userCount}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Active Jobs</span>
                            <span className="text-sm font-medium">{company.activeJobs}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Monthly Spend</span>
                            <span className="text-sm font-medium">{formatCurrency(company.monthlySpend)}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">User Registration</h3>
                        <p className="text-sm text-gray-600">Allow new users to register</p>
                      </div>
                      <input type="checkbox" className="toggle" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
                        <p className="text-sm text-gray-600">Send system notifications</p>
                      </div>
                      <input type="checkbox" className="toggle" defaultChecked />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Danger Zone</h2>
                  <div className="border border-red-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-red-900 mb-2">Reset System</h3>
                    <p className="text-sm text-red-700 mb-4">
                      This will reset all system data. This action cannot be undone.
                    </p>
                    <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                      Reset System
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <ButtonLimiter
                actions={actions}
                maxVisibleButtons={4}
                showVoiceButton={false}
                layout="grid"
                className="w-full"
              />
            </div>

            {/* Voice Assistant */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Assistant</h3>
              <div className="text-center">
                <VoiceCommandButton
                  onTranscript={handleVoiceCommand}
                  size="lg"
                  className="mx-auto"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Try: "Show users", "Create user"
                </p>
              </div>
            </div>

            {/* System Health */}
            {stats && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm text-gray-700">Database: Healthy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm text-gray-700">API: Operational</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm text-gray-700">Storage: Available</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}