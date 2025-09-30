/**
 * @file /src/domains/vision/components/OfflineQueueStatus.tsx
 * @phase 3.4
 * @domain Vision
 * @purpose Display offline queue status and manual sync control
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

'use client';

import { useState, useEffect } from 'react';
import { getOfflineQueue, QueuedVerification } from '../lib/offline-queue';

interface OfflineQueueStatusProps {
  className?: string;
}

export default function OfflineQueueStatus({ className = '' }: OfflineQueueStatusProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedVerification[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    processed: number;
    succeeded: number;
    failed: number;
  } | null>(null);

  const offlineQueue = getOfflineQueue();

  // Load queue status
  const loadQueue = async () => {
    try {
      const items = await offlineQueue.getAll();
      setQueue(items);
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  };

  // Check online status
  const checkOnlineStatus = () => {
    setIsOnline(offlineQueue.getIsOnline());
  };

  // Manual sync
  const handleSync = async () => {
    setIsProcessing(true);
    try {
      const result = await offlineQueue.processQueue();
      setLastSyncResult(result);
      await loadQueue();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear completed items
  const handleClearCompleted = async () => {
    try {
      await offlineQueue.clearCompleted();
      await loadQueue();
    } catch (error) {
      console.error('Failed to clear completed:', error);
    }
  };

  // Auto-refresh queue status
  useEffect(() => {
    loadQueue();
    checkOnlineStatus();

    const interval = setInterval(() => {
      loadQueue();
      checkOnlineStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const pendingCount = queue.filter(v => v.status === 'pending').length;
  const processingCount = queue.filter(v => v.status === 'processing').length;
  const failedCount = queue.filter(v => v.status === 'failed').length;
  const completedCount = queue.filter(v => v.status === 'completed').length;

  return (
    <div className={`offline-queue-status ${className}`}>
      {/* Connection Status */}
      <div className={`p-4 rounded-lg border-2 mb-4 ${
        isOnline
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${
              isOnline ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
            }`} />
            <div>
              <p className="font-semibold">
                {isOnline ? 'Online' : 'Offline'}
              </p>
              <p className="text-sm text-gray-600">
                {isOnline
                  ? 'Auto-sync enabled'
                  : 'Verifications will be queued for later'}
              </p>
            </div>
          </div>

          {isOnline && pendingCount > 0 && (
            <button
              onClick={handleSync}
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {isProcessing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      </div>

      {/* Last Sync Result */}
      {lastSyncResult && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 text-sm">
          <p className="font-medium text-blue-800">Last Sync:</p>
          <p className="text-blue-700">
            Processed: {lastSyncResult.processed} |
            Success: {lastSyncResult.succeeded} |
            Failed: {lastSyncResult.failed}
          </p>
        </div>
      )}

      {/* Queue Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 border rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-600 mb-1">Processing</p>
          <p className="text-2xl font-bold text-blue-900">{processingCount}</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-600 mb-1">Failed</p>
          <p className="text-2xl font-bold text-red-900">{failedCount}</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs text-green-600 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-900">{completedCount}</p>
        </div>
      </div>

      {/* Queue Items */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Queued Items</h4>
            {completedCount > 0 && (
              <button
                onClick={handleClearCompleted}
                className="text-xs text-gray-600 hover:text-gray-800 underline"
              >
                Clear Completed
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border text-sm ${
                  item.status === 'completed' ? 'bg-green-50 border-green-200' :
                  item.status === 'failed' ? 'bg-red-50 border-red-200' :
                  item.status === 'processing' ? 'bg-blue-50 border-blue-200' :
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">Kit: {item.kitId}</p>
                    <p className="text-xs text-gray-600">
                      Queued: {new Date(item.queuedAt).toLocaleString()}
                    </p>
                    {item.attempts > 0 && (
                      <p className="text-xs text-gray-600">
                        Attempts: {item.attempts}
                      </p>
                    )}
                    {item.error && (
                      <p className="text-xs text-red-600 mt-1">
                        Error: {item.error}
                      </p>
                    )}
                  </div>

                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.status === 'completed' ? 'bg-green-200 text-green-800' :
                    item.status === 'failed' ? 'bg-red-200 text-red-800' :
                    item.status === 'processing' ? 'bg-blue-200 text-blue-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {queue.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No items in queue
        </div>
      )}
    </div>
  );
}