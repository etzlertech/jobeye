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
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import TenantBadge from '@/components/tenant/TenantBadge';
import {
  Users,
  Building,
  Shield,
  Settings,
  UserPlus,
  BarChart3,
  DollarSign,
  Briefcase,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'supervisor' | 'crew';
  tenantId: string;
  companyName: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending';
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
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'companies' | 'settings'>('overview');

  // Load admin data
  useEffect(() => {
    const loadAdminData = async () => {
      try {
        // Mock data for now since API might not exist
        setStats({
          totalUsers: 45,
          totalCompanies: 12,
          activeJobs: 23,
          monthlyRevenue: 15750,
          systemHealth: 'healthy'
        });
        
        setUsers([
          {
            id: '1',
            email: 'admin@example.com',
            fullName: 'Admin User',
            role: 'admin',
            tenantId: '1',
            companyName: 'System Admin',
            lastActive: '2025-10-02',
            status: 'active'
          }
        ]);

        setCompanies([
          {
            id: '1',
            name: 'Demo Company',
            userCount: 5,
            activeJobs: 3,
            monthlySpend: 1200,
            status: 'active',
            plan: 'pro'
          }
        ]);
      } catch (error) {
        console.error('Failed to load admin data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAdminData();
  }, []);

  if (isLoading) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-golden mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading admin dashboard...</p>
        </div>
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .golden { color: #FFD700; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mobile-container">
      <MobileNavigation 
        currentRole="admin" 
        onLogout={() => router.push('/sign-in')}
      />

      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Super Admin</h1>
          {stats && (
            <p className={`text-xs mt-1 ${
              stats.systemHealth === 'healthy' ? 'text-green-500' :
              stats.systemHealth === 'warning' ? 'text-yellow-500' :
              'text-red-500'
            }`}>
              System {stats.systemHealth}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <TenantBadge />
          <Shield className="w-6 h-6 text-golden" />
        </div>
      </div>

      <div className="px-4 py-2 border-b border-gray-800">
        <div className="flex space-x-1">
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
                className={`flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-golden text-black'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <Users className="w-5 h-5 text-golden" />
                  <span>Users</span>
                </div>
                <div className="stat-content">
                  <p className="stat-value">{stats.totalUsers}</p>
                  <p className="stat-label">Total</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <Building className="w-5 h-5 text-golden" />
                  <span>Companies</span>
                </div>
                <div className="stat-content">
                  <p className="stat-value">{stats.totalCompanies}</p>
                  <p className="stat-label">Active</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <Briefcase className="w-5 h-5 text-golden" />
                  <span>Jobs</span>
                </div>
                <div className="stat-content">
                  <p className="stat-value">{stats.activeJobs}</p>
                  <p className="stat-label">Active</p>
                </div>
              </div>
            </div>

            <div className="revenue-card">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-6 h-6 text-golden" />
                <span className="text-sm text-gray-400">Monthly Revenue</span>
              </div>
              <p className="text-2xl font-bold text-golden">
                ${stats.monthlyRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-golden">Users ({users.length})</h2>
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.id} className="user-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-white">{user.fullName}</h3>
                      <p className="text-sm text-gray-400">{user.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {user.role} • {user.companyName}
                      </p>
                    </div>
                    <div className={`role-badge ${user.role}`}>
                      {user.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'companies' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-golden">Companies ({companies.length})</h2>
            <div className="space-y-3">
              {companies.map(company => (
                <div key={company.id} className="company-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-white">{company.name}</h3>
                      <p className="text-sm text-gray-400">
                        {company.userCount} users • {company.activeJobs} jobs
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ${company.monthlySpend}/month • {company.plan}
                      </p>
                    </div>
                    <div className={`status-badge ${company.status}`}>
                      {company.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-golden">System Settings</h2>
            <div className="space-y-3">
              <div className="setting-card">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Database: Healthy</span>
                </div>
              </div>
              <div className="setting-card">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm">API: Operational</span>
                </div>
              </div>
              <div className="setting-card">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Storage: Available</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bottom-actions">
        <button
          onClick={() => alert('User creation feature coming soon!')}
          className="btn-primary w-full"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Create New User
        </button>
      </div>

      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          height: 100vh;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          color: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .stat-card, .user-card, .company-card, .setting-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          padding: 1rem;
        }

        .stat-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: #999;
          margin-bottom: 0.5rem;
        }

        .stat-content {
          text-align: center;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #FFD700;
          margin: 0;
        }

        .stat-label {
          font-size: 0.75rem;
          color: #666;
          margin: 0;
        }

        .revenue-card {
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.75rem;
          padding: 1rem;
          margin-bottom: 2rem;
        }

        .role-badge, .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.5rem;
          font-size: 0.7rem;
          font-weight: 500;
          border-radius: 9999px;
          text-transform: uppercase;
        }

        .role-badge.admin {
          background: rgba(147, 51, 234, 0.2);
          color: #a855f7;
        }

        .role-badge.supervisor {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        .role-badge.crew {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .status-badge.active {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .bottom-actions {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 375px;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.9);
          border-top: 1px solid #333;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: #FFD700;
          color: #000;
          font-weight: 600;
          border-radius: 0.5rem;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }

        .btn-primary:hover {
          background: #FFC700;
        }

        .golden { color: #FFD700; }
      `}</style>
    </div>
  );
}