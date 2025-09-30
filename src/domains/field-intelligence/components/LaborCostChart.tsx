/**
 * @file src/domains/field-intelligence/components/LaborCostChart.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Labor utilization and cost analytics visualization
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 250 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface LaborMetrics {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalLaborCost: number;
  regularCost: number;
  overtimeCost: number;
  utilizationRate: number;
  costPerJob: number;
  forecastedMonthlyCost: number;
}

interface LaborCostChartProps {
  userId?: string;
  startDate?: string;
  endDate?: string;
  className?: string;
}

/**
 * LaborCostChart - Labor cost and utilization analytics
 *
 * Features:
 * - Total labor cost display
 * - Regular vs overtime breakdown
 * - Utilization rate visualization
 * - Cost per job metrics
 * - Monthly forecast
 *
 * @example
 * ```tsx
 * <LaborCostChart
 *   userId={user.id}
 *   startDate="2025-09-01"
 *   endDate="2025-09-30"
 * />
 * ```
 */
export function LaborCostChart({
  userId,
  startDate,
  endDate,
  className = '',
}: LaborCostChartProps) {
  const [metrics, setMetrics] = useState<LaborMetrics | null>(null);
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
        `/api/field-intelligence/time/analytics?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch labor metrics');
      }

      const data = await response.json();

      if (data.data) {
        setMetrics(data.data);
      }
    } catch (err: any) {
      logger.error('Failed to fetch labor metrics', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getOvertimePercentage = () => {
    if (!metrics || metrics.totalHours === 0) return 0;
    return Math.round((metrics.overtimeHours / metrics.totalHours) * 100);
  };

  const getUtilizationColor = (rate: number) => {
    if (rate >= 85) return 'text-green-600 bg-green-50';
    if (rate >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className={`labor-cost-chart ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`labor-cost-chart ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
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
      <div className={`labor-cost-chart ${className}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No labor data available</p>
        </div>
      </div>
    );
  }

  const overtimePct = getOvertimePercentage();

  return (
    <div className={`labor-cost-chart ${className}`}>
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Labor Cost Analytics</h3>

        {/* Primary Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">
              {formatCurrency(metrics.totalLaborCost)}
            </p>
            <p className="text-xs text-blue-700 mt-1">Total Labor Cost</p>
          </div>
          <div className={`text-center p-4 border rounded-lg ${getUtilizationColor(metrics.utilizationRate)}`}>
            <p className={`text-3xl font-bold ${getUtilizationColor(metrics.utilizationRate).split(' ')[0]}`}>
              {metrics.utilizationRate.toFixed(0)}%
            </p>
            <p className={`text-xs mt-1 ${getUtilizationColor(metrics.utilizationRate).split(' ')[0]}`}>
              Utilization Rate
            </p>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <p className="font-bold text-gray-900">{formatCurrency(metrics.costPerJob)}</p>
            <p className="text-xs text-gray-600">Cost per Job</p>
          </div>
          <div>
            <p className="font-bold text-gray-900">
              {formatCurrency(metrics.forecastedMonthlyCost)}
            </p>
            <p className="text-xs text-gray-600">Monthly Forecast</p>
          </div>
        </div>
      </div>

      {/* Hours Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        <h4 className="font-medium text-gray-900 mb-3">Hours Breakdown</h4>

        <div className="space-y-3">
          {/* Total Hours */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Total Hours</span>
              <span className="font-medium text-gray-900">{metrics.totalHours.toFixed(1)}h</span>
            </div>
          </div>

          {/* Regular Hours */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Regular Hours</span>
              <span className="font-medium text-gray-900">{metrics.regularHours.toFixed(1)}h</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${(metrics.regularHours / metrics.totalHours) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Overtime Hours */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Overtime Hours</span>
              <span className="font-medium text-orange-600">
                {metrics.overtimeHours.toFixed(1)}h ({overtimePct}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-orange-600 h-3 rounded-full transition-all"
                style={{ width: `${overtimePct}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Cost Breakdown</h4>

        <div className="space-y-3">
          {/* Regular Cost */}
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
            <div>
              <p className="text-sm font-medium text-gray-900">Regular Pay</p>
              <p className="text-xs text-gray-600">{metrics.regularHours.toFixed(1)} hours</p>
            </div>
            <p className="text-lg font-bold text-blue-600">
              {formatCurrency(metrics.regularCost)}
            </p>
          </div>

          {/* Overtime Cost */}
          <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded">
            <div>
              <p className="text-sm font-medium text-gray-900">Overtime Pay</p>
              <p className="text-xs text-gray-600">{metrics.overtimeHours.toFixed(1)} hours</p>
            </div>
            <p className="text-lg font-bold text-orange-600">
              {formatCurrency(metrics.overtimeCost)}
            </p>
          </div>

          {/* Warning for High Overtime */}
          {overtimePct > 20 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-xs text-yellow-800">
              <p className="font-medium">⚠️ High Overtime Alert</p>
              <p className="mt-1">
                Overtime is {overtimePct}% of total hours. Consider scheduling optimization to
                reduce labor costs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}