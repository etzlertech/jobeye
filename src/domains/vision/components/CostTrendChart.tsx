/**
 * @file /src/domains/vision/components/CostTrendChart.tsx
 * @phase 3.4
 * @domain Vision
 * @purpose Cost trend visualization with historical data
 * @complexity_budget 400
 * @test_coverage ≥80%
 */

'use client';

import { useState, useEffect } from 'react';

interface CostDataPoint {
  date: string;
  cost: number;
  requests: number;
}

interface CostTrendChartProps {
  companyId: string;
  days?: number; // Number of days to show (default 30)
  className?: string;
}

export default function CostTrendChart({
  companyId,
  days = 30,
  className = ''
}: CostTrendChartProps) {
  const [data, setData] = useState<CostDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'cost' | 'requests'>('cost');

  useEffect(() => {
    fetchCostTrends();
  }, [companyId, days]);

  const fetchCostTrends = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const response = await fetch(
        `/api/vision/cost/summary?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}&breakdown=daily`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch cost trends');
      }

      const result = await response.json();
      const dailyData = result.data?.dailyBreakdown || [];

      // Transform to chart data
      const chartData: CostDataPoint[] = dailyData.map((item: any) => ({
        date: item.date,
        cost: item.totalCost,
        requests: item.requestCount
      }));

      setData(chartData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate chart dimensions
  const maxValue = chartType === 'cost'
    ? Math.max(...data.map(d => d.cost), 1)
    : Math.max(...data.map(d => d.requests), 1);

  const chartHeight = 250;
  const chartWidth = 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Generate SVG path for line chart
  const generateLinePath = (): string => {
    if (data.length === 0) return '';

    const points = data.map((point, index) => {
      const x = padding.left + (index / (data.length - 1 || 1)) * innerWidth;
      const value = chartType === 'cost' ? point.cost : point.requests;
      const y = padding.top + innerHeight - (value / maxValue) * innerHeight;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  // Generate area path (filled)
  const generateAreaPath = (): string => {
    if (data.length === 0) return '';

    const linePath = generateLinePath();
    const lastX = padding.left + innerWidth;
    const bottomY = padding.top + innerHeight;
    const firstX = padding.left;

    return `${linePath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Format value
  const formatValue = (value: number): string => {
    return chartType === 'cost' ? `$${value.toFixed(2)}` : value.toString();
  };

  // Calculate statistics
  const totalCost = data.reduce((sum, d) => sum + d.cost, 0);
  const totalRequests = data.reduce((sum, d) => sum + d.requests, 0);
  const avgDailyCost = data.length > 0 ? totalCost / data.length : 0;
  const avgDailyRequests = data.length > 0 ? totalRequests / data.length : 0;

  if (isLoading) {
    return (
      <div className={`cost-trend-chart ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`cost-trend-chart ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading cost trends: {error}</p>
          <button
            onClick={fetchCostTrends}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`cost-trend-chart ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Cost Trends - Last {days} Days</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('cost')}
            className={`px-3 py-1 text-sm rounded ${
              chartType === 'cost'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Cost ($)
          </button>
          <button
            onClick={() => setChartType('requests')}
            className={`px-3 py-1 text-sm rounded ${
              chartType === 'requests'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Requests (#)
          </button>
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-600 mb-1">Total Cost</p>
          <p className="text-lg font-bold text-blue-900">${totalCost.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs text-green-600 mb-1">Avg Daily Cost</p>
          <p className="text-lg font-bold text-green-900">${avgDailyCost.toFixed(2)}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-xs text-purple-600 mb-1">Total Requests</p>
          <p className="text-lg font-bold text-purple-900">{totalRequests}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-xs text-orange-600 mb-1">Avg Daily Requests</p>
          <p className="text-lg font-bold text-orange-900">{Math.round(avgDailyRequests)}</p>
        </div>
      </div>

      {/* Chart */}
      {data.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No cost data available for the selected period</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg p-4">
          <svg
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="overflow-visible"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + innerHeight * (1 - ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + innerWidth}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#6b7280"
                  >
                    {formatValue(maxValue * ratio)}
                  </text>
                </g>
              );
            })}

            {/* Area (filled) */}
            <path
              d={generateAreaPath()}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="none"
            />

            {/* Line */}
            <path
              d={generateLinePath()}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {data.map((point, index) => {
              const x = padding.left + (index / (data.length - 1 || 1)) * innerWidth;
              const value = chartType === 'cost' ? point.cost : point.requests;
              const y = padding.top + innerHeight - (value / maxValue) * innerHeight;

              return (
                <g key={index}>
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <title>
                    {formatDate(point.date)}: {formatValue(value)}
                  </title>
                </g>
              );
            })}

            {/* X-axis labels (show every 5th day) */}
            {data.map((point, index) => {
              if (index % Math.ceil(data.length / 6) !== 0) return null;

              const x = padding.left + (index / (data.length - 1 || 1)) * innerWidth;
              const y = padding.top + innerHeight + 20;

              return (
                <text
                  key={index}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {formatDate(point.date)}
                </text>
              );
            })}

            {/* Axes */}
            <line
              x1={padding.left}
              y1={padding.top + innerHeight}
              x2={padding.left + innerWidth}
              y2={padding.top + innerHeight}
              stroke="#9ca3af"
              strokeWidth="1"
            />
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + innerHeight}
              stroke="#9ca3af"
              strokeWidth="1"
            />
          </svg>
        </div>
      )}
    </div>
  );
}