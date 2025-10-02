/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/crew/page.tsx
 * phase: 3
 * domain: crew
 * purpose: Crew dashboard with today's jobs and quick actions
 * spec_ref: 007-mvp-intent-driven/contracts/crew-ui.md
 * complexity_budget: 350
 * migrations_touched: []
 * state_machine: {
 *   states: ['loading', 'dashboard', 'job_starting', 'verification_mode'],
 *   transitions: [
 *     'loading->dashboard: dataLoaded()',
 *     'dashboard->job_starting: startJob()',
 *     'dashboard->verification_mode: verifyLoad()',
 *     'job_starting->dashboard: jobStarted()',
 *     'verification_mode->dashboard: verificationComplete()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "voiceCommands": "$0.02-0.05 per command",
 *   "loadVerification": "$0.03-0.05 per image (VLM)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/components/ui/ButtonLimiter',
 *     '@/components/ui/JobCard',
 *     '@/components/voice/VoiceCommandButton',
 *     '@/domains/crew/services/crew-workflow.service'
 *   ],
 *   external: ['react', 'next/navigation'],
 *   supabase: ['jobs', 'job_assignments']
 * }
 * exports: ['default']
 * voice_considerations: Voice navigation between jobs and quick status updates
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/crew-dashboard-flow.test.ts'
 * }
 * tasks: [
 *   'Display today\'s assigned jobs with status',
 *   'Add quick action buttons for common tasks',
 *   'Implement job starting workflow',
 *   'Add load verification shortcuts'
 * ]
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Package,
  CheckCircle,
  Play,
  AlertCircle,
  Wrench,
  Camera,
  RefreshCw,
  WifiOff,
  Battery,
  Signal
} from 'lucide-react';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';
import { JobCard } from '@/components/ui/JobCard';
import { VoiceCommandButton } from '@/components/voice/VoiceCommandButton';

interface Job {
  id: string;
  customerName: string;
  propertyAddress: string;
  scheduledTime: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'on_hold';
  templateName?: string;
  specialInstructions?: string;
  voiceInstructionsUrl?: string;
  loadVerified: boolean;
  estimatedDuration: number;
  requiredEquipment: string[];
  priority: 'high' | 'medium' | 'low';
  thumbnailUrl?: string;
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
    fuelLevel: number;
    maintenanceAlerts: number;
  };
}

export default function CrewDashboardPage() {
  const router = useRouter();
  const { actions, addAction, clearActions } = useButtonActions();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [crewStatus, setCrewStatus] = useState<CrewStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Setup button actions
  useEffect(() => {
    clearActions();

    const currentJob = jobs.find(job => job.status === 'in_progress');
    
    if (currentJob) {
      // Job in progress - show job-specific actions
      addAction({
        id: 'view-current-job',
        label: 'Current Job',
        priority: 'critical',
        icon: Play,
        onClick: () => router.push(`/crew/jobs/${currentJob.id}`),
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });

      addAction({
        id: 'complete-job',
        label: 'Complete',
        priority: 'high',
        icon: CheckCircle,
        onClick: () => handleCompleteJob(currentJob.id),
        className: 'bg-blue-600 text-white hover:bg-blue-700'
      });
    } else {
      // No job in progress - show general actions
      const nextJob = jobs.find(job => job.status === 'assigned');
      
      if (nextJob) {
        addAction({
          id: 'start-next-job',
          label: 'Start Next',
          priority: 'critical',
          icon: Play,
          onClick: () => handleStartJob(nextJob.id),
          className: 'bg-emerald-600 text-white hover:bg-emerald-700'
        });
      }

      addAction({
        id: 'verify-load',
        label: 'Verify Load',
        priority: 'high',
        icon: Camera,
        onClick: () => router.push('/crew/job-load'),
        className: 'bg-purple-600 text-white hover:bg-purple-700'
      });

      addAction({
        id: 'report-issue',
        label: 'Report Issue',
        priority: 'medium',
        icon: Wrench,
        onClick: () => router.push('/crew/maintenance/report'),
        className: 'bg-orange-600 text-white hover:bg-orange-700'
      });
    }

    addAction({
      id: 'refresh',
      label: 'Refresh',
      priority: 'low',
      icon: RefreshCw,
      onClick: loadDashboardData,
      className: 'bg-gray-600 text-white hover:bg-gray-700'
    });

  }, [jobs, clearActions, addAction]);

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
        fetch('/api/crew/jobs'),
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

  const handleStartJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/crew/jobs/${jobId}/start`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        // Update job status locally
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'in_progress' as const }
            : job
        ));
        
        // Navigate to job detail
        router.push(`/crew/jobs/${jobId}`);
      }
    } catch (error) {
      console.error('Failed to start job:', error);
    }
  };

  const handleCompleteJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/crew/jobs/${jobId}/complete`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        // Update job status locally
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'completed' as const }
            : job
        ));
      }
    } catch (error) {
      console.error('Failed to complete job:', error);
    }
  };

  const handleVoiceCommand = async (transcript: string) => {
    try {
      const response = await fetch('/api/crew/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          context: {
            currentPage: 'dashboard',
            jobCount: jobs.length,
            currentJob: jobs.find(j => j.status === 'in_progress')?.id
          }
        })
      });

      const result = await response.json();
      
      // Handle voice actions
      if (result.response.actions) {
        for (const action of result.response.actions) {
          if (action.type === 'navigate' && action.target) {
            router.push(action.target);
          } else if (action.type === 'start_job' && action.jobId) {
            handleStartJob(action.jobId);
          }
        }
      }
    } catch (error) {
      console.error('Voice command error:', error);
    }
  };

  const getTodayJobs = () => {
    const today = new Date().toDateString();
    return jobs.filter(job => 
      new Date(job.scheduledTime).toDateString() === today
    );
  };

  const getCurrentJob = () => {
    return jobs.find(job => job.status === 'in_progress');
  };

  const getNextJob = () => {
    const todayJobs = getTodayJobs();
    return todayJobs.find(job => job.status === 'assigned');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const currentJob = getCurrentJob();
  const nextJob = getNextJob();
  const todayJobs = getTodayJobs();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentJob ? 'Job in Progress' : 'Crew Dashboard'}
              </h1>
              <p className="text-sm text-gray-600">
                {formatTime(currentTime)} • {todayJobs.length} jobs today
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {isOffline ? (
                  <div className="flex items-center gap-1 text-orange-600">
                    <WifiOff className="w-4 h-4" />
                    <span className="text-xs">Offline</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-emerald-600">
                    <Signal className="w-4 h-4" />
                    <span className="text-xs">Online</span>
                  </div>
                )}
              </div>

              {/* Crew Member Name */}
              {crewStatus && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{crewStatus.memberName}</p>
                  <p className="text-xs text-gray-600">
                    {crewStatus.completedJobs}/{crewStatus.totalJobsToday} completed
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Job Banner */}
        {currentJob && (
          <div className="bg-emerald-600 text-white rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2">Current Job</h2>
                <p className="text-emerald-100">{currentJob.customerName}</p>
                <p className="text-emerald-100">{currentJob.propertyAddress}</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-100 text-sm">Started</p>
                <p className="text-xl font-bold">{formatTime(new Date(currentJob.scheduledTime))}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Today's Jobs */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Today's Jobs ({todayJobs.length})
                </h2>
              </div>
              <div className="p-6">
                {todayJobs.length > 0 ? (
                  <div className="space-y-4">
                    {todayJobs.map(job => (
                      <JobCard
                        key={job.id}
                        job={{
                          id: job.id,
                          title: job.customerName,
                          description: job.propertyAddress,
                          status: job.status,
                          scheduledTime: job.scheduledTime,
                          thumbnailUrl: job.thumbnailUrl,
                          priority: job.priority,
                          metadata: {
                            templateName: job.templateName,
                            loadVerified: job.loadVerified,
                            estimatedDuration: job.estimatedDuration
                          }
                        }}
                        onClick={() => router.push(`/crew/jobs/${job.id}`)}
                        showQuickActions={true}
                        onQuickAction={(action) => {
                          if (action === 'start') handleStartJob(job.id);
                          if (action === 'complete') handleCompleteJob(job.id);
                        }}
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

            {/* Quick Stats */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Equipment Status */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Equipment</h3>
                    <Package className={`w-6 h-6 ${stats.equipment.verified ? 'text-emerald-500' : 'text-orange-500'}`} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {stats.equipment.verified ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                      )}
                      <span className="text-sm text-gray-600">
                        {stats.equipment.verified ? 'Load verified' : 'Verification needed'}
                      </span>
                    </div>
                    {stats.equipment.missingItems.length > 0 && (
                      <p className="text-xs text-red-600">
                        {stats.equipment.missingItems.length} missing items
                      </p>
                    )}
                  </div>
                </div>

                {/* Job Progress */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Progress</h3>
                    <CheckCircle className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Completed</span>
                      <span className="font-medium">{stats.todayJobs.completed}/{stats.todayJobs.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ 
                          width: `${stats.todayJobs.total > 0 ? (stats.todayJobs.completed / stats.todayJobs.total) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Vehicle Status */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Vehicle</h3>
                    <Battery className={`w-6 h-6 ${stats.vehicle.fuelLevel > 25 ? 'text-emerald-500' : 'text-orange-500'}`} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fuel</span>
                      <span className="font-medium">{stats.vehicle.fuelLevel}%</span>
                    </div>
                    {stats.vehicle.maintenanceAlerts > 0 && (
                      <p className="text-xs text-orange-600">
                        {stats.vehicle.maintenanceAlerts} maintenance alerts
                      </p>
                    )}
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
                  Try: "Start next job", "Check equipment"
                </p>
              </div>
            </div>

            {/* Next Job Preview */}
            {nextJob && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Job</h3>
                <div className="space-y-2">
                  <p className="font-medium text-gray-900">{nextJob.customerName}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(new Date(nextJob.scheduledTime))}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{nextJob.propertyAddress}</span>
                  </div>
                  {!nextJob.loadVerified && (
                    <div className="flex items-center gap-2 text-sm text-orange-600 mt-3">
                      <AlertCircle className="w-4 h-4" />
                      <span>Load verification needed</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}