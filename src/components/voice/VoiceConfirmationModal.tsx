/**
 * @file /src/components/voice/VoiceConfirmationModal.tsx
 * @purpose Voice confirmation modal with TTS announcement and mic input
 * @phase 3
 * @domain UI Components
 * @complexity_budget 300
 * @test_coverage 85%
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Check, X, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoiceIntentResult, VoiceIntentEntities } from '@/domains/intent/types/voice-intent-types';

export interface VoiceConfirmationModalProps {
  isOpen: boolean;
  intent: VoiceIntentResult;
  onConfirm: (transcript?: string) => Promise<void>;
  onCancel: () => void;
  autoStartMic?: boolean;
  autoAnnounce?: boolean;
}

export function VoiceConfirmationModal({
  isOpen,
  intent,
  onConfirm,
  onCancel,
  autoStartMic = true,
  autoAnnounce = true,
}: VoiceConfirmationModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [hasAnnounced, setHasAnnounced] = useState(false);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Build confirmation question from intent
  const confirmationQuestion = buildConfirmationQuestion(intent);

  // Announce via TTS and auto-start mic
  useEffect(() => {
    if (!isOpen || hasAnnounced) return;

    if (autoAnnounce && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(confirmationQuestion);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Start mic after announcement
      utterance.onend = () => {
        if (autoStartMic) {
          setTimeout(() => startListening(), 500);
        }
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setHasAnnounced(true);
    } else if (autoStartMic) {
      // No TTS, just start mic
      setTimeout(() => startListening(), 500);
      setHasAnnounced(true);
    }

    return () => {
      // Cleanup TTS
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen, autoAnnounce, autoStartMic, confirmationQuestion, hasAnnounced]);

  // Setup speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.language = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const result = event.results[0][0].transcript.trim().toLowerCase();
      setTranscript(result);

      // Auto-process if it's clearly yes or no
      if (isYesResponse(result)) {
        handleConfirm(result);
      } else if (isNoResponse(result)) {
        handleCancel();
      } else {
        // Unclear - ask again
        speak('Sorry, I didn\'t catch that. Please say yes or no.');
        setTimeout(() => startListening(), 2000);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setTranscript('');
      setIsExecuting(false);
      setHasAnnounced(false);
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  const startListening = () => {
    if (!recognitionRef.current || isListening) return;

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error('Failed to start recognition:', error);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current || !isListening) return;

    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Failed to stop recognition:', error);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleConfirm = async (voiceTranscript?: string) => {
    setIsExecuting(true);
    stopListening();

    try {
      await onConfirm(voiceTranscript || transcript);
    } catch (error) {
      console.error('Confirmation error:', error);
      setIsExecuting(false);
      speak('An error occurred. Please try again.');
    }
  };

  const handleCancel = () => {
    stopListening();
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-emerald-600 px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Volume2 className="w-6 h-6" />
              Confirm Action
            </h2>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Confirmation Question */}
            <div className="text-center">
              <p className="text-lg text-gray-900 font-medium">
                {confirmationQuestion}
              </p>
            </div>

            {/* Intent Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Action:</span>
                <span className="text-sm font-semibold text-blue-900 capitalize">
                  {intent.intent.replace(/_/g, ' ')}
                </span>
              </div>

              {renderEntitySummary(intent.entities)}

              <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                <span className="text-sm font-medium text-gray-700">Confidence:</span>
                <span className={`text-sm font-semibold ${
                  intent.confidence >= 0.9 ? 'text-green-600' :
                  intent.confidence >= 0.7 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {Math.round(intent.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Voice Input */}
            <div className="flex items-center justify-center gap-2 py-2">
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isExecuting}
                className={`
                  p-4 rounded-full transition-all
                  ${isListening
                    ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
                    : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-4 focus:ring-offset-2
                  ${isListening ? 'focus:ring-red-300' : 'focus:ring-emerald-300'}
                `}
                aria-label={isListening ? 'Stop listening' : 'Start listening'}
              >
                {isListening ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </button>
            </div>

            {isListening && (
              <p className="text-center text-sm text-red-600 font-medium">
                🎤 Listening... Say "yes" or "no"
              </p>
            )}

            {transcript && !isExecuting && (
              <p className="text-center text-sm text-gray-600">
                You said: "{transcript}"
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isExecuting}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              No, Cancel
            </Button>

            <Button
              onClick={() => handleConfirm()}
              disabled={isExecuting}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Yes, Do It
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Build human-readable confirmation question from intent
 */
function buildConfirmationQuestion(intent: VoiceIntentResult): string {
  const { intent: action, entities } = intent;

  switch (action) {
    case 'check_in':
      return `Are you sure you want to check in ${formatItems(entities.itemNames, entities.quantities)} from job ${entities.jobId || entities.jobNumber}?`;

    case 'check_out':
      return `Are you sure you want to check out ${formatItems(entities.itemNames, entities.quantities)} to job ${entities.jobId || entities.jobNumber}?`;

    case 'transfer':
      return `Are you sure you want to transfer ${formatItems(entities.itemNames)} from ${entities.fromLocationName} to ${entities.toLocationName}?`;

    case 'inventory_add':
      return `Are you sure you want to add ${formatItems(entities.itemNames)} to inventory?`;

    case 'inventory_check':
      return `Do you want to check the status of ${formatItems(entities.itemNames)}?`;

    default:
      return `Are you sure you want to ${action.replace(/_/g, ' ')}?`;
  }
}

/**
 * Render entity summary in the modal
 */
function renderEntitySummary(entities: VoiceIntentEntities): React.ReactNode {
  const rows: React.ReactNode[] = [];

  if (entities.itemNames && entities.itemNames.length > 0) {
    rows.push(
      <div key="items" className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">Items:</span>
        <span className="text-sm text-blue-900 max-w-[200px] truncate">
          {formatItems(entities.itemNames, entities.quantities)}
        </span>
      </div>
    );
  }

  if (entities.jobId || entities.jobNumber) {
    rows.push(
      <div key="job" className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">Job:</span>
        <span className="text-sm text-blue-900">
          {entities.jobId || entities.jobNumber}
        </span>
      </div>
    );
  }

  if (entities.fromLocationName) {
    rows.push(
      <div key="from" className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">From:</span>
        <span className="text-sm text-blue-900">{entities.fromLocationName}</span>
      </div>
    );
  }

  if (entities.toLocationName) {
    rows.push(
      <div key="to" className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">To:</span>
        <span className="text-sm text-blue-900">{entities.toLocationName}</span>
      </div>
    );
  }

  return <>{rows}</>;
}

/**
 * Format item list with quantities
 */
function formatItems(items?: string[], quantities?: number[]): string {
  if (!items || items.length === 0) return '';

  if (quantities && quantities.length === items.length) {
    return items
      .map((item, i) => `${quantities[i]} ${item}`)
      .join(', ');
  }

  return items.join(', ');
}

/**
 * Check if transcript is a yes response
 */
function isYesResponse(transcript: string): boolean {
  const yesWords = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'correct', 'right', 'do it', 'go ahead', 'affirmative'];
  return yesWords.some(word => transcript.includes(word));
}

/**
 * Check if transcript is a no response
 */
function isNoResponse(transcript: string): boolean {
  const noWords = ['no', 'nope', 'nah', 'cancel', 'stop', 'don\'t', 'negative', 'abort'];
  return noWords.some(word => transcript.includes(word));
}
