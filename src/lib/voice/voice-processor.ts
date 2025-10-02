/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/lib/voice/voice-processor.ts
 * phase: 3
 * domain: voice
 * purpose: Voice command processor for speech-to-text, intent recognition, and text-to-speech
 * spec_ref: 007-mvp-intent-driven/contracts/voice-processor.md
 * complexity_budget: 400
 * migrations_touched: []
 * state_machine: {
 *   states: ['idle', 'listening', 'processing', 'speaking', 'error'],
 *   transitions: [
 *     'idle->listening: startListening()',
 *     'listening->processing: speechDetected()',
 *     'processing->speaking: responseReady()',
 *     'speaking->idle: speechComplete()',
 *     'listening->idle: stopListening()',
 *     '*->error: errorOccurred()',
 *     'error->idle: reset()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "intentRecognition": "$0.01 per command (GPT-4 mini)",
 *   "voiceProcessing": "$0.00 (Web Speech API)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/lib/offline/offline-db',
 *     '@/lib/offline/sync-manager',
 *     '@/core/errors/error-types',
 *     '@/core/logger/voice-logger'
 *   ],
 *   external: [],
 *   supabase: []
 * }
 * exports: ['VoiceProcessor', 'VoiceCommand', 'VoiceResponse']
 * voice_considerations: Core voice processing service for MVP MVP Intent-Driven app
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/lib/voice/voice-processor.test.ts'
 * }
 * tasks: [
 *   'Implement Web Speech API integration',
 *   'Add intent recognition from voice commands',
 *   'Create text-to-speech response system',
 *   'Handle offline voice command queueing'
 * ]
 */

import { offlineDB, VoiceRecording } from '@/lib/offline/offline-db';
import { syncManager } from '@/lib/offline/sync-manager';
import { AppError } from '@/core/errors/error-types';
import { voiceLogger } from '@/core/logger/voice-logger';

export interface VoiceCommand {
  id: string;
  transcript: string;
  confidence: number;
  timestamp: number;
  audioBlob?: Blob;
  intent?: {
    action: string;
    entity?: string;
    parameters?: Record<string, any>;
    confidence: number;
  };
  context?: {
    page: string;
    userId: string;
    role: string;
    jobId?: string;
  };
}

export interface VoiceResponse {
  text: string;
  actions?: Array<{
    type: string;
    target?: string;
    data?: any;
  }>;
  shouldSpeak: boolean;
  audioUrl?: string;
}

export interface VoiceProcessorOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  autoSpeakResponses?: boolean;
  offlineMode?: boolean;
}

export class VoiceProcessor {
  private static instance: VoiceProcessor;
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening: boolean = false;
  private isProcessing: boolean = false;
  private isSpeaking: boolean = false;
  private currentMediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private options: VoiceProcessorOptions;

  private constructor(options: VoiceProcessorOptions = {}) {
    this.options = {
      language: 'en-US',
      continuous: false,
      interimResults: true,
      maxAlternatives: 1,
      autoSpeakResponses: true,
      offlineMode: false,
      ...options
    };

    this.initializeSpeechRecognition();
    this.initializeSpeechSynthesis();
  }

  static getInstance(options?: VoiceProcessorOptions): VoiceProcessor {
    if (!VoiceProcessor.instance) {
      VoiceProcessor.instance = new VoiceProcessor(options);
    }
    return VoiceProcessor.instance;
  }

  private initializeSpeechRecognition(): void {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      voiceLogger.warn('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    this.recognition.continuous = this.options.continuous || false;
    this.recognition.interimResults = this.options.interimResults || true;
    this.recognition.lang = this.options.language || 'en-US';
    this.recognition.maxAlternatives = this.options.maxAlternatives || 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      voiceLogger.info('Voice recognition started');
      this.dispatchEvent('voicestart');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      voiceLogger.info('Voice recognition ended');
      this.dispatchEvent('voiceend');
    };

    this.recognition.onerror = (event) => {
      voiceLogger.error('Voice recognition error', event.error);
      this.dispatchEvent('voiceerror', { error: event.error });
    };

    this.recognition.onresult = (event) => {
      this.handleSpeechResult(event);
    };
  }

  private initializeSpeechSynthesis(): void {
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    } else {
      voiceLogger.warn('Speech synthesis not supported in this browser');
    }
  }

  private async handleSpeechResult(event: SpeechRecognitionEvent): Promise<void> {
    try {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript.trim();
      const confidence = lastResult[0].confidence;
      const isFinal = lastResult.isFinal;

      voiceLogger.info('Speech result', { transcript, confidence, isFinal });

      if (isFinal && transcript) {
        const command: VoiceCommand = {
          id: `voice-${Date.now()}`,
          transcript,
          confidence,
          timestamp: Date.now(),
          audioBlob: await this.getRecordedAudio()
        };

        await this.processVoiceCommand(command);
      }

      this.dispatchEvent('voiceresult', { transcript, confidence, isFinal });
    } catch (error) {
      voiceLogger.error('Error handling speech result', error);
    }
  }

  async startListening(options?: {
    recordAudio?: boolean;
    context?: VoiceCommand['context'];
  }): Promise<void> {
    if (!this.recognition) {
      throw new AppError('Speech recognition not available', 'VOICE_NOT_SUPPORTED');
    }

    if (this.isListening) {
      this.stopListening();
    }

    try {
      // Start audio recording if requested
      if (options?.recordAudio) {
        await this.startAudioRecording();
      }

      this.recognition.start();
      
      // Store context for command processing
      if (options?.context) {
        this.currentContext = options.context;
      }

    } catch (error) {
      voiceLogger.error('Failed to start listening', error);
      throw new AppError('Failed to start voice recognition', 'VOICE_START_ERROR', { error });
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }

    if (this.currentMediaRecorder && this.currentMediaRecorder.state === 'recording') {
      this.currentMediaRecorder.stop();
    }
  }

  private async startAudioRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.currentMediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.currentMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.currentMediaRecorder.start(100); // Collect data every 100ms
    } catch (error) {
      voiceLogger.error('Failed to start audio recording', error);
    }
  }

  private async getRecordedAudio(): Promise<Blob | undefined> {
    if (!this.currentMediaRecorder || this.audioChunks.length === 0) {
      return undefined;
    }

    return new Blob(this.audioChunks, { type: 'audio/wav' });
  }

  private currentContext?: VoiceCommand['context'];

  async processVoiceCommand(command: VoiceCommand): Promise<VoiceResponse> {
    this.isProcessing = true;

    try {
      // Add context if available
      if (this.currentContext) {
        command.context = this.currentContext;
      }

      // Store voice recording offline if audio was captured
      if (command.audioBlob) {
        const recording: VoiceRecording = {
          id: command.id,
          blob: command.audioBlob,
          transcript: command.transcript,
          timestamp: command.timestamp,
          jobId: command.context?.jobId,
          syncStatus: 'pending'
        };

        await syncManager.queueVoiceRecording(recording);
      }

      // Recognize intent from transcript
      const intent = await this.recognizeIntent(command.transcript, command.context);
      command.intent = intent;

      // Generate response based on intent
      const response = await this.generateResponse(command);

      // Speak response if enabled
      if (this.options.autoSpeakResponses && response.shouldSpeak) {
        await this.speak(response.text);
      }

      // Log the interaction
      voiceLogger.info('Voice command processed', {
        command: command.transcript,
        intent: intent.action,
        response: response.text
      });

      this.dispatchEvent('commandprocessed', { command, response });

      return response;

    } catch (error) {
      voiceLogger.error('Failed to process voice command', error);
      
      const errorResponse: VoiceResponse = {
        text: 'Sorry, I had trouble processing your command. Please try again.',
        shouldSpeak: true
      };

      if (this.options.autoSpeakResponses) {
        await this.speak(errorResponse.text);
      }

      return errorResponse;
    } finally {
      this.isProcessing = false;
    }
  }

  private async recognizeIntent(transcript: string, context?: VoiceCommand['context']): Promise<VoiceCommand['intent']> {
    // For MVP, we'll use simple pattern matching
    // In production, this would call an LLM API
    const lowerTranscript = transcript.toLowerCase();

    // Navigation intents
    if (lowerTranscript.includes('show') || lowerTranscript.includes('go to') || lowerTranscript.includes('open')) {
      if (lowerTranscript.includes('job') || lowerTranscript.includes('jobs')) {
        return {
          action: 'navigate',
          entity: 'jobs',
          parameters: { target: '/crew' },
          confidence: 0.8
        };
      }
      if (lowerTranscript.includes('camera') || lowerTranscript.includes('photo')) {
        return {
          action: 'open_camera',
          entity: 'camera',
          confidence: 0.8
        };
      }
      if (lowerTranscript.includes('verify') || lowerTranscript.includes('load')) {
        return {
          action: 'navigate',
          entity: 'verification',
          parameters: { target: '/crew/load-verify' },
          confidence: 0.8
        };
      }
    }

    // Job management intents
    if (lowerTranscript.includes('start') || lowerTranscript.includes('begin')) {
      if (lowerTranscript.includes('job')) {
        return {
          action: 'start_job',
          entity: 'job',
          confidence: 0.7
        };
      }
    }

    if (lowerTranscript.includes('complete') || lowerTranscript.includes('finish') || lowerTranscript.includes('done')) {
      if (lowerTranscript.includes('job')) {
        return {
          action: 'complete_job',
          entity: 'job',
          confidence: 0.7
        };
      }
    }

    // Equipment/inventory intents
    if (lowerTranscript.includes('add') || lowerTranscript.includes('create')) {
      if (lowerTranscript.includes('equipment') || lowerTranscript.includes('item')) {
        return {
          action: 'add_equipment',
          entity: 'equipment',
          confidence: 0.7
        };
      }
    }

    // Admin intents (if admin role)
    if (context?.role === 'admin') {
      if (lowerTranscript.includes('user') || lowerTranscript.includes('account')) {
        return {
          action: 'manage_users',
          entity: 'users',
          parameters: { target: '/admin' },
          confidence: 0.8
        };
      }
    }

    // Default fallback intent
    return {
      action: 'unknown',
      confidence: 0.1
    };
  }

  private async generateResponse(command: VoiceCommand): Promise<VoiceResponse> {
    const intent = command.intent;
    if (!intent) {
      return {
        text: 'I didn\'t understand that command.',
        shouldSpeak: true
      };
    }

    switch (intent.action) {
      case 'navigate':
        return {
          text: `Navigating to ${intent.entity}`,
          actions: [{
            type: 'navigate',
            target: intent.parameters?.target
          }],
          shouldSpeak: true
        };

      case 'open_camera':
        return {
          text: 'Opening camera for photos',
          actions: [{
            type: 'open_camera'
          }],
          shouldSpeak: true
        };

      case 'start_job':
        return {
          text: 'Starting your job. Please select the job you want to begin.',
          actions: [{
            type: 'show_job_selection'
          }],
          shouldSpeak: true
        };

      case 'complete_job':
        return {
          text: 'Marking job as complete',
          actions: [{
            type: 'complete_current_job'
          }],
          shouldSpeak: true
        };

      case 'add_equipment':
        return {
          text: 'Opening equipment form',
          actions: [{
            type: 'show_equipment_form'
          }],
          shouldSpeak: true
        };

      case 'manage_users':
        return {
          text: 'Opening user management',
          actions: [{
            type: 'navigate',
            target: '/admin'
          }],
          shouldSpeak: true
        };

      default:
        return {
          text: 'I can help you navigate, manage jobs, or work with equipment. What would you like to do?',
          shouldSpeak: true
        };
    }
  }

  async speak(text: string, options?: {
    voice?: SpeechSynthesisVoice;
    rate?: number;
    pitch?: number;
    volume?: number;
  }): Promise<void> {
    if (!this.synthesis) {
      voiceLogger.warn('Speech synthesis not available');
      return;
    }

    return new Promise((resolve, reject) => {
      if (this.isSpeaking) {
        this.synthesis!.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      utterance.voice = options?.voice || null;
      utterance.rate = options?.rate || 1;
      utterance.pitch = options?.pitch || 1;
      utterance.volume = options?.volume || 1;

      utterance.onstart = () => {
        this.isSpeaking = true;
        voiceLogger.info('Started speaking', { text });
        this.dispatchEvent('speechstart', { text });
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        voiceLogger.info('Finished speaking');
        this.dispatchEvent('speechend');
        resolve();
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        voiceLogger.error('Speech synthesis error', event.error);
        this.dispatchEvent('speecherror', { error: event.error });
        reject(new AppError('Speech synthesis failed', 'SPEECH_ERROR', { error: event.error }));
      };

      this.synthesis.speak(utterance);
    });
  }

  stopSpeaking(): void {
    if (this.synthesis && this.isSpeaking) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) {
      return [];
    }
    return this.synthesis.getVoices();
  }

  // Status methods
  getStatus(): {
    isListening: boolean;
    isProcessing: boolean;
    isSpeaking: boolean;
    isSupported: boolean;
  } {
    return {
      isListening: this.isListening,
      isProcessing: this.isProcessing,
      isSpeaking: this.isSpeaking,
      isSupported: !!this.recognition && !!this.synthesis
    };
  }

  // Event system
  private dispatchEvent(type: string, detail?: any): void {
    const event = new CustomEvent(`voice:${type}`, { detail });
    window.dispatchEvent(event);
  }

  // Public event listeners
  onVoiceStart(callback: () => void): () => void {
    const handler = () => callback();
    window.addEventListener('voice:voicestart', handler);
    return () => window.removeEventListener('voice:voicestart', handler);
  }

  onVoiceEnd(callback: () => void): () => void {
    const handler = () => callback();
    window.addEventListener('voice:voiceend', handler);
    return () => window.removeEventListener('voice:voiceend', handler);
  }

  onVoiceResult(callback: (result: { transcript: string; confidence: number; isFinal: boolean }) => void): () => void {
    const handler = (event: CustomEvent) => callback(event.detail);
    window.addEventListener('voice:voiceresult', handler);
    return () => window.removeEventListener('voice:voiceresult', handler);
  }

  onCommandProcessed(callback: (data: { command: VoiceCommand; response: VoiceResponse }) => void): () => void {
    const handler = (event: CustomEvent) => callback(event.detail);
    window.addEventListener('voice:commandprocessed', handler);
    return () => window.removeEventListener('voice:commandprocessed', handler);
  }

  onSpeechStart(callback: (data: { text: string }) => void): () => void {
    const handler = (event: CustomEvent) => callback(event.detail);
    window.addEventListener('voice:speechstart', handler);
    return () => window.removeEventListener('voice:speechstart', handler);
  }

  onSpeechEnd(callback: () => void): () => void {
    const handler = () => callback();
    window.addEventListener('voice:speechend', handler);
    return () => window.removeEventListener('voice:speechend', handler);
  }

  // Cleanup
  destroy(): void {
    this.stopListening();
    this.stopSpeaking();
    
    if (this.currentMediaRecorder) {
      this.currentMediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }
}

// Export singleton instance
export const voiceProcessor = VoiceProcessor.getInstance();

// Types for global declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}