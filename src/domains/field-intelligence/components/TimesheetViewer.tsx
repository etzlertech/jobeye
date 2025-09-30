/**
 * @file src/domains/field-intelligence/components/TimesheetViewer.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Timesheet display with export capabilities
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface TimeEntry {
  id: string;
  jobId: string;
  jobName?: string;
  clockInTime: string;
  clockOutTime?: string;
  totalHours: number;
  overtimeHours: number;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface TimesheetData {
  entries: TimeEntry[];
  totalHours: number;
  totalOvertimeHours: number;
  totalRegularHours: number;
  periodStart: string;
  periodEnd: string;
}

interface TimesheetViewerProps {
  userId: string;
  period?: 'week' | 'biweekly' | 'month';
  startDate?: string;
  endDate?: string;
  className?: string;
}

/**
 * TimesheetViewer - Display and export timesheets
 *
 * Features:
 * - Weekly/biweekly/monthly views
 * - Total hours calculation
 * - Overtime tracking
 * - Approval status display
 * - CSV/PDF/JSON export
 *
 * @example
 * ```tsx
 * <TimesheetViewer
 *   userId={user.id}
 *   period="week"
 *   startDate="2025-09-23"
 *   endDate="2025-09-30"
 * />
 * ```
 */
export function TimesheetViewer({
  userId,
  period = 'week',
  startDate,
  endDate,
  className = '',
}: TimesheetViewerProps) {
  const [timesheetData, setTimesheetData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    fetchTimesheet();
  }, [userId, period, startDate, endDate]);

  const fetchTimesheet = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        userId,
        period,
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `/api/field-intelligence/time/timesheets?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch timesheet');
      }

      const data = await response.json();

      if (data.data) {
        setTimesheetData(data.data);
      }
    } catch (err: any) {
      logger.error('Failed to fetch timesheet', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'json') => {
    setExporting(format);
    setError(null);

    try {
      const params = new URLSearchParams({
        userId,
        period,
        format,
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `/api/field-intelligence/time/timesheets?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to export timesheet');
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timesheet-${userId}-${period}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      logger.info('Timesheet exported', { userId, period, format });
    } catch (err: any) {
      logger.error('Failed to export timesheet', { error: err });
      setError(err.message);
    } finally {
      setExporting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getApprovalStatusColor = (status: TimeEntry['approvalStatus']) => {
    switch (status) {
      case 'APPROVED':
        return 'text-green-600 bg-green-50';
      case 'REJECTED':
        return 'text-red-600 bg-red-50';
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className={`timesheet-viewer ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`timesheet-viewer ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchTimesheet}
            className="mt-2 text-red-700 underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!timesheetData) {
    return (
      <div className={`timesheet-viewer ${className}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No timesheet data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`timesheet-viewer ${className}`}>
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Timesheet</h3>
            <p className="text-sm text-gray-600">
              {formatDate(timesheetData.periodStart)} - {formatDate(timesheetData.periodEnd)}
            </p>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting !== null}
              className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {exporting === 'csv' ? 'Exporting...' : 'CSV'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {exporting === 'pdf' ? 'Exporting...' : 'PDF'}
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={exporting !== null}
              className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {exporting === 'json' ? 'Exporting...' : 'JSON'}
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 text-center border-t border-gray-200 pt-3">
          <div>
            <p className="text-xs text-gray-600">Regular Hours</p>
            <p className="text-xl font-bold text-gray-900">
              {timesheetData.totalRegularHours.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Overtime Hours</p>
            <p className="text-xl font-bold text-orange-600">
              {timesheetData.totalOvertimeHours.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Hours</p>
            <p className="text-xl font-bold text-blue-600">
              {timesheetData.totalHours.toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Time Entries */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">
            Time Entries ({timesheetData.entries.length})
          </h4>
        </div>

        {timesheetData.entries.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No time entries for this period
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {timesheetData.entries.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {entry.jobName || `Job ${entry.jobId.substring(0, 8)}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Clock In: {formatDateTime(entry.clockInTime)}
                    </p>
                    {entry.clockOutTime && (
                      <p className="text-xs text-gray-500">
                        Clock Out: {formatDateTime(entry.clockOutTime)}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <div className={`px-2 py-1 rounded text-xs font-medium mb-2 ${getApprovalStatusColor(entry.approvalStatus)}`}>
                      {entry.approvalStatus}
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      {entry.totalHours.toFixed(1)}h
                    </p>
                    {entry.overtimeHours > 0 && (
                      <p className="text-xs text-orange-600">
                        +{entry.overtimeHours.toFixed(1)}h OT
                      </p>
                    )}
                  </div>
                </div>

                {!entry.clockOutTime && (
                  <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs text-blue-700">
                    🔵 Still clocked in
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}