/**
 * @file Gemini Live Voice UI Component
 * @purpose Real-time voice conversation interface with Gemini Live API
 * @phase 3
 * @domain Voice
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, Zap } from 'lucide-react';
import { useGeminiLive } from '@/hooks/use-gemini-live';
import toast from 'react-hot-toast';

export interface GeminiLiveVoiceUIProps {
  apiKey: string;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export function GeminiLiveVoiceUI({ apiKey }: GeminiLiveVoiceUIProps) {
  // Validate API key before rendering
  if (!apiKey || apiKey.trim() === '') {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-red-400 mb-2">API Key Required</p>
          <p className="text-sm text-gray-500">
            Gemini API key is not configured
          </p>
        </div>
      </div>
    );
  }

  return <GeminiLiveVoiceUIInner apiKey={apiKey} />;
}

function GeminiLiveVoiceUIInner({ apiKey }: GeminiLiveVoiceUIProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const geminiLive = useGeminiLive({
    apiKey,
    onTranscript: (text) => {
      console.log('[GeminiLiveUI] User transcript:', text);
      addMessage('user', text);
    },
    onResponse: (text) => {
      console.log('[GeminiLiveUI] Assistant response:', text);
      addMessage('assistant', text);
    },
  });

  const addMessage = (role: 'user' | 'assistant', text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role,
        text,
        timestamp: new Date(),
      },
    ]);
  };

  const handleConnect = async () => {
    try {
      await geminiLive.connect();
      toast.success('Connected to Gemini Live');
    } catch (error) {
      toast.error('Failed to connect');
    }
  };

  const handleStartListening = async () => {
    try {
      await geminiLive.startListening();
      toast.success('Listening...');
    } catch (error) {
      toast.error('Failed to start listening');
    }
  };

  const handleStopListening = () => {
    geminiLive.stopListening();
    toast.success('Stopped listening');
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-purple-500" />
            Gemini Live Voice
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time voice conversation with AI
          </p>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              geminiLive.isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-600'
            }`}
          />
          <span className="text-sm text-gray-400">
            {geminiLive.isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                <p className="text-sm leading-relaxed">{message.text}</p>
                <p className="text-xs mt-1 opacity-60">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading Indicators */}
        {geminiLive.isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              <span className="text-sm text-gray-400">Processing...</span>
            </div>
          </motion.div>
        )}

        {geminiLive.isSpeaking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-gray-400">Speaking...</span>
            </div>
          </motion.div>
        )}

        {/* Error Display */}
        {geminiLive.error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
            <p className="text-sm text-red-400">{geminiLive.error}</p>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && !geminiLive.isConnected && (
          <div className="text-center py-12">
            <Zap className="w-16 h-16 text-purple-500 mx-auto mb-4 opacity-50" />
            <p className="text-gray-400 mb-2">Ready to start</p>
            <p className="text-sm text-gray-500">
              Connect and start talking to manage your inventory
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center justify-center gap-4">
          {/* Connect Button */}
          {!geminiLive.isConnected && (
            <button
              onClick={handleConnect}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
            >
              Connect
            </button>
          )}

          {/* Disconnect Button */}
          {geminiLive.isConnected && !geminiLive.isListening && (
            <button
              onClick={geminiLive.disconnect}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Disconnect
            </button>
          )}

          {/* Mic Button */}
          {geminiLive.isConnected && (
            <button
              onClick={geminiLive.isListening ? handleStopListening : handleStartListening}
              disabled={geminiLive.isThinking || geminiLive.isSpeaking}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                geminiLive.isListening
                  ? 'bg-red-600 hover:bg-red-700 scale-110 animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {geminiLive.isListening ? (
                <MicOff className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 text-center">
          {!geminiLive.isConnected && (
            <p className="text-sm text-gray-500">
              Click Connect to start your voice conversation
            </p>
          )}
          {geminiLive.isConnected && !geminiLive.isListening && (
            <p className="text-sm text-gray-500">Click the microphone to start talking</p>
          )}
          {geminiLive.isListening && (
            <p className="text-sm text-green-500 animate-pulse">
              🎤 Listening... Speak naturally
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
