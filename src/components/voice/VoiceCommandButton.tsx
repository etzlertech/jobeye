/**
 * @file /src/components/voice/VoiceCommandButton.tsx
 * @purpose Voice command button with STT/TTS support
 * @phase 3
 * @domain UI Components
 * @complexity_budget 250
 * @test_coverage 80%
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader, Volume2 } from 'lucide-react';

export interface VoiceCommandButtonProps {
  onTranscript: (transcript: string) => void;
  onCommand?: (command: string, confidence: number) => void;
  responseText?: string | null;
  autoSpeak?: boolean;
  language?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function VoiceCommandButton({
  onTranscript,
  onCommand,
  responseText,
  autoSpeak = true,
  language = 'en-US',
  className = '',
  size = 'md'
}: VoiceCommandButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Size classes - 3x larger as requested
  const sizeClasses = {
    sm: 'w-36 h-36',  // was w-12 h-12, now 3x larger
    md: 'w-48 h-48',  // was w-16 h-16, now 3x larger  
    lg: 'w-60 h-60',  // was w-20 h-20, now 3x larger
    xl: 'w-80 h-80'   // 3x larger than lg for supervisor dashboard
  };

  // Icon sizes - also 3x larger to match
  const iconSizeClasses = {
    sm: 'w-24 h-24',  // was w-8 h-8, now 3x larger
    md: 'w-32 h-32',  // was w-8 h-8, now 4x larger for proportion
    lg: 'w-40 h-40',  // was w-8 h-8, now 5x larger for proportion
    xl: 'w-52 h-52'   // 3x larger than lg for supervisor dashboard  
  };

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.language = language;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          console.log('Voice recognition started');
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript;
          const confidence = event.results[current][0].confidence;
          
          setTranscript(transcript);

          if (event.results[current].isFinal) {
            onTranscript(transcript);
            if (onCommand) {
              onCommand(transcript, confidence);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          
          if (event.error === 'not-allowed') {
            setIsSupported(false);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          setTranscript('');
        };

        recognitionRef.current = recognition;
      } else {
        setIsSupported(false);
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, onTranscript, onCommand]);

  // Handle text-to-speech for responses
  useEffect(() => {
    if (responseText && autoSpeak && 'speechSynthesis' in window) {
      speakText(responseText);
    }
  }, [responseText, autoSpeak]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }, [language]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <div className={`text-center text-gray-500 ${className}`}>
        <p className="text-sm">Voice commands not supported</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main Voice Button */}
      <button
        onClick={toggleListening}
        disabled={isSpeaking}
        className={`
          ${sizeClasses[size]}
          rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-200
          ${isListening 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : 'bg-emerald-500 hover:bg-emerald-600'
          }
          ${isSpeaking ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          focus:outline-none focus:ring-4 focus:ring-emerald-300
        `}
        aria-label={isListening ? 'Stop listening' : 'Start voice command'}
      >
        {isSpeaking ? (
          <Volume2 className={`${iconSizeClasses[size]} text-white`} />
        ) : isListening ? (
          <MicOff className={`${iconSizeClasses[size]} text-white`} />
        ) : (
          <Mic className={`${iconSizeClasses[size]} text-white`} />
        )}
      </button>

      {/* Listening Indicator */}
      {isListening && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
          <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Listening...</span>
            </div>
            {transcript && (
              <p className="text-xs mt-1 text-gray-300">{transcript}</p>
            )}
          </div>
        </div>
      )}

      {/* Speaking Indicator */}
      {isSpeaking && (
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
          <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 animate-pulse" />
              <span className="text-sm">Speaking...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}