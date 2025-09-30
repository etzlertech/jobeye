/**
 * @file src/domains/field-intelligence/components/ApprovalQueue.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Time entry approval queue with bulk actions
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface PendingEntry {
  id: string;
  userId: string;
  userName: string;
  jobId: string;
  jobName?: string;
  clockInTime: string;
  clockOutTime?: string;
  totalHours: number;
  overtimeHours: number;
  discrepancyFlags?: string[];
  notes?: string;
}

interface ApprovalQueueProps {
  supervisorId: string;
  onApprove?: (entryIds: string[]) => void;
  onReject?: (entryIds: string[], reason?: string) => void;
  className?: string;
}

/**
 * ApprovalQueue - Time entry approval management
 *
 * Features:
 * - Pending approval display
 * - Bulk approve/reject actions
 * - Discrepancy highlighting
 * - Individual entry details
 * - Notes and comments
 *
 * @example
 * ```tsx
 * <ApprovalQueue
 *   supervisorId={supervisor.id}
 *   onApprove={(ids) => console.log('Approved:', ids)}
 *   onReject={(ids, reason) => console.log('Rejected:', ids, reason)}
 * />
 * ```
 */
export function ApprovalQueue({
  supervisorId,
  onApprove,
  onReject,
  className = '',
}: ApprovalQueueProps) {
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    fetchPendingEntries();
  }, [supervisorId]);

  const fetchPendingEntries = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/field-intelligence/time/approve?supervisorId=${supervisorId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch pending entries');
      }

      const data = await response.json();

      if (data.data) {
        setPendingEntries(data.data);
      }
    } catch (err: any) {
      logger.error('Failed to fetch pending entries', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEntry = (entryId: string) => {
    setSelectedEntries((prev) => {
      const updated = new Set(prev);
      if (updated.has(entryId)) {
        updated.delete(entryId);
      } else {
        updated.add(entryId);
      }
      return updated;
    });
  };

  const handleSelectAll = () => {
    if (selectedEntries.size === pendingEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(pendingEntries.map((e) => e.id)));
    }
  };

  const handleApprove = async (entryIds: string[]) => {
    if (entryIds.length === 0) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/field-intelligence/time/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorId,
          entryIds,
          decision: 'APPROVED',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve entries');
      }

      logger.info('Entries approved', { entryIds, supervisorId });

      // Remove approved entries from list
      setPendingEntries((prev) => prev.filter((e) => !entryIds.includes(e.id)));
      setSelectedEntries(new Set());

      if (onApprove) {
        onApprove(entryIds);
      }
    } catch (err: any) {
      logger.error('Failed to approve entries', { error: err });
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    const entryIds = Array.from(selectedEntries);
    if (entryIds.length === 0) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/field-intelligence/time/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorId,
          entryIds,
          decision: 'REJECTED',
          rejectionReason: rejectReason || 'No reason provided',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject entries');
      }

      logger.info('Entries rejected', { entryIds, supervisorId, reason: rejectReason });

      // Remove rejected entries from list
      setPendingEntries((prev) => prev.filter((e) => !entryIds.includes(e.id)));
      setSelectedEntries(new Set());
      setShowRejectModal(false);
      setRejectReason('');

      if (onReject) {
        onReject(entryIds, rejectReason);
      }
    } catch (err: any) {
      logger.error('Failed to reject entries', { error: err });
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className={`approval-queue ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`approval-queue ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchPendingEntries}
            className="mt-2 text-red-700 underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`approval-queue ${className}`}>
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Approval Queue</h3>
            <p className="text-sm text-gray-600">
              {pendingEntries.length} pending {pendingEntries.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>

          {/* Bulk Actions */}
          {selectedEntries.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(Array.from(selectedEntries))}
                disabled={processing}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                Approve ({selectedEntries.size})
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={processing}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                Reject ({selectedEntries.size})
              </button>
            </div>
          )}
        </div>

        {/* Select All */}
        {pendingEntries.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedEntries.size === pendingEntries.length && pendingEntries.length > 0}
              onChange={handleSelectAll}
              className="rounded border-gray-300"
            />
            Select all
          </label>
        )}
      </div>

      {/* Entries List */}
      {pendingEntries.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No pending approvals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingEntries.map((entry) => (
            <div
              key={entry.id}
              className={`bg-white border rounded-lg p-4 transition-all ${
                selectedEntries.has(entry.id) ? 'border-blue-500 shadow-md' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedEntries.has(entry.id)}
                  onChange={() => handleSelectEntry(entry.id)}
                  className="mt-1 rounded border-gray-300"
                />

                {/* Entry Details */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{entry.userName}</p>
                      <p className="text-sm text-gray-600">
                        {entry.jobName || `Job ${entry.jobId.substring(0, 8)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {entry.totalHours.toFixed(1)}h
                      </p>
                      {entry.overtimeHours > 0 && (
                        <p className="text-sm text-orange-600">
                          +{entry.overtimeHours.toFixed(1)}h OT
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1">
                    <p>Clock In: {formatDateTime(entry.clockInTime)}</p>
                    {entry.clockOutTime && (
                      <p>Clock Out: {formatDateTime(entry.clockOutTime)}</p>
                    )}
                  </div>

                  {/* Discrepancy Flags */}
                  {entry.discrepancyFlags && entry.discrepancyFlags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.discrepancyFlags.map((flag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded"
                        >
                          ⚠️ {flag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {entry.notes && (
                    <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-700">
                      <span className="font-medium">Notes:</span> {entry.notes}
                    </div>
                  )}

                  {/* Individual Actions */}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleApprove([entry.id])}
                      disabled={processing}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEntries(new Set([entry.id]));
                        setShowRejectModal(true);
                      }}
                      disabled={processing}
                      className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Reject Time Entries</h4>
            <p className="text-sm text-gray-600 mb-4">
              Rejecting {selectedEntries.size} {selectedEntries.size === 1 ? 'entry' : 'entries'}. Please provide a reason:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                disabled={processing}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}