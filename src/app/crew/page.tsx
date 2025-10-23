/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/crew/page.tsx
 * phase: 3
 * domain: crew
 * purpose: Modern crew dashboard with today's jobs and quick actions
 * spec_ref: 007-mvp-intent-driven/contracts/crew-ui.md
 * complexity_budget: 350
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Package,
  CheckCircle,
  Camera,
  RefreshCw,
  WifiOff,
  Users,
  Battery
} from 'lucide-react';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { TenantBadge } from '@/components/tenant';
import { supabase } from '@/lib/supabase/client';

interface Job {
  id: string;
  customer_name: string;
  property_address: string;
  scheduled_time: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'on_hold';
  template_name?: string;
  special_instructions?: string;
  estimated_duration?: string;
}

interface CrewStatus {
  memberName: string;
  currentJob?: string;
  totalJobsToday: number;
  completedJobs: number;
  hoursWorked: number;
}

interface DashboardStats {
  todayJobs: {
    total: number;
    completed: number;
    inProgress: number;
    remaining: number;
  };
  equipment: {
    verified: boolean;
    missingItems: string[];
    issuesReported: number;
  };
  vehicle: {
    fuelLevel: number | null;
    maintenanceAlerts: number;
  };
}

export default function CrewDashboardPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [crewStatus, setCrewStatus] = useState<CrewStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentUser, setCurrentUser] = useState<{ name?: string | null; email?: string | null } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    today: true,
    week: true,
    month: false,
  });

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      const [jobsRes, statusRes, statsRes] = await Promise.all([
        fetch('/api/crew/jobs/today'),
        fetch('/api/crew/status'),
        fetch('/api/crew/dashboard/stats')
      ]);

      const [jobsData, statusData, statsData] = await Promise.all([
        jobsRes.json(),
        statusRes.json(),
        statsRes.json()
      ]);

      setJobs(jobsData.jobs || []);
      setCrewStatus(statusData.status);
      setStats(statsData.stats);
      setIsOffline(false);

      // Cache data for offline access
      localStorage.setItem('crew_dashboard_cache', JSON.stringify({
        jobs: jobsData.jobs,
        status: statusData.status,
        stats: statsData.stats,
        timestamp: Date.now()
      }));

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setIsOffline(true);

      // Load from cache
      const cached = localStorage.getItem('crew_dashboard_cache');
      if (cached) {
        const { jobs: cachedJobs, status: cachedStatus, stats: cachedStats } = JSON.parse(cached);
        setJobs(cachedJobs || []);
        setCrewStatus(cachedStatus);
        setStats(cachedStats);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Resolve authenticated user for header display
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!isMounted || error || !data.user) {
        return;
      }

      const rawName =
        (data.user.user_metadata as Record<string, unknown> | undefined)?.full_name;

      setCurrentUser({
        name: typeof rawName === 'string' ? rawName : null,
        email: data.user.email
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  // Categorize jobs by time period
  const categorizeJobs = () => {
    const now = new Date();
    const today = now.toDateString();

    // Get start of week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Get end of week (Saturday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get start of month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get end of month
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const todayJobs = jobs.filter(job => {
      const jobDate = new Date(job.scheduled_time);
      return jobDate.toDateString() === today;
    });

    const weekJobs = jobs.filter(job => {
      const jobDate = new Date(job.scheduled_time);
      return jobDate >= startOfWeek && jobDate <= endOfWeek && jobDate.toDateString() !== today;
    });

    const monthJobs = jobs.filter(job => {
      const jobDate = new Date(job.scheduled_time);
      return jobDate >= startOfMonth && jobDate <= endOfMonth &&
             !(jobDate >= startOfWeek && jobDate <= endOfWeek);
    });

    return { todayJobs, weekJobs, monthJobs };
  };

  const { todayJobs, weekJobs, monthJobs } = categorizeJobs();

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="crew"
        onLogout={() => router.push('/')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Crew Dashboard</h1>
          <p className="text-xs text-gray-500">{formatTime(currentTime)} • {todayJobs.length} jobs today</p>
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
            onClick={loadDashboardData}
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
          {/* Quick Action */}
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => router.push('/crew/job-load')}
              className="action-button primary"
            >
              <Camera className="w-6 h-6" />
              <span className="text-sm">Verify Load</span>
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="stat-card">
                <Package className={`w-6 h-6 mx-auto mb-2 ${stats.equipment.verified ? 'text-green-500' : 'text-orange-500'}`} />
                <p className="text-2xl font-bold">{stats.equipment.verified ? '✓' : '!'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.equipment.verified ? 'Verified' : 'Check'}
                </p>
              </div>

              <div className="stat-card">
                <CheckCircle className="w-6 h-6 mx-auto mb-2" style={{ color: '#FFD700' }} />
                <p className="text-2xl font-bold">{stats.todayJobs.completed}/{stats.todayJobs.total}</p>
                <p className="text-xs text-gray-500 mt-1">Jobs Done</p>
              </div>

              <div className="stat-card">
                <Battery className={`w-6 h-6 mx-auto mb-2 ${(stats.vehicle.fuelLevel || 0) > 25 ? 'text-green-500' : 'text-orange-500'}`} />
                <p className="text-2xl font-bold">{stats.vehicle.fuelLevel || '--'}%</p>
                <p className="text-xs text-gray-500 mt-1">Fuel</p>
              </div>
            </div>
          )}

          {/* Job Sections */}
          {/* Today's Jobs */}
          <div className="job-section">
            <div
              className="section-header"
              onClick={() => setExpandedSections({...expandedSections, today: !expandedSections.today})}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" style={{ color: '#FFD700' }} />
                <h2 className="text-lg font-semibold">Today</h2>
                <span className="count-badge">{todayJobs.length}</span>
              </div>
              <motion.div
                animate={{ rotate: expandedSections.today ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.div>
            </div>

            {expandedSections.today && (
              <div className="space-y-3 mt-3">
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
                        onClick={() => router.push(`/crew/jobs/${job.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`status-badge ${job.status}`}>
                                {job.status.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(job.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <h3 className="font-semibold truncate">{job.customer_name}</h3>
                            <p className="text-sm text-gray-400 truncate mt-1">
                              {job.property_address}
                            </p>
                            {job.template_name && (
                              <p className="text-xs text-gray-500 mt-2">
                                {job.template_name} • {job.estimated_duration || 'N/A'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="empty-state-small">
                    <p className="text-gray-500 text-sm">No jobs today</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* This Week's Jobs */}
          <div className="job-section">
            <div
              className="section-header"
              onClick={() => setExpandedSections({...expandedSections, week: !expandedSections.week})}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" style={{ color: '#FFD700' }} />
                <h2 className="text-lg font-semibold">This Week</h2>
                <span className="count-badge">{weekJobs.length}</span>
              </div>
              <motion.div
                animate={{ rotate: expandedSections.week ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.div>
            </div>

            {expandedSections.week && (
              <div className="space-y-3 mt-3">
                {weekJobs.length > 0 ? (
                  weekJobs.map((job) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div
                        className="job-card"
                        onClick={() => router.push(`/crew/jobs/${job.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`status-badge ${job.status}`}>
                                {job.status.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(job.scheduled_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                {' • '}
                                {new Date(job.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <h3 className="font-semibold truncate">{job.customer_name}</h3>
                            <p className="text-sm text-gray-400 truncate mt-1">
                              {job.property_address}
                            </p>
                            {job.template_name && (
                              <p className="text-xs text-gray-500 mt-2">
                                {job.template_name} • {job.estimated_duration || 'N/A'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="empty-state-small">
                    <p className="text-gray-500 text-sm">No jobs this week</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* This Month's Jobs */}
          <div className="job-section">
            <div
              className="section-header"
              onClick={() => setExpandedSections({...expandedSections, month: !expandedSections.month})}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" style={{ color: '#FFD700' }} />
                <h2 className="text-lg font-semibold">This Month</h2>
                <span className="count-badge">{monthJobs.length}</span>
              </div>
              <motion.div
                animate={{ rotate: expandedSections.month ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.div>
            </div>

            {expandedSections.month && (
              <div className="space-y-3 mt-3">
                {monthJobs.length > 0 ? (
                  monthJobs.map((job) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div
                        className="job-card"
                        onClick={() => router.push(`/crew/jobs/${job.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`status-badge ${job.status}`}>
                                {job.status.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(job.scheduled_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                {' • '}
                                {new Date(job.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <h3 className="font-semibold truncate">{job.customer_name}</h3>
                            <p className="text-sm text-gray-400 truncate mt-1">
                              {job.property_address}
                            </p>
                            {job.template_name && (
                              <p className="text-xs text-gray-500 mt-2">
                                {job.template_name} • {job.estimated_duration || 'N/A'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="empty-state-small">
                    <p className="text-gray-500 text-sm">No jobs this month</p>
                  </div>
                )}
              </div>
            )}
          </div>

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

        .job-section {
          margin-bottom: 1.5rem;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .section-header:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
        }

        .empty-state-small {
          padding: 1rem;
          text-align: center;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 0.5rem;
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

        .status-badge.in_progress {
          background: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
        }

        .status-badge.completed {
          background: rgba(34, 197, 94, 0.2);
          color: #86efac;
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
