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
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
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
  Signal,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { VoiceCommandButton } from '@/components/voice/VoiceCommandButton';
import { createPortal } from 'react-dom';

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

  const [jobs, setJobs] = useState<Job[]>([]);
  const [crewStatus, setCrewStatus] = useState<CrewStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleVoiceTranscript = (text: string) => {
    setTranscript(text);
    setTimeout(() => setTranscript(null), 3000);
  };

  const handleVoiceCommand = async (transcript: string, confidence: number) => {
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
      <div className="mobile-container flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-golden mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const currentJob = getCurrentJob();
  const nextJob = getNextJob();
  const todayJobs = getTodayJobs();

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation 
        currentRole="crew" 
        onLogout={() => router.push('/sign-in')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">
            {currentJob ? 'Job in Progress' : 'Crew Dashboard'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {formatTime(currentTime)} • {todayJobs.length} jobs today
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          {isOffline ? (
            <WifiOff className="w-5 h-5 text-orange-500" />
          ) : (
            <Signal className="w-5 h-5 text-golden" />
          )}
          
          {/* Refresh */}
          <button
            onClick={loadDashboardData}
            className="icon-button"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Voice Transcript Overlay */}
      {transcript && mounted && createPortal(
        <div className="transcript-overlay">
          <p className="text-golden">{transcript}</p>
        </div>,
        document.body
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Current Job Banner */}
        {currentJob && (
          <div className="current-job-banner">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="pulse-dot"></div>
                  <span className="text-sm font-medium">Active Job</span>
                </div>
                <p className="font-semibold">{currentJob.customerName}</p>
                <p className="text-sm text-gray-300">{currentJob.propertyAddress}</p>
              </div>
              <button 
                onClick={() => router.push(`/crew/jobs/${currentJob.id}`)}
                className="icon-button"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Quick Actions */}
          <div className="action-grid mb-6">
            {currentJob ? (
              <>
                <button
                  onClick={() => router.push(`/crew/jobs/${currentJob.id}`)}
                  className="btn-primary"
                >
                  <Play className="w-5 h-5 mr-2" />
                  View Current Job
                </button>
                <button
                  onClick={() => handleCompleteJob(currentJob.id)}
                  className="btn-secondary"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Complete Job
                </button>
              </>
            ) : (
              <>
                {nextJob && (
                  <button
                    onClick={() => handleStartJob(nextJob.id)}
                    className="btn-primary"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Next Job
                  </button>
                )}
                <button
                  onClick={() => router.push('/crew/job-load')}
                  className="btn-secondary"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Verify Load
                </button>
              </>
            )}
          </div>

          {/* Quick Stats */}
          {stats && (
            <div className="stats-grid mb-6">
              <div className="stat-card">
                <div className="stat-header">
                  <Package className={`w-5 h-5 ${stats.equipment.verified ? 'text-golden' : 'text-orange-500'}`} />
                  <span>Equipment</span>
                </div>
                <div className="stat-content">
                  <p className="stat-value">
                    {stats.equipment.verified ? '✓' : '!'}
                  </p>
                  <p className="stat-label">
                    {stats.equipment.verified ? 'Verified' : 'Check needed'}
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <CheckCircle className="w-5 h-5 text-golden" />
                  <span>Progress</span>
                </div>
                <div className="stat-content">
                  <p className="stat-value">
                    {stats.todayJobs.completed}/{stats.todayJobs.total}
                  </p>
                  <p className="stat-label">Jobs done</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <Battery className={`w-5 h-5 ${stats.vehicle.fuelLevel > 25 ? 'text-golden' : 'text-orange-500'}`} />
                  <span>Vehicle</span>
                </div>
                <div className="stat-content">
                  <p className="stat-value">{stats.vehicle.fuelLevel}%</p>
                  <p className="stat-label">Fuel level</p>
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
              todayJobs.map(job => (
                <div
                  key={job.id}
                  className="job-card"
                  onClick={() => router.push(`/crew/jobs/${job.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`status-badge ${job.status}`}>
                          {job.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(new Date(job.scheduledTime))}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white">
                        {job.customerName}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {job.propertyAddress}
                      </p>
                      {job.templateName && (
                        <p className="text-xs text-gray-500 mt-2">
                          {job.templateName} • {job.estimatedDuration} mins
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
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

          {/* Next Job Preview */}
          {nextJob && !currentJob && (
            <div className="next-job-preview">
              <h3 className="text-sm font-semibold text-golden mb-2">Next Job</h3>
              <p className="font-medium">{nextJob.customerName}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(new Date(nextJob.scheduledTime))}</span>
                </div>
                {!nextJob.loadVerified && (
                  <div className="flex items-center gap-1 text-orange-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>Verify load</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice Command Button */}
      <div className="voice-fab">
        <VoiceCommandButton
          onTranscript={handleVoiceTranscript}
          onCommand={handleVoiceCommand}
          size="lg"
          autoSpeak={true}
        />
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

        .icon-button {
          padding: 0.5rem;
          background: transparent;
          color: #FFD700;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-button:hover {
          background: rgba(255, 215, 0, 0.1);
        }

        .current-job-banner {
          margin: 1rem;
          padding: 1rem;
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1));
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.75rem;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #FFD700;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { opacity: 1; box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
          70% { opacity: 1; box-shadow: 0 0 0 10px rgba(255, 215, 0, 0); }
          100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
        }

        .action-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
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
          transform: translateY(-1px);
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
          margin-bottom: 1rem;
        }

        .section-header h2 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #FFD700;
          margin: 0;
        }

        .job-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
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

        .next-job-preview {
          margin-top: 2rem;
          padding: 1rem;
          background: rgba(255, 215, 0, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
        }

        .voice-fab {
          position: fixed;
          bottom: 2rem;
          right: 50%;
          transform: translateX(50%);
          z-index: 1000;
        }

        .transcript-overlay {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid #FFD700;
          border-radius: 0.75rem;
          padding: 1.5rem 2rem;
          box-shadow: 0 0 30px rgba(255, 215, 0, 0.3);
          z-index: 2000;
          animation: fadeInOut 3s ease-in-out;
        }

        @keyframes fadeInOut {
          0%, 100% { opacity: 0; }
          20%, 80% { opacity: 1; }
        }

        .golden { color: #FFD700; }
      `}</style>
    </div>
  );
}