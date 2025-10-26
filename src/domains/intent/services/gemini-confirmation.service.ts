/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/domains/intent/services/gemini-confirmation.service.ts
 * phase: 3
 * domain: intent
 * purpose: Process yes/no confirmations for voice commands using Gemini
 * spec_ref: voice-to-crud-plan.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "processConfirmation": "$0.00010 per request (Gemini Flash)"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: [
 *     '../types/voice-intent-types',
 *     '../prompts/intent-prompts',
 *     './ai-interaction-logger.service',
 *     '@/core/errors/error-types'
 *   ],
 *   external: ['@google/generative-ai']
 * }
 * exports: ['GeminiConfirmationService']
 * voice_considerations: |
 *   Lightweight service for binary yes/no responses.
 *   Can use cached responses for common phrases to save costs.
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/domains/intent/services/gemini-confirmation.test.ts'
 * }
 * tasks: [
 *   'Implement confirmation processing with Gemini',
 *   'Add response caching for common phrases',
 *   'Handle unclear responses with re-prompting',
 *   'Add cost tracking'
 * ]
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  VoiceConfirmationResult,
  ProcessConfirmationRequest,
} from '../types/voice-intent-types';
import { buildConfirmationPrompt } from '../prompts/intent-prompts';
import { AIInteractionLogger } from './ai-interaction-logger.service';
import { createAppError, ErrorCategory, ErrorSeverity } from '@/core/errors/error-types';

/**
 * Service for processing yes/no confirmations
 */
export class GeminiConfirmationService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private aiLogger: AIInteractionLogger;
  private confirmationCache: Map<string, VoiceConfirmationResult>; // Cache common responses

  // Gemini configuration
  private readonly MODEL_NAME = 'gemini-2.0-flash-exp';
  private readonly TIMEOUT_MS = 3000; // Faster timeout for simple yes/no
  private readonly COST_PER_1K_TOKENS = 0.00001;

  // Common yes/no phrases (for caching)
  private readonly COMMON_YES = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'correct', 'right', 'do it', 'go ahead'];
  private readonly COMMON_NO = ['no', 'nope', 'nah', 'cancel', 'stop', 'don\'t', 'negative', 'abort'];

  constructor() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });
    this.aiLogger = new AIInteractionLogger();
    this.confirmationCache = new Map();

    // Pre-populate cache with common responses
    this.initializeCache();
  }

  /**
   * Process confirmation response
   */
  async processConfirmation(
    request: ProcessConfirmationRequest
  ): Promise<VoiceConfirmationResult> {
    const startTime = Date.now();

    try {
      // Normalize transcript
      const normalizedTranscript = request.transcript.trim().toLowerCase();

      // Check cache first
      const cachedResult = this.confirmationCache.get(normalizedTranscript);
      if (cachedResult) {
        return {
          ...cachedResult,
          original_transcript: request.transcript,
        };
      }

      // Build prompt
      const prompt = buildConfirmationPrompt(
        request.transcript,
        request.confirmation_question,
        request.previous_intent.intent
      );

      // Call Gemini API
      const geminiResponse = await this.callGeminiAPI(prompt);

      // Parse response
      const parsedResult = this.parseConfirmationResponse(geminiResponse);

      // Calculate cost
      const processingTimeMs = Date.now() - startTime;
      const estimatedTokens = this.estimateTokens(prompt, geminiResponse);
      const costUsd = (estimatedTokens / 1000) * this.COST_PER_1K_TOKENS;

      // Log AI interaction
      if (request.conversation_context) {
        await this.aiLogger.logInteraction({
          userId: request.conversation_context.user_id,
          tenantId: request.conversation_context.tenant_id,
          interactionType: 'llm',
          modelUsed: this.MODEL_NAME,
          prompt,
          response: geminiResponse,
          responseTimeMs: processingTimeMs,
          costUsd,
        });
      }

      // Cache result if confidence is high and response is clear
      if (parsedResult.confidence > 0.9 && parsedResult.interpretation !== 'unclear') {
        this.confirmationCache.set(normalizedTranscript, parsedResult);
      }

      return {
        ...parsedResult,
        original_transcript: request.transcript,
      };
    } catch (error) {
      throw createAppError({
        code: 'GEMINI_CONFIRMATION_ERROR',
        message: `Failed to process confirmation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VOICE,
        context: { transcript: request.transcript },
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Call Gemini API with timeout
   */
  private async callGeminiAPI(prompt: string): Promise<string> {
    try {
      const result = await Promise.race([
        this.model.generateContent(prompt),
        this.timeoutPromise(this.TIMEOUT_MS),
      ]);

      if (typeof result === 'string') {
        throw new Error(result); // Timeout error
      }

      const response = result.response.text();

      // Clean response
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      return cleanedResponse;
    } catch (error) {
      throw new Error(`Gemini API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse Gemini confirmation response
   */
  private parseConfirmationResponse(response: string): VoiceConfirmationResult {
    try {
      const parsed = JSON.parse(response);

      return {
        confirmed: parsed.confirmed || false,
        confidence: parsed.confidence || 0.0,
        interpretation: parsed.interpretation || 'unclear',
        original_transcript: '', // Will be set by caller
      };
    } catch (error) {
      // Fallback if parsing fails
      return {
        confirmed: false,
        confidence: 0.0,
        interpretation: 'unclear',
        original_transcript: '',
      };
    }
  }

  /**
   * Initialize cache with common yes/no responses
   */
  private initializeCache(): void {
    // Cache common "yes" responses
    this.COMMON_YES.forEach(phrase => {
      this.confirmationCache.set(phrase, {
        confirmed: true,
        confidence: 1.0,
        interpretation: 'yes',
        original_transcript: phrase,
      });
    });

    // Cache common "no" responses
    this.COMMON_NO.forEach(phrase => {
      this.confirmationCache.set(phrase, {
        confirmed: false,
        confidence: 1.0,
        interpretation: 'no',
        original_transcript: phrase,
      });
    });
  }

  /**
   * Estimate token count
   */
  private estimateTokens(prompt: string, response: string): number {
    return Math.ceil((prompt.length + response.length) / 4);
  }

  /**
   * Create timeout promise
   */
  private timeoutPromise(ms: number): Promise<string> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini API timeout after ${ms}ms`)), ms)
    );
  }

  /**
   * Check if transcript is a likely "yes" response (heuristic fallback)
   */
  isLikelyYes(transcript: string): boolean {
    const normalized = transcript.trim().toLowerCase();
    return this.COMMON_YES.some(phrase => normalized.includes(phrase));
  }

  /**
   * Check if transcript is a likely "no" response (heuristic fallback)
   */
  isLikelyNo(transcript: string): boolean {
    const normalized = transcript.trim().toLowerCase();
    return this.COMMON_NO.some(phrase => normalized.includes(phrase));
  }

  /**
   * Clear confirmation cache (for testing)
   */
  clearCache(): void {
    this.confirmationCache.clear();
    this.initializeCache();
  }
}
