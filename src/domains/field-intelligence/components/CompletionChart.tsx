/**
 * @file src/domains/field-intelligence/components/CompletionChart.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Job completion metrics visualization
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 250 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface CompletionMetrics {
  totalJobs: number;
  completedJobs: number;
  inProgressJobs: number;
  pendingJobs: number;
  completionRate: number;
  averageCompletionTimeMinutes: number;
  dailyBreakdown?: DailyMetric[];
}

interface DailyMetric {
  date: string;
  completed: number;
  total: number;
}

interface CompletionChartProps {
  userId?: string;
  startDate?: string;
  endDate?: string;
  className?: string;
}

/**
 * CompletionChart - Job completion metrics visualization
 *
 * Features:
 * - Completion rate display
 * - Status breakdown (pie chart representation)
 * - Daily completion trend
 * - Average completion time
 * - Visual progress indicators
 *
 * @example
 * ```tsx
 * <CompletionChart
 *   userId={user.id}
 *   startDate="2025-09-01"
 *   endDate="2025-09-30"
 * />
 * ```
 */
export function CompletionChart({
  userId,
  startDate,
  endDate,
  className = '',
}: CompletionChartProps) {
  const [metrics, setMetrics] = useState<CompletionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, [userId, startDate, endDate]);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `/api/field-intelligence/workflows/analytics?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch completion metrics');
      }

      const data = await response.json();

      if (data.data) {
        setMetrics(data.data.completionMetrics || data.data);
      }
    } catch (err: any) {
      logger.error('Failed to fetch completion metrics', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusPercentage = (count: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes.toFixed(0)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toFixed(0)}m`;
  };

  if (loading) {
    return (
      <div className={`completion-chart ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`completion-chart ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchMetrics}
            className="mt-2 text-red-700 underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={`completion-chart ${className}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No completion data available</p>
        </div>
      </div>
    );
  }

  const completedPct = getStatusPercentage(metrics.completedJobs, metrics.totalJobs);
  const inProgressPct = getStatusPercentage(metrics.inProgressJobs, metrics.totalJobs);
  const pendingPct = getStatusPercentage(metrics.pendingJobs, metrics.totalJobs);

  return (
    <div className={`completion-chart ${className}`}>
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Completion Metrics</h3>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{metrics.completionRate.toFixed(0)}%</p>
            <p className="text-xs text-green-700">Completion Rate</p>
          </div>
          <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">
              {formatDuration(metrics.averageCompletionTimeMinutes)}
            </p>
            <p className="text-xs text-blue-700">Avg. Completion Time</p>
          </div>
        </div>

        {/* Job Counts */}
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div>
            <p className="font-bold text-gray-900">{metrics.totalJobs}</p>
            <p className="text-xs text-gray-600">Total</p>
          </div>
          <div>
            <p className="font-bold text-green-600">{metrics.completedJobs}</p>
            <p className="text-xs text-gray-600">Completed</p>
          </div>
          <div>
            <p className="font-bold text-blue-600">{metrics.inProgressJobs}</p>
            <p className="text-xs text-gray-600">In Progress</p>
          </div>
          <div>
            <p className="font-bold text-gray-600">{metrics.pendingJobs}</p>
            <p className="text-xs text-gray-600">Pending</p>
          </div>
        </div>
      </div>

      {/* Status Breakdown (Bar Chart) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        <h4 className="font-medium text-gray-900 mb-3">Status Breakdown</h4>

        <div className="space-y-3">
          {/* Completed */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Completed</span>
              <span className="font-medium text-gray-900">{completedPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-600 h-3 rounded-full transition-all"
                style={{ width: `${completedPct}%` }}
              ></div>
            </div>
          </div>

          {/* In Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">In Progress</span>
              <span className="font-medium text-gray-900">{inProgressPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${inProgressPct}%` }}
              ></div>
            </div>
          </div>

          {/* Pending */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Pending</span>
              <span className="font-medium text-gray-900">{pendingPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gray-500 h-3 rounded-full transition-all"
                style={{ width: `${pendingPct}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Breakdown */}
      {metrics.dailyBreakdown && metrics.dailyBreakdown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Daily Completion Trend</h4>

          <div className="space-y-2">
            {metrics.dailyBreakdown.map((day) => {
              const dayRate = day.total > 0 ? Math.round((day.completed / day.total) * 100) : 0;
              return (
                <div key={day.date} className="flex items-center gap-3">
                  <div className="text-xs text-gray-600 w-20">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div
                      className="bg-green-600 h-6 rounded-full transition-all"
                      style={{ width: `${dayRate}%` }}
                    ></div>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-900">
                      {day.completed} / {day.total}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-gray-900 w-12 text-right">
                    {dayRate}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}