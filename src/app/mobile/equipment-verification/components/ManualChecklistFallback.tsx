/**
 * @file ManualChecklistFallback.tsx
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose Manual tap-to-verify checklist fallback when camera unavailable
 * @complexity_budget 200
 */

'use client';

import type { EquipmentChecklistItem } from '../services/verification-workflow.service';

export interface ManualChecklistFallbackProps {
  /** Equipment checklist items */
  checklist: EquipmentChecklistItem[];
  /** Callback when item toggled */
  onToggleItem: (itemId: string) => void;
}

/**
 * Manual checklist fallback component
 * Used when camera is denied/unavailable
 * Touch targets are minimum 44x44px for accessibility
 */
export function ManualChecklistFallback({
  checklist,
  onToggleItem,
}: ManualChecklistFallbackProps) {
  const requiredItems = checklist.filter(item => item.required);
  const verifiedCount = requiredItems.filter(item => item.verified).length;
  const totalCount = requiredItems.length;

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Equipment Checklist
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Tap each item to verify
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Progress:</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${(verifiedCount / totalCount) * 100}%` }}
            />
          </div>
          <span className="text-gray-900 font-medium">
            {verifiedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          📋 Camera unavailable. Please manually verify each item by tapping the checkbox.
        </p>
      </div>

      {/* Checklist items with large touch targets */}
      <div className="space-y-3">
        {checklist.map(item => (
          <button
            key={item.id}
            onClick={() => onToggleItem(item.id)}
            className={`w-full min-h-[44px] flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
              item.verified
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            {/* Large checkbox (44x44px touch target) */}
            <div
              className={`min-w-[32px] min-h-[32px] w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors ${
                item.verified
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-gray-400 bg-white'
              }`}
            >
              {item.verified ? (
                <span className="text-xl font-bold">✓</span>
              ) : (
                <span className="text-gray-400 text-2xl">○</span>
              )}
            </div>

            {/* Item details */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span
                  className={`font-medium ${
                    item.verified ? 'text-green-700 line-through' : 'text-gray-900'
                  }`}
                >
                  {item.name}
                </span>
                {item.required && (
                  <span className="text-xs font-bold text-red-500">REQUIRED</span>
                )}
              </div>
              <div className="text-xs text-gray-500 capitalize mt-1">
                {item.category}
              </div>
            </div>

            {/* Verified badge */}
            {item.verified && (
              <div className="px-2 py-1 bg-green-500 text-white text-xs font-medium rounded">
                Verified
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Required items:</span>
          <span className="font-medium text-gray-900">
            {requiredItems.filter(i => i.verified).length}/{requiredItems.length}
          </span>
        </div>
      </div>
    </div>
  );
}
