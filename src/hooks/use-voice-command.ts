/**
 * @file /src/hooks/use-voice-command.ts
 * @purpose React hook for easy voice command integration
 * @phase 3
 * @domain Hooks
 * @complexity_budget 250
 * @test_coverage 80%
 */

'use client';

import { useState, useCallback } from 'react';
import { VoiceIntentResult } from '@/domains/intent/types/voice-intent-types';

export interface VoiceCommandState {
  // Loading states
  isListening: boolean;
  isProcessing: boolean;
  isExecuting: boolean;

  // Modal states
  showClarification: boolean;
  showConfirmation: boolean;

  // Data
  currentIntent: VoiceIntentResult | null;
  conversationId: string | null;
  error: string | null;
  successMessage: string | null;
}

export interface UseVoiceCommandOptions {
  context?: {
    role?: 'supervisor' | 'crew';
    currentPage?: string;
    activeJobId?: string;
  };
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  autoConfirm?: boolean; // Skip confirmation modal for high-confidence intents
}

export function useVoiceCommand(options: UseVoiceCommandOptions = {}) {
  const [state, setState] = useState<VoiceCommandState>({
    isListening: false,
    isProcessing: false,
    isExecuting: false,
    showClarification: false,
    showConfirmation: false,
    currentIntent: null,
    conversationId: null,
    error: null,
    successMessage: null,
  });

  /**
   * Process voice transcript through the voice command API
   */
  const processVoiceCommand = useCallback(
    async (transcript: string) => {
      setState((prev) => ({
        ...prev,
        isProcessing: true,
        error: null,
      }));

      try {
        const requestBody: any = {
          transcript,
          settings: {
            use_browser_stt: true,
          },
        };

        // Only include optional fields if they have values (not null)
        if (options.context) {
          requestBody.context = options.context;
        }

        if (state.conversationId) {
          requestBody.conversation_id = state.conversationId;
        }

        console.log('Sending voice command:', requestBody);

        const response = await fetch('/api/voice/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Voice command API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
          throw new Error(errorData.error || errorData.message || 'Voice command failed');
        }

        const result = await response.json();

        // Handle clarification needed
        if (result.needs_clarification) {
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            showClarification: true,
            currentIntent: result,
            conversationId: result.conversation_id,
          }));
          return;
        }

        // Handle confirmation (unless auto-confirm is enabled for high confidence)
        const shouldConfirm = !options.autoConfirm || result.confidence < 0.9;

        if (shouldConfirm) {
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            showConfirmation: true,
            currentIntent: result,
            conversationId: result.conversation_id,
          }));
        } else {
          // Auto-execute high-confidence commands
          await executeAction(result);
        }
      } catch (error) {
        console.error('Voice command error:', error);
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: error instanceof Error ? error.message : 'Failed to process command',
        }));

        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error('Unknown error'));
        }
      }
    },
    [options, state.conversationId]
  );

  /**
   * Handle clarification response
   */
  const handleClarify = useCallback(
    async (transcript: string) => {
      setState((prev) => ({ ...prev, isProcessing: true }));

      try {
        // Process clarification through voice command API
        await processVoiceCommand(transcript);

        setState((prev) => ({
          ...prev,
          showClarification: false,
        }));
      } catch (error) {
        console.error('Clarification error:', error);
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: 'Failed to process clarification',
        }));
      }
    },
    [processVoiceCommand]
  );

  /**
   * Handle confirmation
   */
  const handleConfirm = useCallback(
    async (voiceTranscript?: string) => {
      if (!state.currentIntent) return;

      setState((prev) => ({ ...prev, isExecuting: true }));

      try {
        let result;

        // If user confirmed via voice, process through confirmation API
        if (voiceTranscript) {
          const confirmBody: any = {
            transcript: voiceTranscript,
            previous_intent: state.currentIntent,
            confirmation_question: `Confirm ${state.currentIntent.intent}?`,
          };

          // Only include conversation_id if it exists
          if (state.conversationId) {
            confirmBody.conversation_id = state.conversationId;
          }

          const response = await fetch('/api/voice/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(confirmBody),
          });

          if (!response.ok) {
            throw new Error('Confirmation failed');
          }

          result = await response.json();

          if (!result.confirmed) {
            // User said no
            setState((prev) => ({
              ...prev,
              isExecuting: false,
              showConfirmation: false,
              currentIntent: null,
              conversationId: null,
              successMessage: 'Action cancelled',
            }));
            return;
          }
        } else {
          // User clicked "Yes" button - execute the action
          result = state.currentIntent;
        }

        await executeAction(result);
      } catch (error) {
        console.error('Confirmation error:', error);
        setState((prev) => ({
          ...prev,
          isExecuting: false,
          error: error instanceof Error ? error.message : 'Failed to execute action',
        }));

        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error('Unknown error'));
        }
      }
    },
    [state.currentIntent, state.conversationId, options]
  );

  /**
   * Execute the actual CRUD action
   */
  const executeAction = async (result: any) => {
    try {
      // The action has already been executed by the backend
      // Just handle UI updates
      setState((prev) => ({
        ...prev,
        isExecuting: false,
        isProcessing: false,
        showConfirmation: false,
        showClarification: false,
        currentIntent: null,
        conversationId: null,
        successMessage: result.response?.text || 'Action completed successfully',
        error: null,
      }));

      if (options.onSuccess && result.action?.result) {
        options.onSuccess(result.action.result);
      }
    } catch (error) {
      console.error('Action execution error:', error);
      setState((prev) => ({
        ...prev,
        isExecuting: false,
        error: error instanceof Error ? error.message : 'Action failed',
      }));

      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  };

  /**
   * Cancel current flow
   */
  const handleCancel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showConfirmation: false,
      showClarification: false,
      currentIntent: null,
      conversationId: null,
      isProcessing: false,
      isExecuting: false,
    }));
  }, []);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Clear success message
   */
  const clearSuccess = useCallback(() => {
    setState((prev) => ({ ...prev, successMessage: null }));
  }, []);

  /**
   * Start listening for voice input
   */
  const startListening = useCallback(() => {
    setState((prev) => ({ ...prev, isListening: true }));
  }, []);

  /**
   * Stop listening for voice input
   */
  const stopListening = useCallback(() => {
    setState((prev) => ({ ...prev, isListening: false }));
  }, []);

  return {
    // State
    ...state,

    // Actions
    processVoiceCommand,
    handleClarify,
    handleConfirm,
    handleCancel,
    clearError,
    clearSuccess,
    startListening,
    stopListening,
  };
}
