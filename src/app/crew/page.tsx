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
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  MapPin,
  Package,
  CheckCircle,
  Play,
  AlertCircle,
  Camera,
  RefreshCw,
  WifiOff,
  Battery,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { MobileContainer, MobileHeader, MobileCard, MobileFAB } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

  const [jobs, setJobs] = useState<Job[]>([]);
  const [crewStatus, setCrewStatus] = useState<CrewStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [transcript, setTranscript] = useState<string | null>(null);

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
        setJobs(prev => prev.map(job =>
          job.id === jobId
            ? { ...job, status: 'in_progress' as const }
            : job
        ));
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

  const handleVoiceCommand = async (transcript: string, confidence: number) => {
    setTranscript(transcript);
    setTimeout(() => setTranscript(null), 3000);

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

  const getStatusVariant = (status: Job['status']) => {
    switch (status) {
      case 'in_progress': return 'default';
      case 'completed': return 'secondary';
      case 'assigned': return 'outline';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <MobileContainer className="items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">Loading dashboard...</p>
        </motion.div>
      </MobileContainer>
    );
  }

  const currentJob = getCurrentJob();
  const nextJob = getNextJob();
  const todayJobs = getTodayJobs();

  return (
    <MobileContainer>
      {/* Header */}
      <MobileHeader
        title={currentJob ? 'Job in Progress' : 'Crew Dashboard'}
        subtitle={`${formatTime(currentTime)} • ${todayJobs.length} jobs today`}
        isOffline={isOffline}
        rightContent={
          <Button
            variant="ghost"
            size="icon"
            onClick={loadDashboardData}
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        }
      />

      {/* Voice Transcript Overlay */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-sm"
          >
            <Card className="border-primary bg-primary/10">
              <CardContent className="p-3">
                <p className="text-sm text-primary text-center">{transcript}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4">
          {/* Current Job Banner */}
          {currentJob && (
            <MobileCard variant="primary" animate>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-medium">Active Job</span>
                  </div>
                  <h3 className="font-semibold text-lg truncate">{currentJob.customerName}</h3>
                  <p className="text-sm text-muted-foreground truncate">{currentJob.propertyAddress}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => router.push(`/crew/jobs/${currentJob.id}`)}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </div>
            </MobileCard>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            {currentJob ? (
              <>
                <Button
                  size="lg"
                  onClick={() => router.push(`/crew/jobs/${currentJob.id}`)}
                  className="h-20 flex-col gap-2"
                >
                  <Play className="w-6 h-6" />
                  <span className="text-sm">View Job</span>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handleCompleteJob(currentJob.id)}
                  className="h-20 flex-col gap-2"
                >
                  <CheckCircle className="w-6 h-6" />
                  <span className="text-sm">Complete</span>
                </Button>
              </>
            ) : (
              <>
                {nextJob && (
                  <Button
                    size="lg"
                    onClick={() => handleStartJob(nextJob.id)}
                    className="h-20 flex-col gap-2"
                  >
                    <Play className="w-6 h-6" />
                    <span className="text-sm">Start Next</span>
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => router.push('/crew/job-load')}
                  className="h-20 flex-col gap-2"
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-sm">Verify Load</span>
                </Button>
              </>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Package className={`w-6 h-6 mx-auto mb-2 ${stats.equipment.verified ? 'text-primary' : 'text-orange-500'}`} />
                  <p className="text-2xl font-bold">{stats.equipment.verified ? '✓' : '!'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.equipment.verified ? 'Verified' : 'Check'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <CheckCircle className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold">{stats.todayJobs.completed}/{stats.todayJobs.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Jobs Done</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Battery className={`w-6 h-6 mx-auto mb-2 ${stats.vehicle.fuelLevel > 25 ? 'text-primary' : 'text-orange-500'}`} />
                  <p className="text-2xl font-bold">{stats.vehicle.fuelLevel}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Fuel</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Today's Jobs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Today's Jobs</h2>
              <Badge variant="secondary">{todayJobs.length}</Badge>
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
                    <Card
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => router.push(`/crew/jobs/${job.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={getStatusVariant(job.status)}>
                                {job.status.replace('_', ' ')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(new Date(job.scheduledTime))}
                              </span>
                            </div>
                            <h3 className="font-semibold truncate">{job.customerName}</h3>
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {job.propertyAddress}
                            </p>
                            {job.templateName && (
                              <p className="text-xs text-muted-foreground mt-2">
                                {job.templateName} • {job.estimatedDuration} mins
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No jobs scheduled for today</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Next Job Preview */}
          {nextJob && !currentJob && (
            <MobileCard variant="success" animate>
              <h3 className="text-sm font-semibold text-green-500 mb-2">Next Job</h3>
              <p className="font-medium">{nextJob.customerName}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
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
            </MobileCard>
          )}

          {/* Bottom padding for FAB */}
          <div className="h-24" />
        </div>
      </div>

      {/* Voice Command FAB */}
      <MobileFAB
        icon={() => <VoiceCommandButton
          onTranscript={(text) => setTranscript(text)}
          onCommand={handleVoiceCommand}
          size="lg"
          autoSpeak={true}
        />}
        position="bottom-center"
      />
    </MobileContainer>
  );
}
