/**
 * @file /src/domains/vision/components/CostDashboard.tsx
 * @phase 3.4
 * @domain Vision
 * @purpose Cost monitoring dashboard with alerts
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

'use client';

import { useEffect, useState } from 'react';
import CostTrendChart from './CostTrendChart';

interface CostAlert {
  type: 'warning' | 'critical';
  message: string;
  percentageUsed: number;
}

interface BudgetStatus {
  allowed: boolean;
  currentCost: number;
  currentRequests: number;
  remainingBudget: number;
  remainingRequests: number;
  alerts: CostAlert[];
}

interface CostSummary {
  todayCost: number;
  todayRequests: number;
  totalCost: number;
  totalRequests: number;
  averageCostPerRequest: number;
}

interface CostDashboardProps {
  tenantId: string;
  dailyBudgetUsd?: number;
  dailyRequestLimit?: number;
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
  className?: string;
}

export default function CostDashboard({
  tenantId,
  dailyBudgetUsd = 10.0,
  dailyRequestLimit = 100,
  autoRefresh = true,
  refreshIntervalMs = 60000, // 1 minute
  className = ''
}: CostDashboardProps) {
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);

      // Fetch budget status
      const budgetRes = await fetch(
        `/api/vision/cost/budget?tenantId=${tenantId}&dailyBudgetUsd=${dailyBudgetUsd}&dailyRequestLimit=${dailyRequestLimit}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!budgetRes.ok) {
        throw new Error('Failed to fetch budget status');
      }

      const budgetData = await budgetRes.json();
      setBudgetStatus(budgetData.data);

      // Fetch cost summary
      const summaryRes = await fetch(
        `/api/vision/cost/summary?tenantId=${tenantId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!summaryRes.ok) {
        throw new Error('Failed to fetch cost summary');
      }

      const summaryData = await summaryRes.json();
      setCostSummary(summaryData.data.summary);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [tenantId, dailyBudgetUsd, dailyRequestLimit, autoRefresh, refreshIntervalMs]);

  if (isLoading) {
    return (
      <div className={`cost-dashboard ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`cost-dashboard ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!budgetStatus || !costSummary) {
    return null;
  }

  const budgetPercentage = (budgetStatus.currentCost / dailyBudgetUsd) * 100;
  const requestPercentage = (budgetStatus.currentRequests / dailyRequestLimit) * 100;

  return (
    <div className={`cost-dashboard space-y-6 ${className}`}>
      {/* Alerts */}
      {budgetStatus.alerts.length > 0 && (
        <div className="space-y-2">
          {budgetStatus.alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                alert.type === 'critical'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{alert.type === 'critical' ? '🚨' : '⚠️'}</span>
                <p className="font-medium">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Budget Overview */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Daily Budget Status</h3>

        {/* Cost Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Cost Used</span>
            <span className="font-semibold">
              ${budgetStatus.currentCost.toFixed(2)} / ${dailyBudgetUsd.toFixed(2)}
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                budgetPercentage >= 95
                  ? 'bg-red-500'
                  : budgetPercentage >= 80
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {budgetPercentage.toFixed(1)}% used, ${budgetStatus.remainingBudget.toFixed(2)} remaining
          </p>
        </div>

        {/* Request Progress */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Requests Used</span>
            <span className="font-semibold">
              {budgetStatus.currentRequests} / {dailyRequestLimit}
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                requestPercentage >= 95
                  ? 'bg-red-500'
                  : requestPercentage >= 80
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(requestPercentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {requestPercentage.toFixed(1)}% used, {budgetStatus.remainingRequests} remaining
          </p>
        </div>
      </div>

      {/* Cost Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600 mb-1">Today&apos;s Cost</p>
          <p className="text-2xl font-bold">${costSummary.todayCost.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{costSummary.todayRequests} requests</p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600 mb-1">Total Cost</p>
          <p className="text-2xl font-bold">${costSummary.totalCost.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{costSummary.totalRequests} requests</p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600 mb-1">Avg Cost</p>
          <p className="text-2xl font-bold">${costSummary.averageCostPerRequest.toFixed(4)}</p>
          <p className="text-xs text-gray-500">per request</p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600 mb-1">Status</p>
          <p className={`text-2xl font-bold ${budgetStatus.allowed ? 'text-green-600' : 'text-red-600'}`}>
            {budgetStatus.allowed ? 'OK' : 'Limited'}
          </p>
          <p className="text-xs text-gray-500">
            {budgetStatus.allowed ? 'Within budget' : 'Budget exceeded'}
          </p>
        </div>
      </div>

      {/* Cost Trend Chart */}
      <CostTrendChart tenantId={tenantId} days={30} />

      {/* Refresh Button */}
      <div className="text-center mt-6">
        <button
          onClick={fetchData}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          ↻ Refresh Data
        </button>
      </div>
    </div>
  );
}