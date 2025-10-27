/**
 * @file CamChat UI Component
 * @purpose Multimodal camera + voice interface with Gemini Live API
 * @phase 3
 * @domain Voice/Vision
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, Video, VideoOff, Eye, Activity } from 'lucide-react';
import { GeminiLiveService, ToolCall, ToolResponse } from '@/domains/voice/services/gemini-live.service';
import { JOBEYE_TOOLS, CAMCHAT_SYSTEM_INSTRUCTION } from '@/domains/voice/config/voice-tools.config';
import toast from 'react-hot-toast';

export interface CamChatUIProps {
  apiKey: string;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  hasVisual?: boolean;
}

export function CamChatUI({ apiKey }: CamChatUIProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFrame, setLastFrame] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addMessage = (role: 'user' | 'assistant', text: string, hasVisual = false) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role,
        text,
        timestamp: new Date(),
        hasVisual,
      },
    ]);
  };

  /**
   * Connect to Gemini Live API
   */
  const handleConnect = async () => {
    try {
      // Validate API key
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('Gemini API key is required');
      }

      const service = new GeminiLiveService(
        apiKey,
        {
          model: 'models/gemini-2.0-flash-live-001',
          systemInstruction: CAMCHAT_SYSTEM_INSTRUCTION,
          tools: JOBEYE_TOOLS,
          generationConfig: {
            temperature: 0.3,
            topP: 0.95,
            topK: 40,
          },
        },
        {
          onSetupComplete: () => {
            console.log('[CamChat] Setup complete');
            setIsConnected(true);
            toast.success('Connected to CamChat');
          },

          onServerContent: (content) => {
            console.log('[CamChat] Server content:', content);

            // Handle audio output
            if (content.modelTurn?.parts) {
              for (const part of content.modelTurn.parts) {
                if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                  playAudio(part.inlineData.data);
                }

                if (part.text) {
                  addMessage('assistant', part.text);
                }
              }
            }

            setIsThinking(false);
          },

          onToolCall: async (toolCall: ToolCall) => {
            console.log('[CamChat] Tool call:', toolCall);
            setIsThinking(true);

            // Call our API to execute tools
            const response = await fetch('/api/voice/tools', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(toolCall),
            });

            const result: ToolResponse = await response.json();
            console.log('[CamChat] Tool result:', result);

            return result;
          },

          onError: (err) => {
            console.error('[CamChat] Error:', err);
            setError(err.message);
            setIsConnected(false);
            toast.error(err.message);
          },

          onClose: () => {
            console.log('[CamChat] Connection closed');
            setIsConnected(false);
            setIsListening(false);
            setIsCameraOn(false);
          },
        }
      );

      serviceRef.current = service;
      await service.connect();
    } catch (err) {
      console.error('[CamChat] Connect error:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      toast.error('Failed to connect');
    }
  };

  /**
   * Start camera
   */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment', // Rear camera
        },
      });

      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsCameraOn(true);

      // Start sending frames at 1 FPS
      frameIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, 1000);

      toast.success('Camera started');
    } catch (err) {
      console.error('[CamChat] Camera error:', err);
      toast.error('Failed to start camera');
    }
  };

  /**
   * Stop camera
   */
  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    setIsCameraOn(false);
    toast.success('Camera stopped');
  };

  /**
   * Capture video frame and send to Gemini
   */
  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || !serviceRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 JPEG
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // Send to Gemini
    serviceRef.current.sendVideo(base64Image);

    // Update last frame preview
    setLastFrame(canvas.toDataURL('image/jpeg', 0.5));
  };

  /**
   * Start listening (microphone)
   */
  const startListening = async () => {
    try {
      if (!serviceRef.current?.isConnected()) {
        throw new Error('Not connected to CamChat');
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
        const audioData = event.data;
        const base64Audio = arrayBufferToBase64(audioData);
        serviceRef.current?.sendAudio(base64Audio);
      };

      source.connect(audioWorklet);
      audioWorklet.connect(audioContext.destination);

      setIsListening(true);
      toast.success('Listening...');
    } catch (err) {
      console.error('[CamChat] Microphone error:', err);
      toast.error('Failed to start microphone');
    }
  };

  /**
   * Stop listening
   */
  const stopListening = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsListening(false);
    toast.success('Stopped listening');
  };

  /**
   * Disconnect
   */
  const handleDisconnect = () => {
    stopListening();
    stopCamera();

    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
    }

    setIsConnected(false);
    setMessages([]);
    setLastFrame(null);
    toast.success('Disconnected');
  };

  /**
   * Play audio from Gemini
   */
  const playAudio = async (base64Audio: string) => {
    try {
      setIsSpeaking(true);

      const audioData = base64ToArrayBuffer(base64Audio);
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const audioBuffer = await audioContext.decodeAudioData(audioData);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        setIsSpeaking(false);
        audioContext.close();
      };

      source.start();
    } catch (err) {
      console.error('[CamChat] Audio playback error:', err);
      setIsSpeaking(false);
    }
  };

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      handleDisconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Camera Preview */}
      {isCameraOn && (
        <div className="relative w-full aspect-video bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {/* Visual indicators */}
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-red-600/80 rounded-full">
              <Eye className="w-3 h-3" />
              <span className="text-xs">AI Watching</span>
            </div>
            {isListening && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-600/80 rounded-full animate-pulse">
                <Activity className="w-3 h-3" />
                <span className="text-xs">Listening</span>
              </div>
            )}
          </div>
          {/* Last frame sent */}
          {lastFrame && (
            <div className="absolute bottom-2 right-2 w-20 h-20 border-2 border-purple-500 rounded">
              <img src={lastFrame} alt="Last frame" className="w-full h-full object-cover" />
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-purple-500 rounded-full animate-ping" />
            </div>
          )}
        </div>
      )}

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

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
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs opacity-60">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                  {message.hasVisual && (
                    <Eye className="w-3 h-3 opacity-60" />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading Indicators */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              <span className="text-sm text-gray-400">Analyzing...</span>
            </div>
          </motion.div>
        )}

        {isSpeaking && (
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
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && !isConnected && (
          <div className="text-center py-12">
            <Video className="w-16 h-16 text-purple-500 mx-auto mb-4 opacity-50" />
            <p className="text-gray-400 mb-2">CamChat: AI sees and hears</p>
            <p className="text-sm text-gray-500">
              Connect, start camera, and speak to manage inventory
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center justify-center gap-4">
          {/* Connect/Disconnect */}
          {!isConnected ? (
            <button
              onClick={handleConnect}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
            >
              Connect
            </button>
          ) : (
            <>
              {/* Camera Toggle */}
              <button
                onClick={isCameraOn ? stopCamera : startCamera}
                disabled={isThinking || isSpeaking}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isCameraOn
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-700 hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isCameraOn ? (
                  <Video className="w-8 h-8" />
                ) : (
                  <VideoOff className="w-8 h-8" />
                )}
              </button>

              {/* Mic Toggle */}
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isThinking || isSpeaking}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-red-600 hover:bg-red-700 scale-110 animate-pulse'
                    : 'bg-green-600 hover:bg-green-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isListening ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </button>

              {/* Disconnect */}
              <button
                onClick={handleDisconnect}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Disconnect
              </button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 text-center">
          {!isConnected && (
            <p className="text-sm text-gray-500">
              Click Connect to start multimodal conversation
            </p>
          )}
          {isConnected && !isCameraOn && !isListening && (
            <p className="text-sm text-gray-500">
              Turn on camera and microphone to begin
            </p>
          )}
          {isCameraOn && !isListening && (
            <p className="text-sm text-gray-500">
              Camera active. Click microphone to speak.
            </p>
          )}
          {isListening && (
            <p className="text-sm text-green-500 animate-pulse">
              🎤 Listening and 👁️ Watching... Speak naturally
            </p>
          )}
        </div>
      </div>
    </div>
  );
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
