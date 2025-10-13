// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/voice/services/text-to-speech-service.ts
// phase: 3
// domain: voice-pipeline
// purpose: Text-to-speech synthesis for voice feedback and confirmations
// spec_ref: phase3/voice-pipeline#tts-integration
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: OPTIONAL
//
// dependencies:
//   internal:
//     - /src/domains/voice/types/voice-types
//     - /src/core/logger/voice-logger
//     - /src/core/config/environment
//   external:
//     - openai: ^4.0.0
//
// exports:
//   - TextToSpeechService: class - TTS service
//   - synthesizeSpeech: function - Convert text to audio
//   - streamSpeech: function - Stream audio generation
//   - getAvailableVoices: function - List voice options
//
// voice_considerations: |
//   Natural sounding voice synthesis.
//   Multiple voice options for different contexts.
//   Speed and pitch control.
//   Emphasis and prosody support.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/voice/services/text-to-speech-service.test.ts
//
// tasks:
//   1. Implement OpenAI TTS integration
//   2. Add browser Speech Synthesis API
//   3. Create voice selection logic
//   4. Implement audio streaming
//   5. Add caching for common phrases
//   6. Create offline fallback
// --- END DIRECTIVE BLOCK ---

import { VoiceLogger } from '@/core/logger/voice-logger';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { config } from '@/core/config/environment';

// Speech synthesis result
export interface SpeechResult {
  audioData: ArrayBuffer | Blob;
  duration: number;
  format: string;
  voice: string;
  cached?: boolean;
}

// Voice configuration
export interface VoiceConfig {
  voice?: string;
  speed?: number; // 0.5 - 2.0
  pitch?: number; // 0.5 - 2.0
  volume?: number; // 0 - 1
  language?: string;
  emphasis?: 'normal' | 'reduced' | 'strong';
}

// Available voices
export interface Voice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  provider: string;
  natural?: boolean;
  styles?: string[];
}

// Provider types
export enum TTSProvider {
  OPENAI = 'openai',
  BROWSER_API = 'browser_api',
  OFFLINE = 'offline',
}

export class TextToSpeechService {
  private logger: VoiceLogger;
  private openaiApiKey?: string;
  private currentProvider: TTSProvider;
  private speechSynthesis?: SpeechSynthesis;
  private audioCache: Map<string, SpeechResult>;
  private cacheSize = 100; // Max cached phrases

  constructor(logger?: VoiceLogger) {
    this.logger = logger || new VoiceLogger();
    this.openaiApiKey = config.voice.openai?.apiKey;
    this.currentProvider = this.determineProvider();
    this.audioCache = new Map();
    this.initializeBrowserAPI();
  }

  /**
   * Convert text to speech audio
   */
  async synthesizeSpeech(
    text: string,
    options?: VoiceConfig & {
      sessionId?: string;
      userId?: string;
      useCache?: boolean;
    }
  ): Promise<SpeechResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      if (options?.useCache !== false) {
        const cached = this.getCachedAudio(text, options);
        if (cached) {
          await this.logger.logVoiceInteraction({
            action: 'tts_cache_hit',
            duration: Date.now() - startTime,
            metadata: {
              sessionId: options?.sessionId,
              userId: options?.userId,
              textLength: text.length,
            },
          });
          return cached;
        }
      }

      let result: SpeechResult;

      switch (this.currentProvider) {
        case TTSProvider.OPENAI:
          result = await this.synthesizeWithOpenAI(text, options);
          break;
        case TTSProvider.BROWSER_API:
          result = await this.synthesizeWithBrowserAPI(text, options);
          break;
        case TTSProvider.OFFLINE:
          result = await this.synthesizeOffline(text, options);
          break;
        default:
          throw new Error('No TTS provider available');
      }

      // Cache the result
      if (options?.useCache !== false) {
        this.cacheAudio(text, options, result);
      }

      // Log synthesis
      await this.logger.logVoiceInteraction({
        action: 'text_synthesized',
        duration: Date.now() - startTime,
        provider: this.currentProvider,
        voice: result.voice,
        metadata: {
          sessionId: options?.sessionId,
          userId: options?.userId,
          textLength: text.length,
          audioDuration: result.duration,
          cached: false,
        },
      });

      return result;
    } catch (error) {
      // Try fallback providers
      if (this.currentProvider === TTSProvider.OPENAI) {
        this.logger.warn('OpenAI TTS failed, falling back to browser API');
        this.currentProvider = TTSProvider.BROWSER_API;
        return this.synthesizeSpeech(text, options);
      }

      throw createAppError({
        code: 'TTS_SYNTHESIS_FAILED',
        message: 'Failed to synthesize speech',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.EXTERNAL_SERVICE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Stream speech synthesis for real-time playback
   */
  async streamSpeech(
    text: string,
    options?: VoiceConfig & {
      onChunk?: (chunk: ArrayBuffer) => void;
      sessionId?: string;
      userId?: string;
    }
  ): Promise<void> {
    if (this.currentProvider !== TTSProvider.OPENAI) {
      // Fallback to regular synthesis for non-streaming providers
      const result = await this.synthesizeSpeech(text, options);
      if (options?.onChunk && result.audioData instanceof ArrayBuffer) {
        options.onChunk(result.audioData);
      }
      return;
    }

    // Stream with OpenAI
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: this.openaiApiKey });

    try {
      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: (options?.voice as any) || 'nova',
        input: text,
        response_format: 'mp3',
        speed: options?.speed || 1.0,
      });

      // Stream the response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (options?.onChunk && value) {
          options.onChunk(value.buffer);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded for OpenAI TTS');
      }
      throw error;
    }
  }

  /**
   * Get available voices for the current provider
   */
  async getAvailableVoices(): Promise<Voice[]> {
    switch (this.currentProvider) {
      case TTSProvider.OPENAI:
        return this.getOpenAIVoices();
      case TTSProvider.BROWSER_API:
        return this.getBrowserVoices();
      default:
        return [];
    }
  }

  /**
   * Synthesize with OpenAI TTS
   */
  private async synthesizeWithOpenAI(
    text: string,
    options?: VoiceConfig
  ): Promise<SpeechResult> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: this.openaiApiKey });

    try {
      // Select model based on quality needs
      const model = options?.emphasis === 'strong' ? 'tts-1-hd' : 'tts-1';
      
      const response = await openai.audio.speech.create({
        model,
        voice: (options?.voice as any) || 'nova',
        input: text,
        response_format: 'mp3',
        speed: options?.speed || 1.0,
      });

      // Convert response to ArrayBuffer
      const audioData = await response.arrayBuffer();
      
      // Estimate duration (OpenAI doesn't provide this)
      const wordsPerMinute = 150 * (options?.speed || 1.0);
      const wordCount = text.split(/\s+/).length;
      const duration = (wordCount / wordsPerMinute) * 60;

      return {
        audioData,
        duration,
        format: 'mp3',
        voice: options?.voice || 'nova',
      };
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded for OpenAI TTS');
      }
      throw error;
    }
  }

  /**
   * Synthesize with browser Speech Synthesis API
   */
  private async synthesizeWithBrowserAPI(
    text: string,
    options?: VoiceConfig
  ): Promise<SpeechResult> {
    if (!this.speechSynthesis) {
      throw new Error('Browser speech synthesis not available');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure voice settings
      if (options?.voice) {
        const voices = this.speechSynthesis!.getVoices();
        const voice = voices.find(v => v.name === options.voice);
        if (voice) utterance.voice = voice;
      }
      
      utterance.rate = options?.speed || 1.0;
      utterance.pitch = options?.pitch || 1.0;
      utterance.volume = options?.volume || 1.0;
      utterance.lang = options?.language || 'en-US';

      // Capture audio using MediaStream Recording API
      const audioChunks: BlobPart[] = [];
      const startTime = Date.now();
      
      utterance.onstart = () => {
        // Start recording if possible
        this.startRecording(audioChunks);
      };

      utterance.onend = () => {
        const duration = (Date.now() - startTime) / 1000;
        
        // Stop recording and create blob
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        resolve({
          audioData: audioBlob,
          duration,
          format: 'webm',
          voice: utterance.voice?.name || 'default',
        });
      };

      utterance.onerror = (event) => {
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      // Speak the utterance
      this.speechSynthesis!.speak(utterance);
    });
  }

  /**
   * Offline speech synthesis
   */
  private async synthesizeOffline(
    text: string,
    options?: VoiceConfig
  ): Promise<SpeechResult> {
    // In a real implementation, this would use a local TTS engine
    // For now, return a placeholder
    this.logger.warn('Using offline TTS mode - no audio available');
    
    const duration = text.length / 15; // Rough estimate
    
    return {
      audioData: new ArrayBuffer(0),
      duration,
      format: 'none',
      voice: 'offline',
    };
  }

  /**
   * Get OpenAI available voices
   */
  private getOpenAIVoices(): Voice[] {
    return [
      {
        id: 'alloy',
        name: 'Alloy',
        language: 'en-US',
        gender: 'neutral',
        provider: 'openai',
        natural: true,
      },
      {
        id: 'echo',
        name: 'Echo',
        language: 'en-US',
        gender: 'male',
        provider: 'openai',
        natural: true,
      },
      {
        id: 'fable',
        name: 'Fable',
        language: 'en-US',
        gender: 'male',
        provider: 'openai',
        natural: true,
      },
      {
        id: 'onyx',
        name: 'Onyx',
        language: 'en-US',
        gender: 'male',
        provider: 'openai',
        natural: true,
      },
      {
        id: 'nova',
        name: 'Nova',
        language: 'en-US',
        gender: 'female',
        provider: 'openai',
        natural: true,
      },
      {
        id: 'shimmer',
        name: 'Shimmer',
        language: 'en-US',
        gender: 'female',
        provider: 'openai',
        natural: true,
      },
    ];
  }

  /**
   * Get browser available voices
   */
  private getBrowserVoices(): Voice[] {
    if (!this.speechSynthesis) return [];

    return this.speechSynthesis.getVoices().map(voice => ({
      id: voice.name,
      name: voice.name,
      language: voice.lang,
      gender: this.inferGender(voice.name),
      provider: 'browser',
      natural: voice.name.toLowerCase().includes('natural'),
    }));
  }

  /**
   * Determine which provider to use
   */
  private determineProvider(): TTSProvider {
    if (this.openaiApiKey) {
      return TTSProvider.OPENAI;
    }
    
    if (typeof window !== 'undefined' && this.isBrowserAPIAvailable()) {
      return TTSProvider.BROWSER_API;
    }
    
    return TTSProvider.OFFLINE;
  }

  /**
   * Initialize browser Speech Synthesis API
   */
  private initializeBrowserAPI(): void {
    if (typeof window === 'undefined') return;

    this.speechSynthesis = window.speechSynthesis;
  }

  /**
   * Check if browser API is available
   */
  private isBrowserAPIAvailable(): boolean {
    return typeof window !== 'undefined' && 
           'speechSynthesis' in window;
  }

  /**
   * Get cached audio if available
   */
  private getCachedAudio(text: string, options?: VoiceConfig): SpeechResult | null {
    const cacheKey = this.generateCacheKey(text, options);
    const cached = this.audioCache.get(cacheKey);
    
    if (cached) {
      return { ...cached, cached: true };
    }
    
    return null;
  }

  /**
   * Cache audio result
   */
  private cacheAudio(text: string, options: VoiceConfig | undefined, result: SpeechResult): void {
    // Implement LRU cache
    if (this.audioCache.size >= this.cacheSize) {
      const firstKey = this.audioCache.keys().next().value;
      if (typeof firstKey === 'string') {
        this.audioCache.delete(firstKey);
      }
    }
    
    const cacheKey = this.generateCacheKey(text, options);
    this.audioCache.set(cacheKey, result);
  }

  /**
   * Generate cache key from text and options
   */
  private generateCacheKey(text: string, options?: VoiceConfig): string {
    const voiceOptions = options ?? {};
    return `${text}:${voiceOptions.voice || 'default'}:${voiceOptions.speed || 1}:${voiceOptions.pitch || 1}`;
  }

  /**
   * Infer gender from voice name
   */
  private inferGender(voiceName: string): 'male' | 'female' | 'neutral' {
    const lowerName = voiceName.toLowerCase();
    
    if (lowerName.includes('female') || lowerName.includes('woman') || 
        lowerName.includes('girl') || lowerName.includes('lady')) {
      return 'female';
    }
    
    if (lowerName.includes('male') || lowerName.includes('man') || 
        lowerName.includes('boy') || lowerName.includes('guy')) {
      return 'male';
    }
    
    return 'neutral';
  }

  /**
   * Start recording audio (placeholder for browser API)
   */
  private startRecording(chunks: BlobPart[]): void {
    // In a real implementation, this would use MediaRecorder API
    // to capture the audio output from speechSynthesis
    // This is a limitation of the browser API
  }

  /**
   * Preload common phrases for faster response
   */
  async preloadPhrases(phrases: string[], options?: VoiceConfig): Promise<void> {
    const promises = phrases.map(phrase => 
      this.synthesizeSpeech(phrase, { ...options, useCache: true })
        .catch(error => this.logger.warn(`Failed to preload phrase: ${phrase}`, error))
    );
    
    await Promise.all(promises);
    this.logger.info(`Preloaded ${phrases.length} phrases`);
  }

  /**
   * Clear audio cache
   */
  clearCache(): void {
    this.audioCache.clear();
    this.logger.info('TTS audio cache cleared');
  }
}
