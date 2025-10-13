// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/logger/voice-logger.ts
// purpose: Specialized voice interaction logging with audio quality metrics and speech analytics
// spec_ref: core#voice-logger
// version: 2025-08-1
// domain: core-infrastructure
// phase: 1
// complexity_budget: medium
// offline_capability: REQUIRED
// estimated_llm_cost: 0.0

// dependencies:
//   - src/core/logger/logger.ts
//   - src/core/config/environment.ts

// exports:
//   - VoiceLogger: class - Voice-specific logging service
//   - logVoiceCommand(command: string, confidence: number, context: VoiceContext): void - Command logging
//   - logSpeechRecognition(result: SpeechResult): void - STT result logging
//   - logTextToSpeech(text: string, options: TTSOptions): void - TTS event logging
//   - VoiceContext: interface - Voice interaction context
//   - SpeechResult: interface - Speech recognition result data

// voice_considerations: |
//   All voice logs should include audio quality metrics for troubleshooting.
//   Support voice commands for querying recent voice interaction history.
//   Voice logging should capture user intent progression and fulfillment status.
//   Failed voice interactions should trigger detailed diagnostic logging.

// security_considerations: |
//   Voice logs must never store actual audio data or transcribed sensitive information.
//   User voice patterns and biometric data must not be logged or stored.
//   Voice command logs should use hashed user IDs to protect privacy.
//   Implement automatic expiration for voice interaction logs (default: 30 days).

// performance_considerations: |
//   Voice logging should be completely non-blocking to prevent speech delays.
//   Use efficient audio quality metrics calculation with minimal CPU overhead.
//   Batch voice log entries to reduce I/O frequency during active voice sessions.
//   Cache voice context data to avoid repeated metadata lookups.

// tasks:
//     1. Create VoiceLogger class extending base Logger with voice-specific features
//     2. Implement voice command logging with confidence scores and intent classification
//     3. Add speech recognition result logging with quality metrics and error rates
//     4. Create text-to-speech event logging with voice synthesis parameters
//     5. Implement audio quality metrics collection (noise levels, clarity, volume)
//     6. Add voice session tracking with conversation flow analysis
//     7. Create voice interaction analytics for performance optimization
//     8. Implement voice error diagnostic logging with troubleshooting context
//     9. Add voice usage pattern analysis for user experience improvements
//     10. Create voice log export functionality for external analysis tools
// --- END DIRECTIVE BLOCK ---

import { Logger, createLogger, LogContext } from './logger';

export interface VoiceContext {
  sessionId: string;
  confidence?: number;
  audioQuality?: number;
  deviceInfo?: any;
}

export interface SpeechResult {
  text: string;
  confidence: number;
  duration: number;
  language?: string;
}

export interface TTSOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
}

export interface VoiceInteractionLog {
  action: string;
  duration?: number;
  provider?: string;
  voice?: string;
  metadata?: Record<string, any>;
  [key: string]: unknown;
}

export class VoiceLogger extends Logger {
  constructor() {
    super('voice-logger');
  }
  
  logVoiceCommand(command: string, confidence: number, context: VoiceContext): void {
    this.info(`Voice command: ${command}`, {
      confidence,
      sessionId: context.sessionId,
      audioQuality: context.audioQuality
    });
  }
  
  logSpeechRecognition(result: SpeechResult): void {
    this.debug('Speech recognition result', {
      text: result.text,
      confidence: result.confidence,
      duration: result.duration
    });
  }
  
  logTextToSpeech(text: string, options: TTSOptions): void {
    this.debug('TTS synthesis', {
      textLength: text.length,
      voice: options.voice,
      rate: options.rate
    });
  }

  async logVoiceInteraction(entry: VoiceInteractionLog): Promise<void> {
    this.info('Voice interaction event', entry);
  }

  /**
   * Speak text to user (voice output)
   */
  async speak(message: string, context?: { voiceSessionId?: string }): Promise<void> {
    this.info(`Speaking: ${message}`, context);
    // In real implementation, would trigger TTS
  }

  /**
   * Speak error message to user
   */
  async speakError(message: string, options?: { priority?: 'high' | 'normal' }): Promise<void> {
    this.error(`Speaking error: ${message}`, { priority: options?.priority });
    // In real implementation, would trigger TTS with error tone
  }

  /**
   * Start voice command session
   */
  startCommand(sessionId: string): void {
    this.info('Voice command session started', { sessionId });
  }

  /**
   * End voice command session
   */
  endCommand(sessionId: string, success: boolean = true): void {
    this.info('Voice command session ended', { sessionId, success });
  }

  /**
   * Get voice interaction history
   */
  async getVoiceHistory(sessionId?: string, limit: number = 50): Promise<any[]> {
    this.debug('Retrieving voice history', { sessionId, limit });
    // In real implementation, would query voice logs from database
    return [];
  }

  /**
   * Get voice interaction statistics
   */
  async getVoiceStats(sessionId?: string): Promise<{
    totalCommands: number;
    successfulCommands: number;
    failedCommands: number;
    successRate: number;
    averageDuration: number;
    averageConfidence: number;
  }> {
    this.debug('Retrieving voice stats', { sessionId });
    // In real implementation, would calculate from voice logs
    return {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      successRate: 0,
      averageDuration: 0,
      averageConfidence: 0,
    };
  }
}

const voiceLogger = new VoiceLogger();
export { voiceLogger };
export const logger = voiceLogger; // Add this export for backward compatibility
export const logVoiceCommand = voiceLogger.logVoiceCommand.bind(voiceLogger);
export const logSpeechRecognition = voiceLogger.logSpeechRecognition.bind(voiceLogger);
export const logTextToSpeech = voiceLogger.logTextToSpeech.bind(voiceLogger);
