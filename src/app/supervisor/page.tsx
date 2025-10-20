/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/supervisor/page.tsx
 * phase: 3
 * domain: supervisor
 * purpose: Modern supervisor dashboard with job overview and quick actions
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-ui.md
 * complexity_budget: 400
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  Users,
  Package,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle,
  WifiOff,
  Home,
  UserPlus,
  Building2,
  ListChecks,
  CheckSquare
} from 'lucide-react';
import { TenantBadge } from '@/components/tenant';
import { supabase } from '@/lib/supabase/client';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';

interface DashboardData {
  todayJobs: {
    total: number;
    assigned: number;
    inProgress: number;
    completed: number;
  };
  crewStatus: Array<{
    id: string;
    name: string;
    currentJob?: string;
    jobsCompleted: number;
    jobsRemaining: number;
  }>;
  inventoryAlerts: Array<{
    itemId: string;
    itemName: string;
    alertType: 'low_stock' | 'missing' | 'maintenance_due';
    severity: 'high' | 'medium' | 'low';
  }>;
}

interface Job {
  id: string;
  customerName: string;
  propertyAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'assigned' | 'started' | 'in_progress' | 'completed';
  specialInstructions?: string;
  requiredEquipment?: string[];
  loadVerified?: boolean;
  thumbnailUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export default function SupervisorDashboard() {
  const router = useRouter();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [currentUser, setCurrentUser] = useState<{ name?: string | null; email?: string | null } | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      const [statusResponse, jobsResponse] = await Promise.all([
        fetch('/api/supervisor/dashboard/status'),
        fetch('/api/supervisor/jobs/today')
      ]);

      if (!statusResponse.ok || !jobsResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [statusData, jobsData] = await Promise.all([
        statusResponse.json(),
        jobsResponse.json()
      ]);

      setDashboardData(statusData);
      setTodayJobs(jobsData.jobs || []);
      setLastRefresh(new Date());
      setIsOffline(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setIsOffline(true);

      // Load from cache if available
      const cachedData = localStorage.getItem('supervisor_dashboard_cache');
      if (cachedData) {
        const { statusData, jobsData, timestamp } = JSON.parse(cachedData);
        const cacheAge = Date.now() - timestamp;

        // Use cache if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          setDashboardData(statusData);
          setTodayJobs(jobsData);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Resolve authenticated user for header display
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!isMounted || error || !data.user) {
        return;
      }

      const rawName =
        (data.user.user_metadata as Record<string, unknown> | undefined)?.name;

      setCurrentUser({
        name: typeof rawName === 'string' ? rawName : null,
        email: data.user.email
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusVariant = (status: Job['status']) => {
    switch (status) {
      case 'in_progress':
      case 'started':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'assigned':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="mobile-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center h-full"
        >
          <div className="text-center">
            <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading dashboard...</p>
          </div>
        </motion.div>
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
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-xs text-gray-500">{lastRefresh.toLocaleTimeString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <TenantBadge />
          {currentUser?.email && (
            <div className="user-badge">
              <Users className="w-3 h-3 mr-1" />
              <span className="text-xs">{currentUser.name || currentUser.email.split('@')[0]}</span>
            </div>
          )}
          <button
            type="button"
            onClick={fetchDashboardData}
            className="icon-button"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <div className="notification-bar error">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm">You are offline. Showing cached data.</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Stats Overview */}
          {dashboardData && (
            <div className="grid grid-cols-3 gap-3">
              <div className="stat-card">
                <Calendar className="w-6 h-6 mx-auto mb-2" style={{ color: '#FFD700' }} />
                <p className="text-2xl font-bold">{dashboardData.todayJobs.total}</p>
                <p className="text-xs text-gray-500 mt-1">{dashboardData.todayJobs.completed} done</p>
              </div>

              <div className="stat-card">
                <Users className="w-6 h-6 mx-auto mb-2" style={{ color: '#FFD700' }} />
                <p className="text-2xl font-bold">{dashboardData.crewStatus.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {dashboardData.crewStatus.filter(c => c.currentJob).length} working
                </p>
              </div>

              <div className="stat-card">
                <Package
                  className="w-6 h-6 mx-auto mb-2"
                  style={{ color: dashboardData.inventoryAlerts.length > 0 ? '#f97316' : '#FFD700' }}
                />
                <p className="text-2xl font-bold">{dashboardData.inventoryAlerts.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {dashboardData.inventoryAlerts.filter(a => a.severity === 'high').length} urgent
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push('/supervisor/jobs')}
              className="action-button primary"
            >
              <Calendar className="w-6 h-6" />
              <span className="text-sm">Jobs</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/supervisor/templates')}
              className="action-button secondary"
            >
              <ListChecks className="w-6 h-6" />
              <span className="text-sm">Task Templates</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/supervisor/task-definitions')}
              className="action-button secondary"
            >
              <CheckSquare className="w-6 h-6" />
              <span className="text-sm">Task Definitions</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/supervisor/customers')}
              className="action-button secondary"
            >
              <UserPlus className="w-6 h-6" />
              <span className="text-sm">Customers</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/supervisor/properties')}
              className="action-button secondary"
            >
              <Home className="w-6 h-6" />
              <span className="text-sm">Properties</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/supervisor/inventory')}
              className="action-button secondary"
            >
              <Package className="w-6 h-6" />
              <span className="text-sm">Inventory</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/supervisor/users')}
              className="action-button secondary"
            >
              <Users className="w-6 h-6" />
              <span className="text-sm">Users</span>
            </button>
          </div>

          {/* Today's Jobs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Today's Jobs</h2>
              <span className="count-badge">{todayJobs.length}</span>
            </div>

            <div className="space-y-3">
              {todayJobs.length > 0 ? (
                todayJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className="job-card"
                      onClick={() => router.push(`/supervisor/jobs/${job.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`status-badge ${job.status}`}>
                              {job.status.replace('_', ' ')}
                            </span>
                            {job.priority === 'high' && (
                              <span className="text-xs font-medium" style={{ color: '#f97316' }}>
                                High Priority
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold truncate">{job.customerName}</h3>
                          <p className="text-sm text-gray-400 truncate mt-1">
                            {job.propertyAddress}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{job.scheduledTime}</span>
                            </div>
                            {!job.loadVerified && (
                              <div className="flex items-center gap-1" style={{ color: '#f97316' }}>
                                <AlertTriangle className="w-3 h-3" />
                                <span>Verify load</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="empty-state">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No jobs scheduled for today</p>
                </div>
              )}
            </div>
          </div>

          {/* Crew Status */}
          {dashboardData?.crewStatus && dashboardData.crewStatus.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Crew Status</h2>
                <span className="count-badge">{dashboardData.crewStatus.length}</span>
              </div>
              <div className="space-y-2">
                {dashboardData.crewStatus.slice(0, 3).map((crew) => (
                  <div key={crew.id} className="info-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{crew.name}</p>
                        <p className="text-xs text-gray-500">
                          {crew.currentJob ? 'Working' : 'Available'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: '#FFD700' }}>
                          {crew.jobsCompleted} done
                        </p>
                        <p className="text-xs text-gray-500">{crew.jobsRemaining} remain</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inventory Alerts */}
          {dashboardData?.inventoryAlerts && dashboardData.inventoryAlerts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Inventory Alerts</h2>
                <span className="count-badge urgent">{dashboardData.inventoryAlerts.length}</span>
              </div>
              <div className="space-y-2">
                {dashboardData.inventoryAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.itemId} className="alert-card">
                    <div className="flex items-center gap-3">
                      <AlertTriangle
                        className="w-5 h-5 shrink-0"
                        style={{
                          color:
                            alert.severity === 'high'
                              ? '#ef4444'
                              : alert.severity === 'medium'
                              ? '#f97316'
                              : '#eab308',
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{alert.itemName}</p>
                        <p className="text-xs text-gray-500 capitalize">
                          {alert.alertType.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-4" />
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

        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .user-badge {
          display: flex;
          align-items: center;
          padding: 0.25rem 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.375rem;
          color: white;
        }

        .icon-button {
          padding: 0.375rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-button:hover {
          background: rgba(255, 215, 0, 0.2);
          border-color: #FFD700;
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

        .stat-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          padding: 1rem;
          text-align: center;
        }

        .action-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          height: 5rem;
          gap: 0.5rem;
          border-radius: 0.5rem;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-button.primary {
          background: #FFD700;
          color: #000;
        }

        .action-button.primary:hover {
          background: #FFC700;
        }

        .action-button.secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 215, 0, 0.3);
        }

        .action-button.secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }

        .count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.25rem 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .count-badge.urgent {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .job-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .job-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
          transform: translateX(2px);
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .status-badge.assigned {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 215, 0, 0.3);
        }

        .status-badge.started,
        .status-badge.in_progress {
          background: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
        }

        .status-badge.completed {
          background: rgba(34, 197, 94, 0.2);
          color: #86efac;
        }

        .info-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          padding: 0.75rem;
        }

        .alert-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(249, 115, 22, 0.3);
          border-radius: 0.75rem;
          padding: 0.75rem;
        }

        .empty-state {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          padding: 2rem 1rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
