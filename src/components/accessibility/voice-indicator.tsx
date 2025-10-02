/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/components/accessibility/voice-indicator.tsx
 * phase: 3
 * domain: accessibility
 * purpose: Visual indicator for voice navigation state and audio feedback
 * spec_ref: 007-mvp-intent-driven/contracts/voice-indicator.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: {
 *   states: ['inactive', 'listening', 'processing', 'speaking', 'error'],
 *   transitions: [
 *     'inactive->listening: startListening()',
 *     'listening->processing: voiceDetected()',
 *     'processing->speaking: responseReady()',
 *     'speaking->inactive: speechComplete()',
 *     'any->error: errorOccurred()',
 *     'error->inactive: errorResolved()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "voiceIndicator": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/hooks/use-voice-navigation'
 *   ],
 *   external: ['react'],
 *   supabase: []
 * }
 * exports: ['VoiceIndicator']
 * voice_considerations: Visual feedback for voice interaction states
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/components/accessibility/voice-indicator.test.tsx'
 * }
 * tasks: [
 *   'Create voice state indicator component',
 *   'Add visual animation for voice states',
 *   'Implement accessibility attributes',
 *   'Add keyboard interaction support'
 * ]
 */

'use client';

import { useState, useEffect } from 'react';
import { useVoiceNavigation } from '@/hooks/use-voice-navigation';

type VoiceState = 'inactive' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  className?: string;
}

export function VoiceIndicator({
  position = 'bottom-right',
  size = 'medium',
  showLabel = true,
  className = ''
}: VoiceIndicatorProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('inactive');
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');

  const voiceNav = useVoiceNavigation({
    onCommandProcessed: (command) => {
      setLastCommand(command);
      setVoiceState('processing');
      setTimeout(() => setVoiceState('speaking'), 500);
      setTimeout(() => setVoiceState(voiceNav.isActive ? 'listening' : 'inactive'), 2000);
    },
    onError: () => {
      setVoiceState('error');
      setTimeout(() => setVoiceState('inactive'), 3000);
    }
  });

  // Update voice state based on navigation state
  useEffect(() => {
    if (voiceNav.isActive) {
      setVoiceState(voiceNav.isListening ? 'listening' : 'inactive');
    } else {
      setVoiceState('inactive');
    }
  }, [voiceNav.isActive, voiceNav.isListening]);

  // Pulse animation for listening state
  useEffect(() => {
    if (voiceState === 'listening') {
      setPulseAnimation(true);
      const interval = setInterval(() => {
        setPulseAnimation(prev => !prev);
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setPulseAnimation(false);
    }
  }, [voiceState]);

  const getPositionClasses = () => {
    const positions = {
      'top-left': 'top-4 left-4',
      'top-right': 'top-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'bottom-right': 'bottom-4 right-4'
    };
    return positions[position];
  };

  const getSizeClasses = () => {
    const sizes = {
      small: 'w-8 h-8',
      medium: 'w-12 h-12',
      large: 'w-16 h-16'
    };
    return sizes[size];
  };

  const getStateColor = () => {
    const colors = {
      inactive: 'bg-gray-400',
      listening: 'bg-blue-500',
      processing: 'bg-yellow-500',
      speaking: 'bg-green-500',
      error: 'bg-red-500'
    };
    return colors[voiceState];
  };

  const getStateIcon = () => {
    const icons = {
      inactive: '🔇',
      listening: '🎤',
      processing: '⚡',
      speaking: '🔊',
      error: '❌'
    };
    return icons[voiceState];
  };

  const getStateLabel = () => {
    const labels = {
      inactive: 'Voice navigation off',
      listening: 'Listening for commands',
      processing: 'Processing command',
      speaking: 'Speaking response',
      error: 'Voice error occurred'
    };
    return labels[voiceState];
  };

  const getAriaLabel = () => {
    let label = getStateLabel();
    if (lastCommand && voiceState !== 'inactive') {
      label += `. Last command: ${lastCommand}`;
    }
    if (voiceNav.isActive) {
      label += '. Press Alt+V to toggle, Alt+H for help.';
    } else {
      label += '. Press Alt+V to activate voice navigation.';
    }
    return label;
  };

  const handleClick = () => {
    voiceNav.toggle();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      voiceNav.toggle();
    }
  };

  return (
    <div
      className={`voice-indicator fixed z-40 ${getPositionClasses()} ${className}`}
      role="button"
      tabIndex={0}
      aria-label={getAriaLabel()}
      aria-live="polite"
      aria-atomic="true"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className={`relative ${getSizeClasses()}`}>
        {/* Main indicator circle */}
        <div
          className={`
            w-full h-full rounded-full ${getStateColor()} 
            cursor-pointer transition-all duration-300 ease-in-out
            hover:scale-110 focus:scale-110 focus:outline-none 
            focus:ring-2 focus:ring-white focus:ring-offset-2
            ${pulseAnimation ? 'animate-pulse' : ''}
            shadow-lg hover:shadow-xl
          `}
        >
          {/* Icon */}
          <div className="flex items-center justify-center w-full h-full text-white">
            <span className="text-sm" role="img" aria-hidden="true">
              {getStateIcon()}
            </span>
          </div>

          {/* Pulse rings for listening state */}
          {voiceState === 'listening' && (
            <>
              <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20" />
              <div className="absolute inset-0 rounded-full bg-blue-300 animate-ping opacity-10" 
                   style={{ animationDelay: '0.5s' }} />
            </>
          )}

          {/* Processing spinner */}
          {voiceState === 'processing' && (
            <div className="absolute inset-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Label */}
        {showLabel && (
          <div
            className={`
              absolute ${position.includes('right') ? 'right-full mr-3' : 'left-full ml-3'}
              ${position.includes('top') ? 'top-0' : 'bottom-0'}
              bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap
              opacity-0 group-hover:opacity-100 transition-opacity duration-200
              pointer-events-none z-10
            `}
          >
            {getStateLabel()}
            {lastCommand && voiceState !== 'inactive' && (
              <div className="text-gray-300 text-xs mt-1">
                "{lastCommand}"
              </div>
            )}
          </div>
        )}

        {/* Tooltip on hover */}
        <div
          className={`
            absolute ${position.includes('right') ? 'right-full mr-3' : 'left-full ml-3'}
            ${position.includes('top') ? 'top-0' : 'bottom-0'}
            bg-gray-900 text-white text-xs px-3 py-2 rounded-md whitespace-nowrap
            opacity-0 hover:opacity-100 transition-opacity duration-200 delay-500
            pointer-events-none z-20 max-w-48
          `}
        >
          <div className="font-medium">{getStateLabel()}</div>
          <div className="text-gray-300 mt-1">
            Click or press Alt+V to {voiceNav.isActive ? 'disable' : 'enable'}
          </div>
          {voiceNav.isActive && (
            <div className="text-gray-300 text-xs mt-1">
              Available commands: {voiceNav.availableCommands.slice(0, 2).join(', ')}
              {voiceNav.availableCommands.length > 2 && '...'}
            </div>
          )}
        </div>
      </div>

      {/* Screen reader only status updates */}
      <div className="sr-only" aria-live="assertive">
        {voiceState === 'listening' && 'Voice navigation is listening for commands'}
        {voiceState === 'processing' && `Processing command: ${lastCommand}`}
        {voiceState === 'speaking' && 'Voice navigation is speaking'}
        {voiceState === 'error' && 'Voice navigation error. Please try again.'}
      </div>
    </div>
  );
}

// Additional component for status bar integration
export function VoiceStatusBar() {
  const voiceNav = useVoiceNavigation();

  if (!voiceNav.isActive) {
    return null;
  }

  return (
    <div 
      className="voice-status-bar bg-blue-50 border-l-4 border-blue-400 p-3 text-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center space-x-2">
        <span className="font-medium text-blue-800">Voice Navigation Active</span>
        {voiceNav.isListening && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
            Listening...
          </span>
        )}
      </div>
      {voiceNav.lastCommand && (
        <div className="mt-1 text-blue-700">
          Last command: "{voiceNav.lastCommand}"
        </div>
      )}
      <div className="mt-2 text-blue-600 text-xs">
        Say "what can I do" for help, or press Alt+V to toggle
      </div>
    </div>
  );
}