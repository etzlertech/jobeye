/**
 * @file /src/components/voice/VoiceClarificationFlow.tsx
 * @purpose Multi-turn clarification flow for voice commands
 * @phase 3
 * @domain UI Components
 * @complexity_budget 250
 * @test_coverage 85%
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, MessageCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoiceIntentResult } from '@/domains/intent/types/voice-intent-types';

export interface VoiceClarificationFlowProps {
  isOpen: boolean;
  intentResult: VoiceIntentResult;
  onClarify: (transcript: string) => Promise<void>;
  onCancel: () => void;
  maxAttempts?: number;
}

export function VoiceClarificationFlow({
  isOpen,
  intentResult,
  onClarify,
  onCancel,
  maxAttempts = 3,
}: VoiceClarificationFlowProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAnnounced, setHasAnnounced] = useState(false);
  const recognitionRef = useRef<any>(null);

  const currentAttempt = intentResult.turn_number || 1;
  const attemptsRemaining = maxAttempts - currentAttempt;

  // Announce follow-up question via TTS
  useEffect(() => {
    if (!isOpen || hasAnnounced || !intentResult.follow_up) {
      console.log('[VoiceClarificationFlow] Skipping TTS:', { isOpen, hasAnnounced, hasFollowUp: !!intentResult.follow_up });
      return;
    }

    console.log('[VoiceClarificationFlow] Starting TTS:', intentResult.follow_up);

    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(intentResult.follow_up);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        console.log('[VoiceClarificationFlow] TTS started');
      };

      utterance.onend = () => {
        console.log('[VoiceClarificationFlow] TTS ended, starting mic');
        setTimeout(() => startListening(), 500);
      };

      utterance.onerror = (event) => {
        console.error('[VoiceClarificationFlow] TTS error:', event);
      };

      window.speechSynthesis.speak(utterance);
      setHasAnnounced(true);
    } else {
      console.warn('[VoiceClarificationFlow] Speech synthesis not available');
      setTimeout(() => startListening(), 500);
      setHasAnnounced(true);
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [isOpen, intentResult.follow_up, hasAnnounced]);

  // Setup speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.language = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript.trim());
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
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setTranscript('');
      setIsProcessing(false);
      setHasAnnounced(false);
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  const startListening = () => {
    if (!recognitionRef.current || isListening) return;

    try {
      setTranscript(''); // Clear previous transcript
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

  const handleSubmit = async () => {
    if (!transcript.trim()) {
      speak('Please provide an answer first.');
      return;
    }

    setIsProcessing(true);
    stopListening();

    try {
      await onClarify(transcript);
    } catch (error) {
      console.error('Clarification error:', error);
      setIsProcessing(false);
      speak('An error occurred. Please try again.');
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-yellow-600 px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <MessageCircle className="w-6 h-6" />
              Need More Information
            </h2>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Attempt {currentAttempt} of {maxAttempts}
              </span>
              <span className={`text-sm font-medium ${
                attemptsRemaining > 1 ? 'text-gray-900' :
                attemptsRemaining === 1 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  attemptsRemaining > 1 ? 'bg-emerald-600' :
                  attemptsRemaining === 1 ? 'bg-yellow-600' :
                  'bg-red-600'
                }`}
                style={{ width: `${(currentAttempt / maxAttempts) * 100}%` }}
              />
            </div>

            {/* Follow-up Question */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-lg text-gray-900 font-medium flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                {intentResult.follow_up}
              </p>
            </div>

            {/* Current Intent Summary */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">What we have so far:</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Action:</span>
                  <span className="text-sm text-blue-900 capitalize">
                    {intentResult.intent.replace(/_/g, ' ')}
                  </span>
                </div>

                {renderAccumulatedEntities(intentResult)}

                {intentResult.missing_entities && intentResult.missing_entities.length > 0 && (
                  <div className="pt-2 border-t border-blue-200">
                    <span className="text-sm font-medium text-gray-700">Still need:</span>
                    <ul className="text-sm text-red-600 list-disc list-inside mt-1">
                      {intentResult.missing_entities.map((entity) => (
                        <li key={entity}>{formatEntityName(entity)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Voice Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your answer:
              </label>

              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="Type or use voice..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  disabled={isProcessing}
                />

                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing}
                  className={`
                    p-2 rounded-lg transition-all
                    ${isListening
                      ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
                      : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                  aria-label={isListening ? 'Stop listening' : 'Start listening'}
                >
                  {isListening ? (
                    <MicOff className="w-6 h-6" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </button>
              </div>

              {isListening && (
                <p className="mt-2 text-sm text-red-600 font-medium">
                  🎤 Listening...
                </p>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !transcript.trim()}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {isProcessing ? 'Processing...' : 'Submit'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Render accumulated entities
 */
function renderAccumulatedEntities(intent: VoiceIntentResult): React.ReactNode {
  const { entities } = intent;
  const rows: React.ReactNode[] = [];

  // Guard against undefined entities
  if (!entities) {
    return (
      <div className="text-sm text-gray-500 italic">
        No details collected yet
      </div>
    );
  }

  if (entities.itemNames && entities.itemNames.length > 0) {
    rows.push(
      <div key="items" className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">Items:</span>
        <span className="text-sm text-blue-900">
          {entities.itemNames.join(', ')}
        </span>
      </div>
    );
  }

  if (entities.quantities && entities.quantities.length > 0) {
    rows.push(
      <div key="quantities" className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">Quantities:</span>
        <span className="text-sm text-blue-900">
          {entities.quantities.join(', ')}
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

  return rows.length > 0 ? <>{rows}</> : (
    <div className="text-sm text-gray-500 italic">
      No details collected yet
    </div>
  );
}

/**
 * Format entity name for display
 */
function formatEntityName(entity: string): string {
  // Convert camelCase/snake_case to Title Case
  return entity
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
