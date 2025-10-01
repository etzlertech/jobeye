/**
 * @file EquipmentChecklist.tsx
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose Equipment checklist with auto-verification from detections
 * @complexity_budget 200
 */

'use client';

import type { EquipmentChecklistItem } from '../services/verification-workflow.service';
import type { DetectedItem } from '@/domains/vision/types';

export interface EquipmentChecklistProps {
  /** Equipment checklist items */
  checklist: EquipmentChecklistItem[];
  /** Detected items (for auto-verification in camera mode) */
  detectedItems: DetectedItem[];
  /** Current mode (camera or manual) */
  mode: 'camera' | 'manual';
  /** Callback for manual item toggle */
  onToggleItem?: (itemId: string) => void;
}

/**
 * Equipment checklist component
 * Auto-checks items in camera mode, allows manual toggle in manual mode
 */
export function EquipmentChecklist({
  checklist,
  detectedItems,
  mode,
  onToggleItem,
}: EquipmentChecklistProps) {
  const requiredItems = checklist.filter(item => item.required);
  const verifiedCount = requiredItems.filter(item => item.verified).length;
  const totalCount = requiredItems.length;
  const isComplete = verifiedCount === totalCount;

  const handleToggle = (itemId: string) => {
    if (mode === 'manual' && onToggleItem) {
      onToggleItem(itemId);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Equipment Checklist
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {verifiedCount} of {totalCount} verified
          </span>
          {isComplete && (
            <span className="text-green-500" aria-label="Complete">
              ✓
            </span>
          )}
        </div>
      </div>

      {/* Mode indicator */}
      <div className="mb-3 text-xs text-gray-500">
        Mode: <span className="font-medium">{mode === 'camera' ? 'Auto-detect' : 'Manual'}</span>
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {checklist.map(item => {
          const detected = detectedItems.some(
            d => d.class_name === item.name && d.confidence_score >= 0.7
          );

          return (
            <div
              key={item.id}
              onClick={() => handleToggle(item.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                item.verified
                  ? 'border-green-500 bg-green-50'
                  : detected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              } ${mode === 'manual' ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            >
              {/* Checkbox */}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  item.verified
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {item.verified && <span className="text-sm font-bold">✓</span>}
              </div>

              {/* Item info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${item.verified ? 'text-green-700' : 'text-gray-900'}`}>
                    {item.name}
                  </span>
                  {item.required && (
                    <span className="text-xs text-red-500">*</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {item.category}
                </div>
              </div>

              {/* Detection indicator (camera mode only) */}
              {mode === 'camera' && detected && !item.verified && (
                <div className="text-xs text-blue-600 font-medium">
                  Detected
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Required items note */}
      <div className="mt-3 text-xs text-gray-500">
        <span className="text-red-500">*</span> Required items
      </div>
    </div>
  );
}
