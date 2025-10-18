/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/hooks/use-voice-navigation.ts
 * phase: 3
 * domain: accessibility
 * purpose: React hook for integrating voice navigation into UI components
 * spec_ref: 007-mvp-intent-driven/contracts/voice-navigation.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: {
 *   states: ['idle', 'active', 'listening', 'processing'],
 *   transitions: [
 *     'idle->active: activateVoiceNavigation()',
 *     'active->listening: startListening()',
 *     'listening->processing: commandReceived()',
 *     'processing->active: commandProcessed()',
 *     'active->idle: deactivateVoiceNavigation()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "voiceNavigationHook": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/lib/accessibility/voice-navigation'
 *   ],
 *   external: ['react'],
 *   supabase: []
 * }
 * exports: ['useVoiceNavigation', 'VoiceNavigationState']
 * voice_considerations: Primary hook for voice-driven navigation integration
 * test_requirements: {
 *   coverage: 95,
 *   unit_tests: 'tests/hooks/use-voice-navigation.test.ts'
 * }
 * tasks: [
 *   'Create React hook for voice navigation',
 *   'Add component-specific command contexts',
 *   'Implement voice feedback integration',
 *   'Add accessibility state management'
 * ]
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { voiceNavigator } from '@/lib/accessibility/voice-navigation';

export interface VoiceNavigationState {
  isActive: boolean;
  isListening: boolean;
  lastCommand: string | null;
  availableCommands: string[];
  currentContext: string;
}

export interface VoiceNavigationOptions {
  autoActivate?: boolean;
  context?: string;
  customCommands?: Array<{
    command: string;
    handler: () => void;
    description: string;
  }>;
  onCommandProcessed?: (command: string) => void;
  onError?: (error: Error) => void;
}

export function useVoiceNavigation(options: VoiceNavigationOptions = {}) {
  const [state, setState] = useState<VoiceNavigationState>({
    isActive: false,
    isListening: false,
    lastCommand: null,
    availableCommands: [],
    currentContext: options.context || 'default'
  });

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Update available commands when context changes
  useEffect(() => {
    const updateCommands = () => {
      const commands = voiceNavigator.getAvailableCommands();
      const commandStrings = commands.map(cmd => cmd.command);
      
      // Add custom commands
      if (optionsRef.current.customCommands) {
        const customCommandStrings = optionsRef.current.customCommands.map(cmd => cmd.command);
        commandStrings.push(...customCommandStrings);
      }

      setState(prev => ({
        ...prev,
        availableCommands: commandStrings,
        currentContext: optionsRef.current.context || 'default'
      }));
    };

    updateCommands();
  }, [options.context, options.customCommands]);

  // Auto-activate if requested
  useEffect(() => {
    if (options.autoActivate) {
      activateVoiceNavigation();
    }

    return () => {
      if (options.autoActivate) {
        deactivateVoiceNavigation();
      }
    };
  }, [options.autoActivate]);

  // Register custom commands
  useEffect(() => {
    const commands = options.customCommands ?? [];
    if (commands.length === 0) return;

    for (const cmd of commands) {
      voiceNavigator.addCustomCommand({
        command: cmd.command,
        target: `custom:${cmd.command}`,
        description: cmd.description,
        category: 'action'
      });
    }

    return () => {
      for (const cmd of commands) {
        voiceNavigator.removeCustomCommand(cmd.command);
      }
    };
  }, [options.customCommands]);

  const activateVoiceNavigation = useCallback(async () => {
    try {
      await voiceNavigator.activate();
      setState(prev => ({ ...prev, isActive: true }));
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Failed to activate voice navigation');
      optionsRef.current.onError?.(errorObj);
    }
  }, []);

  const deactivateVoiceNavigation = useCallback(async () => {
    try {
      await voiceNavigator.deactivate();
      setState(prev => ({ 
        ...prev, 
        isActive: false, 
        isListening: false,
        lastCommand: null
      }));
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Failed to deactivate voice navigation');
      optionsRef.current.onError?.(errorObj);
    }
  }, []);

  const toggleVoiceNavigation = useCallback(async () => {
    if (state.isActive) {
      await deactivateVoiceNavigation();
    } else {
      await activateVoiceNavigation();
    }
  }, [state.isActive, activateVoiceNavigation, deactivateVoiceNavigation]);

  const announceMessage = useCallback(async (message: string, interrupt = true) => {
    if (state.isActive) {
      try {
        // This would typically use the voice processor to announce
        console.log(`Voice announcement: ${message}`);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Failed to announce message');
        optionsRef.current.onError?.(errorObj);
      }
    }
  }, [state.isActive]);

  const setContext = useCallback((context: string) => {
    setState(prev => ({ ...prev, currentContext: context }));
    voiceNavigator.setCurrentPage(context);
  }, []);

  const getPageDescription = useCallback(() => {
    if (!state.isActive) return '';
    
    const commands = state.availableCommands.slice(0, 3); // Top 3 commands
    return `Available voice commands: ${commands.join(', ')}. Say "what can I do" for all options.`;
  }, [state.availableCommands, state.isActive]);

  const handleCustomCommand = useCallback((command: string) => {
    const customCmd = optionsRef.current.customCommands?.find(
      cmd => cmd.command.toLowerCase() === command.toLowerCase()
    );
    
    if (customCmd) {
      customCmd.handler();
      setState(prev => ({ ...prev, lastCommand: command }));
      optionsRef.current.onCommandProcessed?.(command);
      return true;
    }
    
    return false;
  }, []);

  // Keyboard shortcut support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Alt + V to toggle voice navigation
      if (event.altKey && event.key === 'v') {
        event.preventDefault();
        toggleVoiceNavigation();
      }
      
      // Alt + H for help
      if (event.altKey && event.key === 'h' && state.isActive) {
        event.preventDefault();
        announceMessage(getPageDescription());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleVoiceNavigation, announceMessage, getPageDescription, state.isActive]);

  return {
    // State
    ...state,
    
    // Actions
    activate: activateVoiceNavigation,
    deactivate: deactivateVoiceNavigation,
    toggle: toggleVoiceNavigation,
    announce: announceMessage,
    setContext,
    handleCustomCommand,
    
    // Helpers
    getPageDescription,
    isSupported: voiceNavigator.isNavigationActive !== undefined
  };
}
