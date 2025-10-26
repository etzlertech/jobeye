/**
 * @file /src/components/voice/VoiceFloatingButton.tsx
 * @purpose Floating action button for voice commands
 * @phase 3
 * @domain UI Components
 * @complexity_budget 150
 * @test_coverage 80%
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X } from 'lucide-react';

export interface VoiceFloatingButtonProps {
  onTranscript: (transcript: string) => void;
  isProcessing?: boolean;
  className?: string;
}

export function VoiceFloatingButton({
  onTranscript,
  isProcessing = false,
  className = '',
}: VoiceFloatingButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const recognitionRef = useRef<any>(null);

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
      setShowPanel(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript.trim());
      } else if (interimTranscript) {
        setTranscript(interimTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      // If we have a final transcript, submit it
      if (transcript.trim()) {
        onTranscript(transcript.trim());
        setTranscript('');
        setShowPanel(false);
      }
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
  }, [transcript, onTranscript]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    if (!recognitionRef.current || isProcessing) return;

    try {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
      setShowPanel(true);
    } catch (error) {
      console.error('Failed to start recognition:', error);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Failed to stop recognition:', error);
    }
  };

  const handleClose = () => {
    stopListening();
    setTranscript('');
    setShowPanel(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={toggleListening}
        disabled={isProcessing}
        className={`
          fixed bottom-6 right-6 z-30
          w-16 h-16 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-200 ease-in-out
          ${
            isListening
              ? 'bg-red-600 hover:bg-red-700 animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-110'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-4 focus:ring-offset-2
          ${isListening ? 'focus:ring-red-300' : 'focus:ring-emerald-300'}
          ${className}
        `}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      >
        {isListening ? (
          <MicOff className="w-8 h-8 text-white" />
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </button>

      {/* Transcript Panel */}
      {showPanel && (
        <div className="fixed bottom-24 right-6 z-30 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[300px] max-w-md">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {isListening ? '🎤 Listening...' : 'Voice Command'}
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {transcript && (
            <div className="bg-gray-50 rounded p-3 text-sm text-gray-900">
              {transcript}
            </div>
          )}

          {!transcript && isListening && (
            <div className="text-sm text-gray-500 italic">
              Speak now...
            </div>
          )}

          {!transcript && !isListening && (
            <div className="text-sm text-gray-500 italic">
              Click the microphone to start
            </div>
          )}

          {isProcessing && (
            <div className="mt-2 text-sm text-blue-600 font-medium">
              Processing command...
            </div>
          )}
        </div>
      )}
    </>
  );
}
