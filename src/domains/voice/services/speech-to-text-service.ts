// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/voice/services/speech-to-text-service.ts
// phase: 3
// domain: voice-pipeline
// purpose: Speech-to-text integration with OpenAI Whisper and fallback providers
// spec_ref: phase3/voice-pipeline#stt-integration
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
//   - SpeechToTextService: class - STT service
//   - transcribeAudio: function - Convert audio to text
//   - transcribeStream: function - Real-time transcription
//   - getSupportedLanguages: function - Get language list
//
// voice_considerations: |
//   Multiple provider support for reliability.
//   Automatic language detection.
//   Noise reduction and audio preprocessing.
//   Confidence scoring and alternatives.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/voice/services/speech-to-text-service.test.ts
//
// tasks:
//   1. Implement OpenAI Whisper integration
//   2. Add fallback provider support
//   3. Create audio preprocessing pipeline
//   4. Implement streaming transcription
//   5. Add language detection
//   6. Create offline fallback mode
// --- END DIRECTIVE BLOCK ---

import { VoiceLogger } from '@/core/logger/voice-logger';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { config } from '@/core/config/environment';

// Transcription result
export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration: number;
  alternatives?: Array<{
    text: string;
    confidence: number;
  }>;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

// Audio format configuration
export interface AudioConfig {
  sampleRate?: number;
  channels?: number;
  format?: 'wav' | 'mp3' | 'webm' | 'ogg';
}

// Provider types
export enum STTProvider {
  OPENAI_WHISPER = 'openai_whisper',
  BROWSER_API = 'browser_api',
  OFFLINE = 'offline',
}

export class SpeechToTextService {
  private logger: VoiceLogger;
  private openaiApiKey?: string;
  private currentProvider: STTProvider;
  private recognitionAPI?: any; // Browser SpeechRecognition API

  constructor(logger?: VoiceLogger) {
    this.logger = logger || new VoiceLogger();
    this.openaiApiKey = config.voice.openai?.apiKey;
    this.currentProvider = this.determineProvider();
    this.initializeBrowserAPI();
  }

  /**
   * Transcribe audio file to text
   */
  async transcribeAudio(
    audioData: Buffer | ArrayBuffer | Blob,
    options?: {
      language?: string;
      prompt?: string;
      sessionId?: string;
      userId?: string;
    }
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      // Convert audio data to appropriate format
      const audioBuffer = await this.prepareAudioData(audioData);
      
      let result: TranscriptionResult;

      switch (this.currentProvider) {
        case STTProvider.OPENAI_WHISPER:
          result = await this.transcribeWithWhisper(audioBuffer, options);
          break;
        case STTProvider.BROWSER_API:
          result = await this.transcribeWithBrowserAPI(audioBuffer, options);
          break;
        case STTProvider.OFFLINE:
          result = await this.transcribeOffline(audioBuffer, options);
          break;
        default:
          throw new Error('No STT provider available');
      }

      // Log transcription
      await this.logger.logVoiceInteraction({
        action: 'audio_transcribed',
        duration: Date.now() - startTime,
        provider: this.currentProvider,
        metadata: {
          confidence: result.confidence,
          language: result.language,
          sessionId: options?.sessionId,
          userId: options?.userId,
          textLength: result.text.length,
          audioDuration: result.duration,
        },
      });

      return result;
    } catch (error) {
      // Try fallback providers
      if (this.currentProvider === STTProvider.OPENAI_WHISPER) {
        this.logger.warn('Whisper API failed, falling back to browser API');
        this.currentProvider = STTProvider.BROWSER_API;
        return this.transcribeAudio(audioData, options);
      }

      throw createAppError({
        code: 'STT_TRANSCRIPTION_FAILED',
        message: 'Failed to transcribe audio',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.EXTERNAL_SERVICE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Real-time streaming transcription
   */
  async transcribeStream(
    audioStream: ReadableStream<Uint8Array>,
    options?: {
      language?: string;
      onPartialResult?: (text: string) => void;
      sessionId?: string;
      userId?: string;
    }
  ): Promise<TranscriptionResult> {
    if (this.currentProvider !== STTProvider.BROWSER_API) {
      throw new Error('Streaming transcription only available with browser API');
    }

    return new Promise((resolve, reject) => {
      if (!this.recognitionAPI) {
        reject(new Error('Browser speech recognition not available'));
        return;
      }

      const recognition = new this.recognitionAPI();
      const results: string[] = [];
      let finalResult = '';

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = options?.language || 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalResult += transcript + ' ';
            results.push(transcript);
          } else {
            interimTranscript += transcript;
          }
        }

        if (options?.onPartialResult && interimTranscript) {
          options.onPartialResult(finalResult + interimTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        reject(new Error(`Speech recognition error: ${event.error}`));
      };

      recognition.onend = () => {
        resolve({
          text: finalResult.trim(),
          confidence: 0.85, // Browser API doesn't provide confidence
          language: recognition.lang,
          duration: 0, // Not available in streaming mode
        });
      };

      // Start recognition
      recognition.start();

      // Process audio stream
      this.processAudioStream(audioStream, recognition);
    });
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages(): string[] {
    // Common languages supported by most providers
    return [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
      'ar', 'hi', 'nl', 'pl', 'tr', 'sv', 'da', 'no', 'fi', 'he',
    ];
  }

  /**
   * Transcribe with OpenAI Whisper
   */
  private async transcribeWithWhisper(
    audioBuffer: Buffer,
    options?: {
      language?: string;
      prompt?: string;
    }
  ): Promise<TranscriptionResult> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Dynamic import to avoid loading if not needed
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: this.openaiApiKey });

    try {
      // Create form data with audio file
      const audioArray = Uint8Array.from(audioBuffer);
      const audioFile = new File([audioArray.buffer], 'audio.webm', { type: 'audio/webm' });
      
      const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: audioFile,
        language: options?.language,
        prompt: options?.prompt,
        response_format: 'verbose_json',
      });

      // Process response
      const result = response as any;
      
      return {
        text: result.text,
        confidence: this.calculateConfidence(result),
        language: result.language || options?.language || 'en',
        duration: result.duration || 0,
        segments: result.segments?.map((seg: any) => ({
          text: seg.text,
          start: seg.start,
          end: seg.end,
          confidence: seg.confidence || 0.9,
        })),
      };
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded for Whisper API');
      }
      throw error;
    }
  }

  /**
   * Transcribe with browser Speech Recognition API
   */
  private async transcribeWithBrowserAPI(
    audioBuffer: Buffer,
    options?: {
      language?: string;
    }
  ): Promise<TranscriptionResult> {
    if (!this.recognitionAPI) {
      throw new Error('Browser speech recognition not available');
    }

    // Convert buffer to audio URL
    const audioArray = Uint8Array.from(audioBuffer);
    const audioBlob = new Blob([audioArray.buffer], { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Play audio through Web Audio API for recognition
    const audioContext = new (window as any).AudioContext();
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBufferDecoded = await audioContext.decodeAudioData(arrayBuffer);
    
    return new Promise((resolve, reject) => {
      const recognition = new this.recognitionAPI();
      
      recognition.lang = options?.language || 'en-US';
      recognition.maxAlternatives = 3;
      
      recognition.onresult = (event: any) => {
        const result = event.results[0];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.7;
        
        const alternatives = Array.from({ length: result.length }, (_, i) => ({
          text: result[i].transcript,
          confidence: result[i].confidence || 0.5,
        })).slice(1);

        resolve({
          text: transcript,
          confidence,
          language: recognition.lang,
          duration: audioBufferDecoded.duration,
          alternatives,
        });
      };

      recognition.onerror = (event: any) => {
        reject(new Error(`Speech recognition error: ${event.error}`));
      };

      // Start playback and recognition
      const source = audioContext.createBufferSource();
      source.buffer = audioBufferDecoded;
      source.connect(audioContext.destination);
      source.start(0);
      recognition.start();
      
      // Stop recognition when audio ends
      source.onended = () => {
        recognition.stop();
        URL.revokeObjectURL(audioUrl);
      };
    });
  }

  /**
   * Offline transcription fallback
   */
  private async transcribeOffline(
    audioBuffer: Buffer,
    options?: {
      language?: string;
    }
  ): Promise<TranscriptionResult> {
    // In a real implementation, this would use a local ML model
    // For now, return a placeholder response
    this.logger.warn('Using offline transcription mode - limited functionality');
    
    return {
      text: '[Offline mode - transcription unavailable]',
      confidence: 0.1,
      language: options?.language || 'en',
      duration: 0,
    };
  }

  /**
   * Determine which provider to use
   */
  private determineProvider(): STTProvider {
    if (this.openaiApiKey) {
      return STTProvider.OPENAI_WHISPER;
    }
    
    if (typeof window !== 'undefined' && this.isBrowserAPIAvailable()) {
      return STTProvider.BROWSER_API;
    }
    
    return STTProvider.OFFLINE;
  }

  /**
   * Initialize browser Speech Recognition API
   */
  private initializeBrowserAPI(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognitionAPI = SpeechRecognition;
    }
  }

  /**
   * Check if browser API is available
   */
  private isBrowserAPIAvailable(): boolean {
    return !!(window as any).SpeechRecognition || 
           !!(window as any).webkitSpeechRecognition;
  }

  /**
   * Prepare audio data for processing
   */
  private async prepareAudioData(
    audioData: Buffer | ArrayBuffer | Blob
  ): Promise<Buffer> {
    if (Buffer.isBuffer(audioData)) {
      return audioData;
    }
    
    if (audioData instanceof ArrayBuffer) {
      return Buffer.from(audioData);
    }
    
    if (audioData instanceof Blob) {
      const arrayBuffer = await audioData.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    
    throw new Error('Unsupported audio data format');
  }

  /**
   * Process audio stream for browser API
   */
  private async processAudioStream(
    stream: ReadableStream<Uint8Array>,
    recognition: any
  ): Promise<void> {
    const reader = stream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // In a real implementation, we'd feed audio chunks to the recognition
        // Browser API doesn't directly support streaming audio input
      }
    } finally {
      reader.releaseLock();
      recognition.stop();
    }
  }

  /**
   * Calculate confidence score from Whisper response
   */
  private calculateConfidence(response: any): number {
    // Whisper doesn't provide direct confidence scores
    // Estimate based on response characteristics
    let confidence = 0.9;
    
    if (response.segments && response.segments.length > 0) {
      const avgTokenProb = response.segments.reduce((sum: number, seg: any) => 
        sum + (seg.avg_logprob || 0), 0
      ) / response.segments.length;
      
      // Convert log probability to confidence (rough approximation)
      confidence = Math.min(0.95, Math.max(0.5, 1 + avgTokenProb / 10));
    }
    
    return confidence;
  }

  /**
   * Switch provider at runtime
   */
  switchProvider(provider: STTProvider): void {
    this.currentProvider = provider;
    this.logger.info(`Switched STT provider to: ${provider}`);
  }
}
