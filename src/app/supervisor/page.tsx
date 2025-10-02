/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/supervisor/page.tsx
 * phase: 3
 * domain: supervisor
 * purpose: Main supervisor dashboard with job overview and quick actions
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-ui.md
 * complexity_budget: 400
 * migrations_touched: []
 * state_machine: {
 *   states: ['loading', 'loaded', 'refreshing', 'error'],
 *   transitions: [
 *     'loading->loaded: dataFetched()',
 *     'loaded->refreshing: refresh()',
 *     'refreshing->loaded: dataUpdated()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "voiceCommands": "$0.02-0.05 per command"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/components/ui/JobCard',
 *     '@/components/ui/ButtonLimiter',
 *     '@/components/voice/VoiceCommandButton',
 *     '@/domains/supervisor/services/supervisor-workflow.service'
 *   ],
 *   external: ['react', 'next/navigation'],
 *   supabase: ['jobs', 'crews', 'inventory']
 * }
 * exports: ['default']
 * voice_considerations: Voice commands for all major actions
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/supervisor-dashboard.test.ts'
 * }
 * tasks: [
 *   'Create dashboard layout with stats overview',
 *   'Display today\'s jobs with status',
 *   'Add quick action buttons with voice support',
 *   'Show crew status and inventory alerts'
 * ]
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  Calendar,
  Users,
  Package,
  AlertTriangle,
  Plus,
  RefreshCw,
  TrendingUp,
  Clock,
  CheckCircle,
  WifiOff,
  Bell
} from 'lucide-react';
import { JobCard } from '@/components/ui/JobCard';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';
import { VoiceCommandButton } from '@/components/voice/VoiceCommandButton';

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
  recentActivity: Array<{
    timestamp: string;
    type: string;
    description: string;
    userId: string;
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
  const { actions, addAction, clearActions } = useButtonActions();
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [voiceResponse, setVoiceResponse] = useState<string | null>(null);

  // Setup button actions
  useEffect(() => {
    clearActions();

    addAction({
      id: 'create-job',
      label: 'Create Job',
      priority: 'critical',
      icon: Plus,
      onClick: () => router.push('/supervisor/jobs/create'),
      className: 'bg-emerald-600 text-white hover:bg-emerald-700'
    });

    addAction({
      id: 'manage-inventory',
      label: 'Inventory',
      priority: 'high',
      icon: Package,
      onClick: () => router.push('/supervisor/inventory'),
      className: 'bg-blue-600 text-white hover:bg-blue-700'
    });

    addAction({
      id: 'refresh',
      label: 'Refresh',
      priority: 'medium',
      icon: RefreshCw,
      onClick: fetchDashboardData,
      className: 'bg-gray-600 text-white hover:bg-gray-700'
    });
  }, [clearActions, addAction, router]);

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

  // Handle voice commands
  const handleVoiceCommand = async (transcript: string) => {
    try {
      const response = await fetch('/api/supervisor/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          context: {
            currentPage: 'supervisor_dashboard',
            todayJobCount: todayJobs.length
          }
        })
      });

      if (!response.ok) {
        throw new Error('Voice command failed');
      }

      const result = await response.json();
      setVoiceResponse(result.response.text);

      // Execute any actions
      if (result.response.actions) {
        for (const action of result.response.actions) {
          switch (action.type) {
            case 'navigate':
              router.push(action.target);
              break;
            case 'create':
              if (action.target === 'job') {
                router.push('/supervisor/jobs/create');
              }
              break;
            case 'show':
              if (action.target === 'inventory') {
                router.push('/supervisor/inventory');
              }
              break;
          }
        }
      }

      // Clear response after 5 seconds
      setTimeout(() => setVoiceResponse(null), 5000);
    } catch (error) {
      console.error('Voice command error:', error);
      setVoiceResponse('Sorry, I couldn\'t process that command.');
      setTimeout(() => setVoiceResponse(null), 3000);
    }
  };

  const handleJobClick = (jobId: string) => {
    router.push(`/supervisor/jobs/${jobId}`);
  };

  const handleJobVoiceCommand = (jobId: string) => {
    handleVoiceCommand(`Tell me about job ${jobId}`);
  };

  if (isLoading) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-golden mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation 
        currentRole="supervisor" 
        onLogout={() => router.push('/sign-in')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Supervisor Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">
            {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        
        {/* Offline indicator */}
        {isOffline && (
          <div className="flex items-center gap-2">
            <WifiOff className="w-5 h-5 text-orange-500" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Voice Response */}
        {voiceResponse && (
          <div className="notification-bar">
            <Bell className="w-5 h-5 text-golden" />
            <span className="text-sm">{voiceResponse}</span>
          </div>
        )}

        {/* Stats Overview */}
        <div className="px-4 py-4">
          {dashboardData && (
            <div className="stats-grid mb-6">
              <div className="stat-card">
                <div className="stat-header">
                  <Calendar className="w-5 h-5 text-golden" />
                  <span>Jobs</span>
                </div>
                <div className="stat-content">
                  <p className="stat-value">{dashboardData.todayJobs.total}</p>
                  <p className="stat-label">{dashboardData.todayJobs.completed} done</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-header">
                  <Users className="w-5 h-5 text-golden" />
                  <span>Crews</span>
                </div>
                <div className="stat-content">
                  <p className="stat-value">{dashboardData.crewStatus.length}</p>
                  <p className="stat-label">{dashboardData.crewStatus.filter(c => c.currentJob).length} working</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-header">
                  <Package className={`w-5 h-5 ${dashboardData.inventoryAlerts.length > 0 ? 'text-orange-500' : 'text-golden'}`} />
                  <span>Alerts</span>
                </div>
                <div className="stat-content">
                  <p className="stat-value">{dashboardData.inventoryAlerts.length}</p>
                  <p className="stat-label">{dashboardData.inventoryAlerts.filter(a => a.severity === 'high').length} urgent</p>
                </div>
              </div>
            </div>
          )}

          {/* Today's Jobs */}
          <div className="section-header">
            <h2>Today's Jobs</h2>
            <span className="text-gray-500">{todayJobs.length}</span>
          </div>

          <div className="job-list">
            {todayJobs.length > 0 ? (
              todayJobs.map((job) => (
                <div
                  key={job.id}
                  className="job-card"
                  onClick={() => handleJobClick(job.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`status-badge ${job.status}`}>
                          {job.status.replace('_', ' ')}
                        </span>
                        {job.priority === 'high' && (
                          <span className="text-xs text-orange-500">High Priority</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-white">
                        {job.customerName}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {job.propertyAddress}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{job.scheduledTime}</span>
                        </div>
                        {!job.loadVerified && (
                          <div className="flex items-center gap-1 text-orange-500">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Verify load</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No jobs scheduled for today</p>
              </div>
            )}
          </div>

          {/* Crew Status */}
          {dashboardData?.crewStatus && dashboardData.crewStatus.length > 0 && (
            <>
              <div className="section-header">
                <h2>Crew Status</h2>
                <span className="text-gray-500">{dashboardData.crewStatus.length}</span>
              </div>
              <div className="crew-list">
                {dashboardData.crewStatus.slice(0, 3).map((crew) => (
                  <div key={crew.id} className="crew-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{crew.name}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {crew.currentJob ? 'Working' : 'Available'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-golden">{crew.jobsCompleted} done</p>
                        <p className="text-xs text-gray-500">{crew.jobsRemaining} remain</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Inventory Alerts */}
          {dashboardData?.inventoryAlerts && dashboardData.inventoryAlerts.length > 0 && (
            <>
              <div className="section-header">
                <h2>Inventory Alerts</h2>
                <span className="text-orange-500">{dashboardData.inventoryAlerts.length}</span>
              </div>
              <div className="alert-list mb-20">
                {dashboardData.inventoryAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.itemId} className="alert-card">
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                      alert.severity === 'high' ? 'text-red-500' :
                      alert.severity === 'medium' ? 'text-orange-500' :
                      'text-yellow-500'
                    }`} />
                    <div className="flex-1">
                      <p className="font-medium text-white">{alert.itemName}</p>
                      <p className="text-xs text-gray-400 capitalize mt-1">
                        {alert.alertType.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Voice Command FAB */}
      <div className="voice-fab">
        <VoiceCommandButton
          onTranscript={handleVoiceCommand}
          responseText={voiceResponse}
          size="xxl"
          autoSpeak={true}
        />
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          onClick={() => router.push('/supervisor/jobs/create')}
          className="btn-primary flex-1"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Job
        </button>
        <button
          onClick={() => router.push('/supervisor/inventory')}
          className="btn-secondary flex-1"
        >
          <Package className="w-5 h-5 mr-2" />
          Inventory
        </button>
      </div>

      {/* Styled JSX */}
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

        .notification-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 0.5rem 1rem;
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.5rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }

        .stat-card {
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

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 1.5rem 0 1rem;
          padding: 0 1rem;
        }

        .section-header h2 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #FFD700;
          margin: 0;
        }

        .job-list,
        .crew-list,
        .alert-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0 1rem;
        }

        .job-card,
        .crew-card,
        .alert-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .job-card:hover,
        .crew-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
          transform: translateX(2px);
        }

        .alert-card {
          display: flex;
          align-items: start;
          gap: 0.75rem;
          cursor: default;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.125rem 0.5rem;
          font-size: 0.7rem;
          font-weight: 500;
          border-radius: 9999px;
          text-transform: uppercase;
        }

        .status-badge.assigned {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        .status-badge.in_progress {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .status-badge.completed {
          background: rgba(156, 163, 175, 0.2);
          color: #9ca3af;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
        }

        .voice-fab {
          position: fixed;
          bottom: 5.5rem;
          right: 50%;
          transform: translateX(50%);
          z-index: 1000;
        }

        .bottom-actions {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 375px;
          display: flex;
          gap: 0.75rem;
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
        }

        .btn-primary:hover {
          background: #FFC700;
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

        .golden { color: #FFD700; }
      `}</style>
    </div>
  );
}