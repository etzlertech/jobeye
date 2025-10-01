/**
 * @file OfflineQueueStatus.tsx
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose Offline queue status indicator with 200-record capacity warning
 * @complexity_budget 150
 */

'use client';

export interface OfflineQueueStatusProps {
  /** Number of items in offline queue */
  queueCount: number;
  /** Whether device is currently online */
  isOnline: boolean;
  /** Whether queue is currently syncing */
  isSyncing?: boolean;
}

const MAX_QUEUE_SIZE = 200;
const WARNING_THRESHOLD = 180; // 90% capacity

/**
 * Offline queue status component
 * Shows online/offline status and queue count with capacity warnings
 */
export function OfflineQueueStatus({
  queueCount,
  isOnline,
  isSyncing = false,
}: OfflineQueueStatusProps) {
  const nearCapacity = queueCount > WARNING_THRESHOLD;
  const hasQueuedItems = queueCount > 0;

  // Don't render if online and no queued items
  if (isOnline && !hasQueuedItems && !isSyncing) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 mb-4">
      <div className="flex items-center gap-3">
        {/* Online/Offline indicator */}
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full ${
            isOnline ? 'bg-green-100' : 'bg-red-100'
          }`}
        >
          {isOnline ? (
            <span className="text-green-600 text-xl">📶</span>
          ) : (
            <span className="text-red-600 text-xl">📵</span>
          )}
        </div>

        {/* Status text */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {isSyncing && (
              <span className="text-xs text-blue-600 font-medium animate-pulse">
                Syncing...
              </span>
            )}
          </div>

          {/* Queue count */}
          {hasQueuedItems && (
            <div className="text-xs text-gray-600 mt-1">
              {queueCount} pending verification{queueCount !== 1 ? 's' : ''}
            </div>
          )}

          {/* Capacity warning */}
          {nearCapacity && (
            <div className="flex items-center gap-1 mt-1 text-xs text-yellow-700 font-medium">
              <span>⚠️</span>
              <span>
                Queue nearly full ({queueCount}/{MAX_QUEUE_SIZE})
              </span>
            </div>
          )}
        </div>

        {/* Visual queue indicator */}
        {hasQueuedItems && (
          <div className="flex flex-col items-end">
            <div className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
              {queueCount}
            </div>
            {/* Capacity bar */}
            <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all ${
                  nearCapacity ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min((queueCount / MAX_QUEUE_SIZE) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
