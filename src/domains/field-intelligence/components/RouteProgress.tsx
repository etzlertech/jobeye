/**
 * @file src/domains/field-intelligence/components/RouteProgress.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Route progress display with ETA and milestone indicators
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 250 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface JobProgress {
  jobId: string;
  jobName: string;
  sequence: number;
  status: 'NOT_STARTED' | 'IN_TRANSIT' | 'ARRIVED' | 'COMPLETED';
  estimatedArrivalTime?: string;
  actualArrivalTime?: string;
  completionTime?: string;
}

interface RouteProgressData {
  totalJobs: number;
  completedJobs: number;
  currentJob?: JobProgress;
  nextJob?: JobProgress;
  jobs: JobProgress[];
  estimatedCompletionTime?: string;
}

interface RouteProgressProps {
  scheduleId: string;
  userId: string;
  onJobClick?: (jobId: string) => void;
  className?: string;
}

/**
 * RouteProgress - Display route progress with ETA
 *
 * Features:
 * - Progress bar visualization
 * - Current and next job display
 * - ETA calculation and display
 * - Job status indicators
 * - Milestone tracking
 *
 * @example
 * ```tsx
 * <RouteProgress
 *   scheduleId={schedule.id}
 *   userId={user.id}
 *   onJobClick={(jobId) => console.log('Job clicked:', jobId)}
 * />
 * ```
 */
export function RouteProgress({
  scheduleId,
  userId,
  onJobClick,
  className = '',
}: RouteProgressProps) {
  const [progressData, setProgressData] = useState<RouteProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProgress();

    // Refresh every 30 seconds
    const interval = setInterval(fetchProgress, 30000);
    return () => clearInterval(interval);
  }, [scheduleId, userId]);

  const fetchProgress = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/field-intelligence/routing/progress?userId=${userId}&scheduleId=${scheduleId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch route progress');
      }

      const data = await response.json();

      if (data.data) {
        setProgressData(data.data);
      }
    } catch (err: any) {
      logger.error('Failed to fetch route progress', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: JobProgress['status']) => {
    switch (status) {
      case 'COMPLETED':
        return '✓';
      case 'ARRIVED':
        return '📍';
      case 'IN_TRANSIT':
        return '🚗';
      case 'NOT_STARTED':
        return '⏱️';
      default:
        return '○';
    }
  };

  const getStatusColor = (status: JobProgress['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-50';
      case 'ARRIVED':
        return 'text-blue-600 bg-blue-50';
      case 'IN_TRANSIT':
        return 'text-yellow-600 bg-yellow-50';
      case 'NOT_STARTED':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateProgress = () => {
    if (!progressData || progressData.totalJobs === 0) return 0;
    return Math.round((progressData.completedJobs / progressData.totalJobs) * 100);
  };

  if (loading && !progressData) {
    return (
      <div className={`route-progress ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`route-progress ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchProgress}
            className="mt-2 text-red-700 underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!progressData) {
    return (
      <div className={`route-progress ${className}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No route progress available</p>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();

  return (
    <div className={`route-progress ${className}`}>
      {/* Progress Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Route Progress</h3>
          <span className="text-sm font-medium text-gray-600">
            {progressData.completedJobs} / {progressData.totalJobs} completed
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div
            className="bg-green-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
            style={{ width: `${progress}%` }}
          >
            {progress > 10 && (
              <span className="text-xs font-bold text-white">{progress}%</span>
            )}
          </div>
        </div>

        {/* ETA */}
        {progressData.estimatedCompletionTime && (
          <p className="text-sm text-gray-600 text-center">
            Estimated completion: {formatTime(progressData.estimatedCompletionTime)}
          </p>
        )}
      </div>

      {/* Current Job */}
      {progressData.currentJob && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
              {progressData.currentJob.sequence}
            </div>
            <div className="flex-1">
              <p className="text-xs text-blue-600 font-medium">CURRENT JOB</p>
              <p className="text-lg font-semibold text-gray-900">
                {progressData.currentJob.jobName}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(progressData.currentJob.status)}`}>
              {getStatusIcon(progressData.currentJob.status)} {progressData.currentJob.status}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
            <div>
              <span className="font-medium">ETA:</span>{' '}
              {formatTime(progressData.currentJob.estimatedArrivalTime)}
            </div>
            {progressData.currentJob.actualArrivalTime && (
              <div>
                <span className="font-medium">Arrived:</span>{' '}
                {formatTime(progressData.currentJob.actualArrivalTime)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next Job */}
      {progressData.nextJob && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-gray-400 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
              {progressData.nextJob.sequence}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">NEXT JOB</p>
              <p className="text-base font-semibold text-gray-900">
                {progressData.nextJob.jobName}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            ETA: {formatTime(progressData.nextJob.estimatedArrivalTime)}
          </p>
        </div>
      )}

      {/* Job List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">All Jobs</h4>
        </div>
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {progressData.jobs.map((job) => (
            <button
              key={job.jobId}
              onClick={() => onJobClick && onJobClick(job.jobId)}
              className="w-full p-3 hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  job.status === 'COMPLETED'
                    ? 'bg-green-600 text-white'
                    : job.status === 'ARRIVED' || job.status === 'IN_TRANSIT'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-700'
                }`}>
                  {job.sequence}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {job.jobName}
                  </p>
                  <p className="text-xs text-gray-500">
                    ETA: {formatTime(job.estimatedArrivalTime)}
                  </p>
                </div>
                <div className="text-lg">
                  {getStatusIcon(job.status)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}