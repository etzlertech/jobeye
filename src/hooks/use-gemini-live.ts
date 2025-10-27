/**
 * @file useGeminiLive Hook
 * @purpose React hook for Gemini Live API voice conversations
 * @phase 3
 * @domain Hooks
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveService, ToolCall, ToolResponse } from '@/domains/voice/services/gemini-live.service';
import { JOBEYE_TOOLS, VOICE_ASSISTANT_SYSTEM_INSTRUCTION } from '@/domains/voice/config/voice-tools.config';

export interface GeminiLiveState {
  isConnected: boolean;
  isListening: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  error: string | null;
}

export interface UseGeminiLiveOptions {
  apiKey: string;
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
}

/**
 * Hook for Gemini Live API voice conversations
 */
export function useGeminiLive(options: UseGeminiLiveOptions) {
  const [state, setState] = useState<GeminiLiveState>({
    isConnected: false,
    isListening: false,
    isThinking: false,
    isSpeaking: false,
    error: null,
  });

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);

  /**
   * Connect to Gemini Live API
   */
  const connect = useCallback(async () => {
    try {
      // Create service
      const service = new GeminiLiveService(
        options.apiKey,
        {
          model: 'models/gemini-2.0-flash-live-001',
          systemInstruction: VOICE_ASSISTANT_SYSTEM_INSTRUCTION,
          tools: JOBEYE_TOOLS,
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
          },
        },
        {
          onSetupComplete: () => {
            console.log('[useGeminiLive] Setup complete');
            setState((prev) => ({ ...prev, isConnected: true }));
          },

          onServerContent: (content) => {
            console.log('[useGeminiLive] Server content:', content);

            // Handle audio output
            if (content.modelTurn?.parts) {
              for (const part of content.modelTurn.parts) {
                if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                  playAudio(part.inlineData.data);
                }

                if (part.text && options.onResponse) {
                  options.onResponse(part.text);
                }
              }
            }

            setState((prev) => ({ ...prev, isThinking: false }));
          },

          onToolCall: async (toolCall: ToolCall) => {
            console.log('[useGeminiLive] Tool call:', toolCall);
            setState((prev) => ({ ...prev, isThinking: true }));

            // Call our API to execute tools
            const response = await fetch('/api/voice/tools', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(toolCall),
            });

            const result: ToolResponse = await response.json();
            console.log('[useGeminiLive] Tool result:', result);

            return result;
          },

          onError: (error) => {
            console.error('[useGeminiLive] Error:', error);
            setState((prev) => ({
              ...prev,
              error: error.message,
              isConnected: false,
            }));
          },

          onClose: () => {
            console.log('[useGeminiLive] Connection closed');
            setState((prev) => ({
              ...prev,
              isConnected: false,
              isListening: false,
            }));
          },
        }
      );

      serviceRef.current = service;
      await service.connect();
    } catch (error) {
      console.error('[useGeminiLive] Connect error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [options]);

  /**
   * Start listening (capture mic audio)
   */
  const startListening = useCallback(async () => {
    try {
      if (!serviceRef.current?.isConnected()) {
        throw new Error('Not connected to Gemini Live');
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      micStreamRef.current = stream;

      // Create Audio Context
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // Create AudioWorklet for processing
      await audioContext.audioWorklet.addModule('/audio-processor.js');
      const audioWorklet = new AudioWorkletNode(audioContext, 'audio-processor');

      audioWorkletNodeRef.current = audioWorklet;

      // Send audio chunks to Gemini
      audioWorklet.port.onmessage = (event) => {
        const audioData = event.data; // PCM samples
        const base64Audio = arrayBufferToBase64(audioData);
        serviceRef.current?.sendAudio(base64Audio);
      };

      source.connect(audioWorklet);
      audioWorklet.connect(audioContext.destination);

      setState((prev) => ({ ...prev, isListening: true }));
    } catch (error) {
      console.error('[useGeminiLive] Start listening error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start listening',
      }));
    }
  }, []);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    // Stop microphone
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setState((prev) => ({ ...prev, isListening: false }));
  }, []);

  /**
   * Disconnect
   */
  const disconnect = useCallback(() => {
    stopListening();

    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
    }

    setState({
      isConnected: false,
      isListening: false,
      isThinking: false,
      isSpeaking: false,
      error: null,
    });
  }, [stopListening]);

  /**
   * Play audio from Gemini
   */
  const playAudio = async (base64Audio: string) => {
    try {
      setState((prev) => ({ ...prev, isSpeaking: true }));

      // Decode base64 to ArrayBuffer
      const audioData = base64ToArrayBuffer(base64Audio);

      // Create audio context for playback
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const audioBuffer = await audioContext.decodeAudioData(audioData);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        setState((prev) => ({ ...prev, isSpeaking: false }));
        audioContext.close();
      };

      source.start();
    } catch (error) {
      console.error('[useGeminiLive] Play audio error:', error);
      setState((prev) => ({ ...prev, isSpeaking: false }));
    }
  };

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    startListening,
    stopListening,
  };
}

/**
 * Helper: Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
