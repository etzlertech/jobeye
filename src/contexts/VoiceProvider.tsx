/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/contexts/VoiceProvider.tsx
 * phase: 3
 * domain: voice
 * purpose: Global voice provider to initialize and manage voice services
 * spec_ref: 007-mvp-intent-driven/contracts/voice-navigation.md
 * complexity_budget: 150
 * migrations_touched: []
 * state_machine: {
 *   states: ['initializing', 'ready', 'listening', 'processing', 'error'],
 *   transitions: [
 *     'initializing->ready: servicesInitialized()',
 *     'ready->listening: startListening()',
 *     'listening->processing: commandDetected()',
 *     'processing->ready: commandProcessed()',
 *     'any->error: errorOccurred()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "voice": "$0.00 (local processing)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/lib/voice/voice-processor',
 *     '@/lib/accessibility/voice-navigation'
 *   ],
 *   external: ['react'],
 *   supabase: []
 * }
 * exports: ['VoiceProvider', 'useVoice']
 * voice_considerations: Central management of all voice functionality
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'src/contexts/__tests__/VoiceProvider.test.tsx'
 * }
 * tasks: [
 *   'Initialize voice services on app load',
 *   'Provide voice context to all components',
 *   'Handle global voice state management',
 *   'Connect voice processor to UI'
 * ]
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { voiceProcessor } from '@/lib/voice/voice-processor';
import { voiceNavigator } from '@/lib/accessibility/voice-navigation';
import { useRouter, usePathname } from 'next/navigation';

interface VoiceState {
  isEnabled: boolean;
  isListening: boolean;
  isProcessing: boolean;
  lastCommand: string | null;
  lastError: string | null;
  transcript: string;
  isNavigationActive: boolean;
}

interface VoiceContextValue extends VoiceState {
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleVoiceNavigation: () => Promise<void>;
  processCommand: (command: string) => Promise<void>;
  speak: (text: string) => Promise<void>;
}

const VoiceContext = createContext<VoiceContextValue | undefined>(undefined);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const recognitionRef = useRef<any>(null);

  const [voiceState, setVoiceState] = useState<VoiceState>({
    isEnabled: false,
    isListening: false,
    isProcessing: false,
    lastCommand: null,
    lastError: null,
    transcript: '',
    isNavigationActive: false
  });

  // Initialize voice services on mount
  useEffect(() => {
    const initializeVoice = async () => {
      try {
        // Check if browser supports speech recognition
        if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
          throw new Error('Speech recognition not supported in this browser');
        }

        // Initialize voice processor
        await voiceProcessor.initialize();

        // Set up voice processor callbacks
        voiceProcessor.onTranscriptUpdate((transcript) => {
          setVoiceState(prev => ({ ...prev, transcript }));
        });

        voiceProcessor.onCommandProcessed((result) => {
          setVoiceState(prev => ({
            ...prev,
            lastCommand: result.command,
            isProcessing: false
          }));

          // Handle navigation commands
          if (result.action?.type === 'navigate' && result.action.target) {
            router.push(result.action.target);
          }
        });

        voiceProcessor.onError((error) => {
          setVoiceState(prev => ({
            ...prev,
            lastError: error,
            isListening: false,
            isProcessing: false
          }));
        });

        // Initialize voice navigator
        voiceNavigator.setRouter((path: string) => {
          router.push(path);
        });

        setVoiceState(prev => ({ ...prev, isEnabled: true }));
      } catch (error) {
        console.error('Failed to initialize voice services:', error);
        setVoiceState(prev => ({
          ...prev,
          isEnabled: false,
          lastError: error instanceof Error ? error.message : 'Voice initialization failed'
        }));
      }
    };

    initializeVoice();

    // Cleanup
    return () => {
      voiceProcessor.stopListening();
      voiceNavigator.deactivate();
    };
  }, [router]);

  // Update voice navigator context when pathname changes
  useEffect(() => {
    if (voiceState.isNavigationActive) {
      voiceNavigator.updateContext({ currentPath: pathname });
    }
  }, [pathname, voiceState.isNavigationActive]);

  const startListening = useCallback(async () => {
    if (!voiceState.isEnabled || voiceState.isListening) return;

    try {
      setVoiceState(prev => ({ ...prev, isListening: true, lastError: null }));
      await voiceProcessor.startListening();
    } catch (error) {
      setVoiceState(prev => ({
        ...prev,
        isListening: false,
        lastError: error instanceof Error ? error.message : 'Failed to start listening'
      }));
    }
  }, [voiceState.isEnabled, voiceState.isListening]);

  const stopListening = useCallback(() => {
    voiceProcessor.stopListening();
    setVoiceState(prev => ({ ...prev, isListening: false, transcript: '' }));
  }, []);

  const toggleVoiceNavigation = useCallback(async () => {
    if (voiceState.isNavigationActive) {
      await voiceNavigator.deactivate();
      setVoiceState(prev => ({ ...prev, isNavigationActive: false }));
    } else {
      await voiceNavigator.activate();
      setVoiceState(prev => ({ ...prev, isNavigationActive: true }));
    }
  }, [voiceState.isNavigationActive]);

  const processCommand = useCallback(async (command: string) => {
    if (!voiceState.isEnabled) return;

    setVoiceState(prev => ({ ...prev, isProcessing: true }));
    
    try {
      // First try voice navigator if active
      if (voiceState.isNavigationActive) {
        const handled = await voiceNavigator.handleCommand(command);
        if (handled) {
          setVoiceState(prev => ({ ...prev, isProcessing: false, lastCommand: command }));
          return;
        }
      }

      // Otherwise use voice processor
      const result = await voiceProcessor.processCommand({
        transcript: command,
        confidence: 1.0,
        timestamp: Date.now(),
        context: {
          page: pathname,
          userRole: 'crew' // This should come from auth context
        }
      });

      setVoiceState(prev => ({
        ...prev,
        isProcessing: false,
        lastCommand: command
      }));
    } catch (error) {
      setVoiceState(prev => ({
        ...prev,
        isProcessing: false,
        lastError: error instanceof Error ? error.message : 'Command processing failed'
      }));
    }
  }, [voiceState.isEnabled, voiceState.isNavigationActive, pathname]);

  const speak = useCallback(async (text: string) => {
    try {
      await voiceProcessor.speak(text);
    } catch (error) {
      console.error('Speech synthesis failed:', error);
    }
  }, []);

  const contextValue: VoiceContextValue = {
    ...voiceState,
    startListening,
    stopListening,
    toggleVoiceNavigation,
    processCommand,
    speak
  };

  return (
    <VoiceContext.Provider value={contextValue}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
}