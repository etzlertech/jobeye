/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/components/ui/ItemChecklist.tsx
 * phase: 3
 * domain: ui
 * purpose: Interactive checklist component for equipment load verification
 * spec_ref: 007-mvp-intent-driven/contracts/ui-components.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: {
 *   states: ['unchecked', 'verified', 'missing', 'manual_override'],
 *   transitions: [
 *     'unchecked->verified: aiDetection()',
 *     'unchecked->manual_override: userCheck()',
 *     'verified->missing: userOverride()',
 *     'missing->verified: userCorrection()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "render": "$0.00 (no AI calls)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [],
 *   external: ['react', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['ItemChecklist', 'ItemChecklistProps', 'ChecklistItem']
 * voice_considerations: Voice commands can check/uncheck items
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/components/ui/ItemChecklist.test.tsx'
 * }
 * tasks: [
 *   'Create interactive checklist with visual feedback',
 *   'Support AI verification results',
 *   'Add manual override capabilities',
 *   'Include confidence indicators'
 * ]
 */

'use client';

import React, { useState, useCallback } from 'react';
import { 
  Check, 
  X, 
  Camera, 
  Eye, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Clock,
  Mic
} from 'lucide-react';

export interface ChecklistItem {
  id: string;
  name: string;
  category?: string;
  thumbnailUrl?: string;
  required: boolean;
  status: 'unchecked' | 'verified' | 'missing' | 'manual_override';
  confidence?: number; // AI confidence 0-1
  detectionMethod?: 'ai' | 'manual' | 'voice';
  notes?: string;
}

export interface ItemChecklistProps {
  items: ChecklistItem[];
  onItemToggle: (itemId: string, checked: boolean, method: 'manual' | 'voice') => void;
  onItemMissing: (itemId: string, notes?: string) => void;
  isOffline?: boolean;
  showConfidence?: boolean;
  allowManualOverride?: boolean;
  onVoiceCommand?: (command: string) => void;
  className?: string;
}

export function ItemChecklist({
  items,
  onItemToggle,
  onItemMissing,
  isOffline = false,
  showConfidence = true,
  allowManualOverride = true,
  onVoiceCommand,
  className = ''
}: ItemChecklistProps) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [missingNotes, setMissingNotes] = useState<Record<string, string>>({});

  const handleItemClick = useCallback((item: ChecklistItem) => {
    if (!allowManualOverride && item.status === 'verified') {
      return; // Can't override AI verification if not allowed
    }

    const newStatus = item.status === 'verified' || item.status === 'manual_override' 
      ? 'unchecked' 
      : 'manual_override';
    
    onItemToggle(item.id, newStatus !== 'unchecked', 'manual');
  }, [allowManualOverride, onItemToggle]);

  const handleMarkMissing = useCallback((itemId: string) => {
    const notes = missingNotes[itemId] || '';
    onItemMissing(itemId, notes);
    setMissingNotes(prev => ({ ...prev, [itemId]: '' }));
    setSelectedItem(null);
  }, [missingNotes, onItemMissing]);

  const getStatusIcon = (item: ChecklistItem) => {
    switch (item.status) {
      case 'verified':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'manual_override':
        return <Check className="w-5 h-5 text-blue-600" />;
      case 'missing':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (item: ChecklistItem) => {
    switch (item.status) {
      case 'verified':
        return 'border-emerald-200 bg-emerald-50';
      case 'manual_override':
        return 'border-blue-200 bg-blue-50';
      case 'missing':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-white hover:bg-gray-50';
    }
  };

  const getMethodBadge = (item: ChecklistItem) => {
    if (!item.detectionMethod) return null;

    const badgeConfig = {
      ai: { icon: Camera, label: 'AI', color: 'bg-purple-100 text-purple-800' },
      manual: { icon: Eye, label: 'Manual', color: 'bg-blue-100 text-blue-800' },
      voice: { icon: Mic, label: 'Voice', color: 'bg-green-100 text-green-800' }
    };

    const config = badgeConfig[item.detectionMethod];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const requiredItems = items.filter(item => item.required);
  const optionalItems = items.filter(item => !item.required);
  const verifiedCount = items.filter(item => 
    item.status === 'verified' || item.status === 'manual_override'
  ).length;
  const missingCount = items.filter(item => item.status === 'missing').length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Header */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Equipment Verification</h3>
          {onVoiceCommand && (
            <button
              onClick={() => onVoiceCommand('verify equipment')}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-full transition-colors"
              aria-label="Voice verify equipment"
              title="Use voice to verify equipment"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{verifiedCount}</div>
            <div className="text-gray-600">Verified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{missingCount}</div>
            <div className="text-gray-600">Missing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              {items.length - verifiedCount - missingCount}
            </div>
            <div className="text-gray-600">Unchecked</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(verifiedCount / items.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1 text-center">
            {Math.round((verifiedCount / items.length) * 100)}% Complete
          </p>
        </div>

        {/* Offline Warning */}
        {isOffline && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                AI verification unavailable offline - manual verification only
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Required Items */}
      {requiredItems.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Required Equipment ({requiredItems.length})
          </h4>
          <div className="space-y-2">
            {requiredItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onItemClick={handleItemClick}
                onMarkMissing={handleMarkMissing}
                showConfidence={showConfidence}
                allowManualOverride={allowManualOverride}
                isSelected={selectedItem === item.id}
                onSelect={setSelectedItem}
                missingNotes={missingNotes}
                onNotesChange={setMissingNotes}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                getMethodBadge={getMethodBadge}
              />
            ))}
          </div>
        </div>
      )}

      {/* Optional Items */}
      {optionalItems.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">
            Optional Equipment ({optionalItems.length})
          </h4>
          <div className="space-y-2">
            {optionalItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onItemClick={handleItemClick}
                onMarkMissing={handleMarkMissing}
                showConfidence={showConfidence}
                allowManualOverride={allowManualOverride}
                isSelected={selectedItem === item.id}
                onSelect={setSelectedItem}
                missingNotes={missingNotes}
                onNotesChange={setMissingNotes}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                getMethodBadge={getMethodBadge}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Individual item row component
interface ItemRowProps {
  item: ChecklistItem;
  onItemClick: (item: ChecklistItem) => void;
  onMarkMissing: (itemId: string) => void;
  showConfidence: boolean;
  allowManualOverride: boolean;
  isSelected: boolean;
  onSelect: (itemId: string | null) => void;
  missingNotes: Record<string, string>;
  onNotesChange: (notes: Record<string, string>) => void;
  getStatusIcon: (item: ChecklistItem) => React.ReactNode;
  getStatusColor: (item: ChecklistItem) => string;
  getMethodBadge: (item: ChecklistItem) => React.ReactNode;
}

function ItemRow({
  item,
  onItemClick,
  onMarkMissing,
  showConfidence,
  allowManualOverride,
  isSelected,
  onSelect,
  missingNotes,
  onNotesChange,
  getStatusIcon,
  getStatusColor,
  getMethodBadge
}: ItemRowProps) {
  return (
    <div className={`border rounded-lg p-3 transition-all duration-200 ${getStatusColor(item)}`}>
      <div className="flex items-center gap-3">
        {/* Item Thumbnail */}
        <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-5 h-5 text-gray-400" />
            </div>
          )}
        </div>

        {/* Item Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="font-medium text-gray-900 truncate">{item.name}</h5>
            {item.required && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                Required
              </span>
            )}
          </div>
          
          {item.category && (
            <p className="text-sm text-gray-600">{item.category}</p>
          )}

          {/* Method and Confidence */}
          <div className="flex items-center gap-2 mt-2">
            {getMethodBadge(item)}
            
            {showConfidence && item.confidence !== undefined && (
              <div className="flex items-center gap-1">
                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      item.confidence > 0.8 ? 'bg-emerald-400' :
                      item.confidence > 0.6 ? 'bg-yellow-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${item.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {Math.round(item.confidence * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
            <p className="text-xs text-gray-600 mt-1 italic">"{item.notes}"</p>
          )}
        </div>

        {/* Status Icon and Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onItemClick(item)}
            disabled={!allowManualOverride && item.status === 'verified'}
            className={`p-2 rounded-full transition-colors ${
              allowManualOverride || item.status !== 'verified'
                ? 'hover:bg-gray-200 cursor-pointer'
                : 'cursor-not-allowed opacity-50'
            }`}
            aria-label={`Toggle ${item.name} verification`}
            data-item-id={item.id}
          >
            {getStatusIcon(item)}
          </button>

          {/* Missing Button */}
          {item.status !== 'missing' && (
            <button
              onClick={() => onSelect(isSelected ? null : item.id)}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              aria-label={`Mark ${item.name} as missing`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Missing Notes Input */}
      {isSelected && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Why is this item missing?
          </label>
          <textarea
            value={missingNotes[item.id] || ''}
            onChange={(e) => onNotesChange(prev => ({ ...prev, [item.id]: e.target.value }))}
            placeholder="Optional notes about missing item..."
            className="w-full p-2 border border-gray-300 rounded-lg text-sm resize-none"
            rows={2}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onMarkMissing(item.id)}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Mark Missing
            </button>
            <button
              onClick={() => onSelect(null)}
              className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}