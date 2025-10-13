/**
 * @file /src/components/admin/AdminAuthGuard.tsx
 * @phase 3.3
 * @domain admin
 * @purpose Authentication guard for System Admin Console
 * @spec_ref admin-ui-data-contracts.md
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, AlertCircle } from 'lucide-react';

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // TODO: Replace with actual auth check
        // For now, simulate auth check
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock admin user - in real implementation, check JWT/session
        const mockUser: AdminUser = {
          id: 'admin-1',
          email: 'admin@jobeye.com',
          role: 'system_admin',
          tenantId: 'system'
        };

        // Check if user has admin role
        if (mockUser.role !== 'system_admin') {
          setError('Insufficient permissions. System admin access required.');
          return;
        }

        setUser(mockUser);
      } catch (err) {
        setError('Authentication failed. Please sign in.');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-content">
          <Shield className="w-12 h-12 text-emerald-400 mb-4" />
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Verifying Admin Access</h2>
          <p className="text-slate-400">Checking system administrator permissions...</p>
        </div>
        
        <style jsx>{`
          .admin-loading {
            min-height: 100vh;
            background: rgb(2, 6, 23);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          }
          
          .loading-content {
            text-align: center;
            max-width: 400px;
            padding: 2rem;
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error">
        <div className="error-content">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/sign-in')}
            className="btn-primary"
          >
            Return to Sign In
          </button>
        </div>
        
        <style jsx>{`
          .admin-error {
            min-height: 100vh;
            background: rgb(2, 6, 23);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          }
          
          .error-content {
            text-align: center;
            max-width: 400px;
            padding: 2rem;
          }
          
          .btn-primary {
            background: #10b981;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            border: none;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .btn-primary:hover {
            background: #059669;
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  return <>{children}</>;
}