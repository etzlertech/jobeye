/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/domains/intent/services/voice-command.service.ts
 * phase: 3
 * domain: intent
 * purpose: Service for processing voice commands with STT/TTS integration
 * spec_ref: 007-mvp-intent-driven/contracts/voice-api.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: {
 *   states: ['idle', 'listening', 'processing', 'speaking'],
 *   transitions: [
 *     'idle->listening: startListening()',
 *     'listening->processing: speechDetected()',
 *     'processing->speaking: commandProcessed()',
 *     'speaking->idle: speechComplete()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "processCommand": "$0.006 (STT) + $0.02 (LLM) + $0.015 (TTS) = ~$0.04"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: [
 *     './ai-interaction-logger.service',
 *     '@/core/errors/error-types'
 *   ],
 *   external: ['openai'],
 *   supabase: []
 * }
 * exports: ['VoiceCommandService', 'VoiceCommandResult', 'VoiceSettings']
 * voice_considerations: Core service for all voice interactions
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/domains/intent/services/voice-command.test.ts'
 * }
 * tasks: [
 *   'Implement STT with Web Speech API fallback',
 *   'Create command processing with context',
 *   'Add TTS response generation',
 *   'Implement voice settings management'
 * ]
 */

import { AIInteractionLogger } from './ai-interaction-logger.service';
import { AppError } from '@/core/errors/error-types';

export interface VoiceCommandResult {
  transcript: string;
  intent: string;
  confidence: number;
  response: {
    text: string;
    audioUrl?: string;
    actions?: any[];
  };
  metadata: {
    processingTimeMs: number;
    sttDuration: number;
    llmDuration: number;
    ttsDuration: number;
  };
}

export interface VoiceSettings {
  language: string;
  voiceSpeed: number;
  voicePitch: number;
  autoSpeak: boolean;
  confirmActions: boolean;
}

export interface ProcessCommandOptions {
  transcript: string;
  userId: string;
  tenantId: string;
  context: {
    role: 'supervisor' | 'crew' | 'admin';
    currentPage?: string;
    previousCommands?: string[];
    activeJobId?: string;
  };
  settings?: VoiceSettings;
}

export class VoiceCommandService {
  private aiLogger: AIInteractionLogger;
  private defaultSettings: VoiceSettings = {
    language: 'en-US',
    voiceSpeed: 1.0,
    voicePitch: 1.0,
    autoSpeak: true,
    confirmActions: true
  };

  constructor() {
    this.aiLogger = new AIInteractionLogger();
  }

  /**
   * Process voice command end-to-end
   */
  async processCommand(
    options: ProcessCommandOptions
  ): Promise<VoiceCommandResult> {
    const startTime = Date.now();
    const timings = {
      sttDuration: 0,
      llmDuration: 0,
      ttsDuration: 0
    };

    try {
      // Step 1: Process with LLM
      const llmStart = Date.now();
      const commandAnalysis = await this.analyzeCommand(options);
      timings.llmDuration = Date.now() - llmStart;

      // Step 2: Generate voice response
      const ttsStart = Date.now();
      const audioUrl = await this.generateSpeech(
        commandAnalysis.response,
        options.settings || this.defaultSettings
      );
      timings.ttsDuration = Date.now() - ttsStart;

      // Log all AI interactions
      await this.logInteractions(options, commandAnalysis, timings);

      return {
        transcript: options.transcript,
        intent: commandAnalysis.intent,
        confidence: commandAnalysis.confidence,
        response: {
          text: commandAnalysis.response,
          audioUrl,
          actions: commandAnalysis.actions
        },
        metadata: {
          processingTimeMs: Date.now() - startTime,
          ...timings
        }
      };
    } catch (error) {
      throw new AppError('Failed to process voice command', {
        code: 'VOICE_COMMAND_ERROR',
        details: error
      });
    }
  }

  /**
   * Transcribe audio to text
   */
  async transcribeAudio(
    audioBlob: Blob,
    settings: VoiceSettings
  ): Promise<{
    transcript: string;
    confidence: number;
    duration: number;
  }> {
    const startTime = Date.now();

    try {
      // Use OpenAI Whisper API
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', settings.language.split('-')[0]);

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const result = await response.json();

      return {
        transcript: result.text,
        confidence: result.confidence || 0.9,
        duration: Date.now() - startTime
      };
    } catch (error) {
      // Fallback to Web Speech API if available
      if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
        return this.transcribeWithWebSpeech(audioBlob, settings);
      }
      
      throw new AppError('Transcription failed', {
        code: 'STT_ERROR',
        details: error
      });
    }
  }

  /**
   * Analyze command with LLM
   */
  private async analyzeCommand(
    options: ProcessCommandOptions
  ): Promise<{
    intent: string;
    confidence: number;
    response: string;
    actions?: any[];
  }> {
    const { transcript, context } = options;

    // Build context-aware prompt
    const prompt = this.buildCommandPrompt(transcript, context);

    const response = await fetch('/api/ai/analyze-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: 'gpt-3.5-turbo',
        temperature: 0.3,
        maxTokens: 500
      })
    });

    if (!response.ok) {
      throw new Error('Command analysis failed');
    }

    const result = await response.json();
    
    // Parse structured response
    return this.parseCommandResponse(result.content);
  }

  /**
   * Build command analysis prompt
   */
  private buildCommandPrompt(
    transcript: string,
    context: any
  ): string {
    const roleContext = {
      supervisor: `You are helping a supervisor manage field service operations. They can:
- Add inventory items
- Create and assign jobs
- Check crew status
- View reports`,
      crew: `You are helping a crew member complete field service jobs. They can:
- View assigned jobs
- Verify equipment
- Report issues
- Update job status`,
      admin: `You are helping an admin manage the system. They have full access to all features.`
    };

    return `You are a voice assistant for a field service management app.

User Role: ${context.role}
${roleContext[context.role]}

Current Page: ${context.currentPage || 'dashboard'}
${context.previousCommands ? `Recent Commands: ${context.previousCommands.join(', ')}` : ''}
${context.activeJobId ? `Active Job: ${context.activeJobId}` : ''}

User said: "${transcript}"

Analyze the command and respond with a JSON object:
{
  "intent": "specific_intent_name",
  "confidence": 0.0-1.0,
  "response": "Natural response to speak back",
  "actions": [
    {
      "type": "navigate|update|create|show",
      "target": "specific target",
      "parameters": {}
    }
  ],
  "requiresConfirmation": true/false
}

Intent options based on role:
${this.getIntentOptions(context.role)}

Keep responses concise and natural for speech.`;
  }

  /**
   * Get valid intents for role
   */
  private getIntentOptions(role: string): string {
    const intents = {
      supervisor: `- add_inventory: Adding new equipment/materials
- create_job: Creating a new job
- assign_job: Assigning job to crew
- check_status: Checking job or crew status
- view_reports: Viewing reports`,
      crew: `- view_jobs: Viewing assigned jobs
- start_job: Starting a job
- verify_equipment: Verifying equipment load
- report_issue: Reporting maintenance issue
- complete_job: Marking job complete`,
      admin: 'All supervisor and crew intents plus system management'
    };

    return intents[role as keyof typeof intents] || '';
  }

  /**
   * Parse LLM response
   */
  private parseCommandResponse(content: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.intent || !parsed.response) {
        throw new Error('Missing required fields');
      }

      return {
        intent: parsed.intent,
        confidence: parsed.confidence || 0.8,
        response: parsed.response,
        actions: parsed.actions || []
      };
    } catch (error) {
      // Fallback response
      return {
        intent: 'unknown',
        confidence: 0.5,
        response: 'I didn\'t understand that. Could you please repeat?',
        actions: []
      };
    }
  }

  /**
   * Generate speech from text
   */
  private async generateSpeech(
    text: string,
    settings: VoiceSettings
  ): Promise<string | undefined> {
    if (!settings.autoSpeak) {
      return undefined;
    }

    try {
      const response = await fetch('/api/ai/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: 'nova', // OpenAI TTS voice
          speed: settings.voiceSpeed,
          pitch: settings.voicePitch
        })
      });

      if (!response.ok) {
        throw new Error('TTS generation failed');
      }

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      // Fallback to browser TTS if available
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        this.speakWithBrowserTTS(text, settings);
      }
      
      return undefined;
    }
  }

  /**
   * Fallback to Web Speech API for transcription
   */
  private async transcribeWithWebSpeech(
    audioBlob: Blob,
    settings: VoiceSettings
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = settings.language;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const result = event.results[0][0];
        resolve({
          transcript: result.transcript,
          confidence: result.confidence,
          duration: 0
        });
      };

      recognition.onerror = (event: any) => {
        reject(new Error(`Speech recognition error: ${event.error}`));
      };

      // Note: Web Speech API doesn't directly accept audio blobs
      // This is a simplified example
      recognition.start();
    });
  }

  /**
   * Fallback to browser TTS
   */
  private speakWithBrowserTTS(
    text: string,
    settings: VoiceSettings
  ): void {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settings.language;
    utterance.rate = settings.voiceSpeed;
    utterance.pitch = settings.voicePitch;
    
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Log all AI interactions
   */
  private async logInteractions(
    options: ProcessCommandOptions,
    result: any,
    timings: any
  ): Promise<void> {
    const { userId, tenantId, transcript } = options;

    // Log LLM interaction
    await this.aiLogger.logInteraction({
      userId,
      tenantId,
      interactionType: 'llm',
      modelUsed: 'gpt-3.5-turbo',
      prompt: this.buildCommandPrompt(transcript, options.context),
      response: result,
      responseTimeMs: timings.llmDuration,
      costUsd: 0.002
    });

    // Log TTS if used
    if (result.response && options.settings?.autoSpeak) {
      await this.aiLogger.logInteraction({
        userId,
        tenantId,
        interactionType: 'tts',
        modelUsed: 'tts-1',
        prompt: result.response,
        response: { audioGenerated: true },
        responseTimeMs: timings.ttsDuration,
        costUsd: (result.response.length / 1000) * 0.015
      });
    }
  }

  /**
   * Get voice settings for user
   */
  async getUserSettings(userId: string): Promise<VoiceSettings> {
    // In a real app, this would fetch from database
    const stored = localStorage.getItem(`voice_settings_${userId}`);
    if (stored) {
      return { ...this.defaultSettings, ...JSON.parse(stored) };
    }
    return this.defaultSettings;
  }

  /**
   * Update voice settings
   */
  async updateUserSettings(
    userId: string,
    settings: Partial<VoiceSettings>
  ): Promise<void> {
    const current = await this.getUserSettings(userId);
    const updated = { ...current, ...settings };
    localStorage.setItem(`voice_settings_${userId}`, JSON.stringify(updated));
  }
}