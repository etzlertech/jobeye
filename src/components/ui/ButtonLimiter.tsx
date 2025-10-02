/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/components/ui/ButtonLimiter.tsx
 * phase: 3
 * domain: ui
 * purpose: Component to enforce maximum 4 buttons per screen constraint
 * spec_ref: 007-mvp-intent-driven/constraints.md
 * complexity_budget: 150
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "render": "$0.00 (no AI calls)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [],
 *   external: ['react', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['ButtonLimiter', 'ButtonLimiterProps']
 * voice_considerations: Voice button always takes one slot
 * test_requirements: {
 *   coverage: 95,
 *   unit_tests: 'tests/components/ui/ButtonLimiter.test.tsx'
 * }
 * tasks: [
 *   'Enforce 4-button maximum per screen',
 *   'Provide overflow dropdown for additional actions',
 *   'Prioritize voice button and critical actions',
 *   'Support different button layouts'
 * ]
 */

'use client';

import React, { useMemo } from 'react';
import { MoreHorizontal, Mic } from 'lucide-react';

export interface ButtonAction {
  id: string;
  label: string;
  icon?: React.ComponentType<any>;
  onClick: () => void;
  priority: 'critical' | 'high' | 'medium' | 'low';
  disabled?: boolean;
  hidden?: boolean;
  isVoice?: boolean;
  className?: string;
}

export interface ButtonLimiterProps {
  actions: ButtonAction[];
  maxVisibleButtons?: number;
  showVoiceButton?: boolean;
  onVoiceCommand?: () => void;
  className?: string;
  buttonSize?: 'sm' | 'md' | 'lg';
  layout?: 'horizontal' | 'grid';
}

export function ButtonLimiter({
  actions,
  maxVisibleButtons = 4,
  showVoiceButton = true,
  onVoiceCommand,
  className = '',
  buttonSize = 'md',
  layout = 'horizontal'
}: ButtonLimiterProps) {
  // Filter out hidden actions and sort by priority
  const filteredActions = useMemo(() => {
    return actions
      .filter(action => !action.hidden)
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }, [actions]);

  // Calculate how many slots we have
  const voiceSlots = showVoiceButton ? 1 : 0;
  const availableSlots = maxVisibleButtons - voiceSlots;
  
  // Need at least one slot for "More" if we have overflow
  const needsMoreButton = filteredActions.length > availableSlots;
  const visibleSlots = needsMoreButton ? availableSlots - 1 : availableSlots;
  
  // Split actions into visible and overflow
  const visibleActions = filteredActions.slice(0, visibleSlots);
  const overflowActions = filteredActions.slice(visibleSlots);

  // Button size classes
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const voiceButtonSizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14'
  };

  // Layout classes
  const layoutClasses = {
    horizontal: 'flex items-center gap-2',
    grid: 'grid grid-cols-2 gap-2'
  };

  const renderButton = (action: ButtonAction, isInDropdown = false) => {
    const Icon = action.icon;
    const baseClasses = `
      inline-flex items-center justify-center gap-2 font-medium rounded-lg
      transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
      ${action.disabled 
        ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400' 
        : 'hover:opacity-90 focus:ring-blue-500'
      }
      ${action.className || 'bg-blue-600 text-white hover:bg-blue-700'}
    `;

    const classes = isInDropdown 
      ? `${baseClasses} w-full justify-start px-4 py-2 text-left text-sm`
      : `${baseClasses} ${sizeClasses[buttonSize]}`;

    return (
      <button
        key={action.id}
        onClick={action.onClick}
        disabled={action.disabled}
        className={classes}
        aria-label={action.label}
      >
        {Icon && (
          <Icon className={isInDropdown ? 'w-4 h-4' : iconSizeClasses[buttonSize]} />
        )}
        <span>{action.label}</span>
      </button>
    );
  };

  return (
    <div className={`relative ${className}`} data-testid="button-limiter">
      <div className={layoutClasses[layout]}>
        {/* Voice Button (always first if enabled) */}
        {showVoiceButton && (
          <button
            onClick={onVoiceCommand}
            className={`
              ${voiceButtonSizeClasses[buttonSize]}
              rounded-full bg-emerald-500 text-white
              flex items-center justify-center
              hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300
              transition-all duration-200
            `}
            aria-label="Voice command"
            data-testid="voice-button"
          >
            <Mic className={iconSizeClasses[buttonSize]} />
          </button>
        )}

        {/* Visible Action Buttons */}
        {visibleActions.map(action => renderButton(action))}

        {/* More Button (if needed) */}
        {needsMoreButton && (
          <div className="relative">
            <button
              className={`
                inline-flex items-center justify-center gap-2 font-medium rounded-lg
                bg-gray-600 text-white hover:bg-gray-700
                focus:outline-none focus:ring-2 focus:ring-gray-300
                transition-all duration-200
                ${sizeClasses[buttonSize]}
              `}
              aria-label="More actions"
              data-testid="more-button"
              onClick={() => {
                // Toggle dropdown (this would be managed by parent component)
              }}
            >
              <MoreHorizontal className={iconSizeClasses[buttonSize]} />
              <span>More</span>
            </button>

            {/* Dropdown Menu */}
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 hidden group-hover:block">
              {overflowActions.map(action => (
                <div key={action.id} className="hover:bg-gray-50">
                  {renderButton(action, true)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Button Count Indicator (for development/testing) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute -top-8 right-0 text-xs text-gray-500">
          {visibleActions.length + voiceSlots + (needsMoreButton ? 1 : 0)}/{maxVisibleButtons} buttons
        </div>
      )}
    </div>
  );
}

// Hook for managing button actions
export function useButtonActions() {
  const [actions, setActions] = React.useState<ButtonAction[]>([]);

  const addAction = React.useCallback((action: ButtonAction) => {
    setActions(prev => [...prev, action]);
  }, []);

  const removeAction = React.useCallback((actionId: string) => {
    setActions(prev => prev.filter(action => action.id !== actionId));
  }, []);

  const updateAction = React.useCallback((actionId: string, updates: Partial<ButtonAction>) => {
    setActions(prev => prev.map(action => 
      action.id === actionId ? { ...action, ...updates } : action
    ));
  }, []);

  const clearActions = React.useCallback(() => {
    setActions([]);
  }, []);

  return {
    actions,
    addAction,
    removeAction,
    updateAction,
    clearActions
  };
}

// Predefined action presets for common scenarios
export const actionPresets = {
  jobDetail: [
    {
      id: 'start',
      label: 'Start Job',
      priority: 'critical' as const,
      onClick: () => console.log('Start job')
    },
    {
      id: 'verify',
      label: 'Verify Load',
      priority: 'high' as const,
      onClick: () => console.log('Verify load')
    },
    {
      id: 'notes',
      label: 'Add Notes',
      priority: 'medium' as const,
      onClick: () => console.log('Add notes')
    },
    {
      id: 'complete',
      label: 'Complete',
      priority: 'critical' as const,
      onClick: () => console.log('Complete job')
    }
  ],
  
  inventory: [
    {
      id: 'add',
      label: 'Add Item',
      priority: 'high' as const,
      onClick: () => console.log('Add item')
    },
    {
      id: 'search',
      label: 'Search',
      priority: 'medium' as const,
      onClick: () => console.log('Search')
    },
    {
      id: 'export',
      label: 'Export',
      priority: 'low' as const,
      onClick: () => console.log('Export')
    },
    {
      id: 'settings',
      label: 'Settings',
      priority: 'low' as const,
      onClick: () => console.log('Settings')
    }
  ]
};