/**
 * @file /src/app/vision/admin/page.tsx
 * @phase 3.4
 * @domain Vision
 * @purpose Admin dashboard for vision system analytics and management
 * @complexity_budget 400
 * @test_coverage ≥80%
 */

'use client';

import { useState, useEffect } from 'react';
import CostTrendChart from '@/domains/vision/components/CostTrendChart';

interface CompanyStats {
  tenantId: string;
  companyName: string;
  totalVerifications: number;
  totalCost: number;
  successRate: number;
  avgProcessingTime: number;
  yoloPercentage: number;
  vlmPercentage: number;
}

interface SystemStats {
  totalCompanies: number;
  totalVerifications: number;
  totalCost: number;
  avgSuccessRate: number;
  totalYoloVerifications: number;
  totalVlmVerifications: number;
}

export default function VisionAdminPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'companies' | 'performance'>('overview');
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // days

  useEffect(() => {
    fetchAdminData();
  }, [dateRange]);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      // In production, these would be real API calls
      // Mock data for demonstration
      setSystemStats({
        totalCompanies: 12,
        totalVerifications: 1547,
        totalCost: 47.23,
        avgSuccessRate: 0.87,
        totalYoloVerifications: 1423,
        totalVlmVerifications: 124
      });

      setCompanyStats([
        {
          tenantId: 'company-1',
          companyName: 'Acme Corp',
          totalVerifications: 432,
          totalCost: 12.45,
          successRate: 0.92,
          avgProcessingTime: 245,
          yoloPercentage: 0.94,
          vlmPercentage: 0.06
        },
        {
          tenantId: 'company-2',
          companyName: 'TechStart Inc',
          totalVerifications: 287,
          totalCost: 8.91,
          successRate: 0.85,
          avgProcessingTime: 312,
          yoloPercentage: 0.89,
          vlmPercentage: 0.11
        },
        {
          tenantId: 'company-3',
          companyName: 'BuildCo',
          totalVerifications: 198,
          totalCost: 6.12,
          successRate: 0.88,
          avgProcessingTime: 198,
          yoloPercentage: 0.96,
          vlmPercentage: 0.04
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Vision Admin Dashboard</h1>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <p className="text-gray-600">System-wide analytics and monitoring</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            System Overview
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'companies'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Company Analytics
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'performance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Performance Metrics
          </button>
        </div>

        {/* System Overview Tab */}
        {activeTab === 'overview' && systemStats && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-1">Total Companies</p>
                <p className="text-3xl font-bold text-gray-900">{systemStats.totalCompanies}</p>
              </div>
              <div className="bg-white border rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-1">Total Verifications</p>
                <p className="text-3xl font-bold text-blue-600">{systemStats.totalVerifications}</p>
              </div>
              <div className="bg-white border rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-1">Total Cost</p>
                <p className="text-3xl font-bold text-green-600">${systemStats.totalCost.toFixed(2)}</p>
              </div>
              <div className="bg-white border rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-1">Avg Success Rate</p>
                <p className="text-3xl font-bold text-purple-600">
                  {(systemStats.avgSuccessRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Processing Method Distribution */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Processing Method Distribution</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Local YOLO</span>
                    <span className="text-sm font-bold">{systemStats.totalYoloVerifications}</span>
                  </div>
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{
                        width: `${(systemStats.totalYoloVerifications / systemStats.totalVerifications) * 100}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {((systemStats.totalYoloVerifications / systemStats.totalVerifications) * 100).toFixed(1)}% of total
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Cloud VLM</span>
                    <span className="text-sm font-bold">{systemStats.totalVlmVerifications}</span>
                  </div>
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${(systemStats.totalVlmVerifications / systemStats.totalVerifications) * 100}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {((systemStats.totalVlmVerifications / systemStats.totalVerifications) * 100).toFixed(1)}% of total
                  </p>
                </div>
              </div>
            </div>

            {/* System-wide Cost Trend */}
            <div className="bg-white border rounded-lg p-6">
              <CostTrendChart tenantId="all-companies" days={parseInt(dateRange)} />
            </div>
          </div>
        )}

        {/* Company Analytics Tab */}
        {activeTab === 'companies' && (
          <div className="space-y-4">
            {companyStats.map((company) => (
              <div key={company.tenantId} className="bg-white border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{company.companyName}</h3>
                    <p className="text-sm text-gray-500">{company.tenantId}</p>
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    View Details
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Verifications</p>
                    <p className="text-xl font-bold">{company.totalVerifications}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total Cost</p>
                    <p className="text-xl font-bold text-green-600">${company.totalCost.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Success Rate</p>
                    <p className="text-xl font-bold text-purple-600">
                      {(company.successRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Avg Time</p>
                    <p className="text-xl font-bold text-blue-600">{company.avgProcessingTime}ms</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      YOLO: <span className="font-semibold">{(company.yoloPercentage * 100).toFixed(1)}%</span>
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-600">
                      VLM: <span className="font-semibold">{(company.vlmPercentage * 100).toFixed(1)}%</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Performance Metrics Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">System Performance</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">YOLO Processing Time</span>
                    <span className="text-sm font-bold">~200ms avg</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: '85%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">VLM Processing Time</span>
                    <span className="text-sm font-bold">~1200ms avg</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Budget Compliance</span>
                    <span className="text-sm font-bold">98.5%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: '98.5%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border rounded-lg p-6">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">System Uptime</h4>
                <p className="text-3xl font-bold text-green-600">99.97%</p>
                <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
              </div>

              <div className="bg-white border rounded-lg p-6">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">Avg API Response</h4>
                <p className="text-3xl font-bold text-blue-600">342ms</p>
                <p className="text-xs text-gray-500 mt-1">Including processing</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}