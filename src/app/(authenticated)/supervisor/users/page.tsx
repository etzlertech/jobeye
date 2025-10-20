'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { EntityTile } from '@/components/ui/EntityTile';
import { EntityTileGrid } from '@/components/ui/EntityTileGrid';
import {
  Users,
  Search,
  ArrowLeft,
  AlertCircle,
  User as UserIcon,
  Loader2
} from 'lucide-react';

interface User {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  thumbnailImageUrl: string | null;
  lastLoginAt: string | null;
}

function UsersPageContent() {
  const router = useRouter();

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (roleFilter !== 'all') {
        params.set('role', roleFilter);
      }

      const response = await fetch(`/api/supervisor/users?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const displayName = user.displayName || fullName || user.email || '';

    return displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading users...</p>
          </div>
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
            padding: 0 0.5rem;
            box-sizing: border-box;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">User Management</h1>
          <p className="text-xs text-gray-500">{filteredUsers.length} users</p>
        </div>
      </div>

      {/* Error Notification */}
      {error && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input-field"
          >
            <option value="all">All Roles</option>
            <option value="technician">Technicians</option>
            <option value="manager">Managers</option>
            <option value="supervisor">Supervisors</option>
          </select>
        </div>

        {/* User Grid */}
        <div className="px-4 pb-4">
          <EntityTileGrid
            emptyState={{
              icon: <Users className="w-12 h-12" />,
              message: searchQuery ? 'No users match your search' : 'No users found'
            }}
          >
            {filteredUsers.map((user) => {
              const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
              const displayName = user.displayName || fullName || user.email || 'Unknown User';

              // Determine role color
              const roleColor = user.role === 'manager' ? 'blue' as const
                : user.role === 'technician' ? 'gold' as const
                : user.role === 'supervisor' ? 'green' as const
                : 'gray' as const;

              return (
                <EntityTile
                  key={user.id}
                  image={user.thumbnailImageUrl}
                  fallbackIcon={<UserIcon />}
                  title={displayName}
                  subtitle={user.email || 'No email'}
                  tags={[
                    { label: user.role, color: roleColor },
                    {
                      label: user.isActive ? '● Active' : '○ Inactive',
                      color: user.isActive ? 'green' as const : 'gray' as const
                    }
                  ]}
                  onClick={() => router.push(`/supervisor/users/${user.id}`)}
                />
              );
            })}
          </EntityTileGrid>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => router.push('/supervisor')}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
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
          padding: 0 0.5rem;
          box-sizing: border-box;
        }

        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .notification-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 0.5rem 1rem;
          border-radius: 0.5rem;
        }

        .notification-bar.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
        }

        .input-field:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .input-field::placeholder {
          color: #6b7280;
        }

        .input-field option {
          background: #1a1a1a;
          color: white;
        }

        .bottom-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.9);
          border-top: 1px solid #333;
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }
      `}</style>
    </div>
  );
}

// Main export wrapped in Suspense
export default function SupervisorUsersPage() {
  return (
    <Suspense fallback={
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading...</p>
          </div>
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
            padding: 0 0.5rem;
            box-sizing: border-box;
          }
        `}</style>
      </div>
    }>
      <UsersPageContent />
    </Suspense>
  );
}
