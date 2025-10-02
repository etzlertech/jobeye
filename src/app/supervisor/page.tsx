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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Supervisor Dashboard</h1>
              <p className="text-sm text-gray-600">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            
            {/* Offline indicator */}
            {isOffline && (
              <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 rounded-full">
                <WifiOff className="w-4 h-4 text-orange-600" />
                <span className="text-orange-800 text-sm">Offline</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Voice Response */}
        {voiceResponse && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800">{voiceResponse}</span>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        {dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Today's Jobs"
              value={dashboardData.todayJobs.total}
              icon={Calendar}
              color="bg-blue-500"
              subtitle={`${dashboardData.todayJobs.completed} completed`}
            />
            <StatCard
              title="Active Crews"
              value={dashboardData.crewStatus.length}
              icon={Users}
              color="bg-emerald-500"
              subtitle={`${dashboardData.crewStatus.filter(c => c.currentJob).length} working`}
            />
            <StatCard
              title="Inventory Alerts"
              value={dashboardData.inventoryAlerts.length}
              icon={Package}
              color="bg-orange-500"
              subtitle={`${dashboardData.inventoryAlerts.filter(a => a.severity === 'high').length} urgent`}
            />
            <StatCard
              title="Completion Rate"
              value={`${Math.round((dashboardData.todayJobs.completed / Math.max(dashboardData.todayJobs.total, 1)) * 100)}%`}
              icon={TrendingUp}
              color="bg-purple-500"
              subtitle="Today's progress"
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Today's Jobs */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Today's Jobs</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {todayJobs.length} jobs scheduled
                </p>
              </div>
              <div className="p-6">
                {todayJobs.length > 0 ? (
                  <div className="space-y-4">
                    {todayJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        isOffline={isOffline}
                        onJobClick={handleJobClick}
                        onVoiceCommand={handleJobVoiceCommand}
                        compact={true}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No jobs scheduled for today</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <ButtonLimiter
                actions={actions}
                maxVisibleButtons={4}
                showVoiceButton={true}
                onVoiceCommand={() => {}}
                layout="grid"
                className="w-full"
              />
            </div>

            {/* Voice Command */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Assistant</h3>
              <div className="text-center">
                <VoiceCommandButton
                  onTranscript={handleVoiceCommand}
                  responseText={voiceResponse}
                  size="lg"
                  className="mx-auto"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Try: "Create a new job", "Show inventory", "What's the status?"
                </p>
              </div>
            </div>

            {/* Crew Status */}
            {dashboardData?.crewStatus && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Crew Status</h3>
                <div className="space-y-3">
                  {dashboardData.crewStatus.slice(0, 5).map((crew) => (
                    <div key={crew.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{crew.name}</p>
                        <p className="text-sm text-gray-600">
                          {crew.currentJob ? 'Working' : 'Available'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm text-gray-600">
                            {crew.jobsCompleted}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-gray-600">
                            {crew.jobsRemaining}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inventory Alerts */}
            {dashboardData?.inventoryAlerts && dashboardData.inventoryAlerts.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Alerts</h3>
                <div className="space-y-3">
                  {dashboardData.inventoryAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.itemId} className="flex items-center gap-3">
                      <AlertTriangle className={`w-5 h-5 ${
                        alert.severity === 'high' ? 'text-red-500' :
                        alert.severity === 'medium' ? 'text-orange-500' :
                        'text-yellow-500'
                      }`} />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{alert.itemName}</p>
                        <p className="text-sm text-gray-600 capitalize">
                          {alert.alertType.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => router.push('/supervisor/inventory')}
                  className="mt-4 w-full text-sm text-blue-600 hover:text-blue-800"
                >
                  View all alerts →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stats card component
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  color: string;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}