/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/voice/page.tsx
 * phase: 3
 * domain: voice
 * purpose: Voice Command Center with chat-like interface for CRUD operations
 * spec_ref: docs/voice-command-center-plan.md
 * complexity_budget: 400
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Send,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { TenantBadge } from '@/components/tenant';
import { useVoiceCommand } from '@/hooks/use-voice-command';
import { VoiceConfirmationModal } from '@/components/voice/VoiceConfirmationModal';
import { VoiceClarificationFlow } from '@/components/voice/VoiceClarificationFlow';
import { GeminiLiveVoiceUI } from '@/components/voice/GeminiLiveVoiceUI';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: number;
}

export default function VoiceCommandCenterPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [useGeminiLive, setUseGeminiLive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>(''); // Ref to avoid re-creating effect on transcript change

  // Portal mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get API key from environment (client-side)
  const geminiApiKey = (process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY || '').trim();

  // Debug logging for production issues
  useEffect(() => {
    console.log('[Voice Page] Gemini API Key status:', {
      exists: !!geminiApiKey,
      length: geminiApiKey.length,
      firstChars: geminiApiKey.substring(0, 10) + '...',
      envVarDefined: typeof process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY !== 'undefined'
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize voice command hook (MUST be called before any early returns)
  const voiceCommand = useVoiceCommand({
    context: {
      role: 'supervisor',
      currentPage: 'voice-command-center',
    },
    onSuccess: (result) => {
      toast.success('Action completed successfully');
      // Add success message to chat
      addMessage({
        role: 'assistant',
        content: result?.response_text || 'Action completed successfully',
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Something went wrong');
      // Add error message to chat
      addMessage({
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong'}`,
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add assistant message when clarification is needed
  useEffect(() => {
    if (voiceCommand.showClarification && voiceCommand.currentIntent?.follow_up) {
      addMessage({
        role: 'assistant',
        content: voiceCommand.currentIntent.follow_up,
        intent: voiceCommand.currentIntent.intent,
        confidence: voiceCommand.currentIntent.confidence,
      });
    }
  }, [voiceCommand.showClarification, voiceCommand.currentIntent?.follow_up]);

  // Add assistant message when confirmation is needed
  useEffect(() => {
    if (voiceCommand.showConfirmation && voiceCommand.currentIntent) {
      const intent = voiceCommand.currentIntent.intent.replace(/_/g, ' ');
      addMessage({
        role: 'assistant',
        content: `I'll ${intent}. Please confirm to proceed.`,
        intent: voiceCommand.currentIntent.intent,
        confidence: voiceCommand.currentIntent.confidence,
      });
    }
  }, [voiceCommand.showConfirmation, voiceCommand.currentIntent?.intent]);

  // Setup speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check microphone permission
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((result) => {
          if (result.state === 'denied') {
            setMicPermissionDenied(true);
          }
          result.onchange = () => {
            setMicPermissionDenied(result.state === 'denied');
          };
        })
        .catch(() => {
          // Permissions API not supported, assume microphone is available
        });
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicPermissionDenied(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.language = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
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
        const trimmed = finalTranscript.trim();
        transcriptRef.current = trimmed;
        setTranscript(trimmed);
      } else if (interimTranscript) {
        const trimmed = interimTranscript.trim();
        transcriptRef.current = trimmed;
        setTranscript(trimmed);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setMicPermissionDenied(true);
      }
    };

    recognition.onend = () => {
      setIsListening(false);

      // If we have a final transcript, submit it
      const currentTranscript = transcriptRef.current;
      if (currentTranscript) {
        handleVoiceCommand(currentTranscript);
        setTranscript('');
        transcriptRef.current = '';
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
  }, []); // Empty deps - only run once on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [isListening]);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleVoiceCommand = async (transcript: string) => {
    // Validate transcript
    if (!transcript || transcript.trim().length === 0) {
      console.error('Empty transcript received');
      toast.error('No voice input detected. Please try again.');
      return;
    }

    // Add user message to chat
    addMessage({
      role: 'user',
      content: transcript,
    });

    try {
      // Process through voice command hook
      await voiceCommand.processVoiceCommand(transcript);

      // Note: Assistant responses will be added via onSuccess/onError callbacks
    } catch (error) {
      console.error('Error processing voice command:', error);
      addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your command.',
      });
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || voiceCommand.isProcessing) return;

    const input = textInput.trim();
    setTextInput('');
    await handleVoiceCommand(input);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    if (!recognitionRef.current || voiceCommand.isProcessing || micPermissionDenied) return;

    try {
      setTranscript('');
      transcriptRef.current = '';
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error('Failed to stop recognition:', error);
    }
  };

  // Conditional rendering: Gemini Live mode
  if (useGeminiLive && geminiApiKey && geminiApiKey.length > 0) {
    return (
      <div className="mobile-container">
        {/* Header */}
        <header className="header">
          <button
            onClick={() => setUseGeminiLive(false)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <TenantBadge />
        </header>

        {/* Gemini Live UI */}
        <div className="flex-1 overflow-hidden">
          <GeminiLiveVoiceUI apiKey={geminiApiKey} />
        </div>

        {/* Navigation */}
        <MobileNavigation />
      </div>
    );
  }

  // Browser-based voice mode (default)
  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/')}
        showBackButton={true}
        backTo="/supervisor"
      />

      {/* Header */}
      <div className="header-bar">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/supervisor')}
            className="icon-button"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">Voice Assistant</h1>
            <p className="text-xs text-gray-500">Speak or type your command</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Gemini Live Toggle (if API key available) */}
          {geminiApiKey && geminiApiKey.length > 0 && (
            <button
              onClick={() => setUseGeminiLive(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-sm"
              title="Switch to Gemini Live (Real-time AI)"
            >
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Live</span>
            </button>
          )}
          <TenantBadge />
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="empty-state">
            <Mic className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-center">
              Click the microphone or type below to start
            </p>
            <p className="text-xs text-gray-500 text-center mt-2">
              Try saying: &quot;Check in 5 hammers from job 123&quot;
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`chat-message ${message.role}`}
            >
              <div className="message-bubble">
                <p className="text-sm">{message.content}</p>
                {message.confidence !== undefined && (
                  <p className="text-xs text-gray-500 mt-1">
                    Confidence: {(message.confidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Processing indicator */}
        {voiceCommand.isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="chat-message assistant"
          >
            <div className="message-bubble">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Listening indicator */}
        {isListening && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="chat-message user"
          >
            <div className="message-bubble listening">
              <p className="text-sm">{transcript || 'Listening...'}</p>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Microphone permission denied message */}
      {micPermissionDenied && (
        <div className="notification-bar error">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">
            Microphone access denied. Please use text input below.
          </span>
        </div>
      )}

      {/* Input Area */}
      <div className="input-area">
        <form onSubmit={handleTextSubmit} className="flex items-center gap-3">
          {!micPermissionDenied && (
            <button
              type="button"
              onClick={toggleListening}
              disabled={voiceCommand.isProcessing}
              className={`mic-button ${isListening ? 'listening' : ''}`}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
              {isListening ? (
                <MicOff className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          )}

          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              micPermissionDenied
                ? 'Type your command here...'
                : 'Or type your command...'
            }
            className="text-input"
            disabled={voiceCommand.isProcessing}
          />

          <button
            type="submit"
            disabled={!textInput.trim() || voiceCommand.isProcessing}
            className="send-button"
            aria-label="Send command"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Clarification Modal - Rendered via Portal */}
      {mounted && voiceCommand.showClarification && voiceCommand.currentIntent && createPortal(
        <VoiceClarificationFlow
          isOpen={voiceCommand.showClarification}
          intentResult={voiceCommand.currentIntent}
          onClarify={voiceCommand.handleClarify}
          onCancel={voiceCommand.handleCancel}
        />,
        document.body
      )}

      {/* Confirmation Modal - Rendered via Portal */}
      {mounted && voiceCommand.showConfirmation && voiceCommand.currentIntent && createPortal(
        <VoiceConfirmationModal
          isOpen={voiceCommand.showConfirmation}
          intent={voiceCommand.currentIntent}
          onConfirm={voiceCommand.handleConfirm}
          onCancel={voiceCommand.handleCancel}
        />,
        document.body
      )}

      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          height: 100vh;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          color: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 0 0.5rem;
          box-sizing: border-box;
        }

        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .icon-button {
          padding: 0.375rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-button:hover {
          background: rgba(255, 215, 0, 0.2);
          border-color: #ffd700;
        }

        .notification-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 0.5rem 1rem 0;
          border-radius: 0.5rem;
        }

        .notification-bar.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          margin-top: 4rem;
        }

        .chat-message {
          display: flex;
          flex-direction: column;
          margin-bottom: 1rem;
        }

        .chat-message.user {
          align-items: flex-end;
        }

        .chat-message.assistant {
          align-items: flex-start;
        }

        .message-bubble {
          max-width: 75%;
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          word-wrap: break-word;
        }

        .chat-message.user .message-bubble {
          background: rgba(255, 215, 0, 0.2);
          border: 1px solid rgba(255, 215, 0, 0.3);
          color: white;
          border-bottom-right-radius: 0.25rem;
        }

        .chat-message.assistant .message-bubble {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-bottom-left-radius: 0.25rem;
        }

        .message-bubble.listening {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        .input-area {
          padding: 1rem;
          border-top: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .mic-button {
          width: 3.5rem;
          height: 3.5rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(16, 185, 129, 0.2);
          border: 2px solid rgba(16, 185, 129, 0.5);
          color: #10b981;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .mic-button:hover:not(:disabled) {
          background: rgba(16, 185, 129, 0.3);
          border-color: #10b981;
          transform: scale(1.05);
        }

        .mic-button.listening {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
          color: #ef4444;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .mic-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .text-input {
          flex: 1;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 1.5rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s;
        }

        .text-input:focus {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 215, 0, 0.5);
        }

        .text-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .text-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .send-button {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 215, 0, 0.2);
          border: 1px solid rgba(255, 215, 0, 0.3);
          color: #ffd700;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .send-button:hover:not(:disabled) {
          background: rgba(255, 215, 0, 0.3);
          border-color: #ffd700;
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
