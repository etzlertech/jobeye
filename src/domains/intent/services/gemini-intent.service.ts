/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/domains/intent/services/gemini-intent.service.ts
 * phase: 3
 * domain: intent
 * purpose: Text-based intent classification using Google Gemini for voice-to-CRUD operations
 * spec_ref: voice-to-crud-plan.md
 * complexity_budget: 400
 * migrations_touched: []
 * state_machine: {
 *   states: ['initial', 'classifying', 'needs_clarification', 'complete'],
 *   transitions: [
 *     'initial->classifying: classifyIntent()',
 *     'classifying->needs_clarification: confidence < 0.8 || missing entities',
 *     'classifying->complete: confidence >= 0.8 && all entities present',
 *     'needs_clarification->classifying: clarifyIntent()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "classifyIntent": "$0.00015 per request (Gemini Flash)",
 *   "clarifyIntent": "$0.0002 per request (includes context)"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: [
 *     '../types/voice-intent-types',
 *     '../prompts/intent-prompts',
 *     '../repositories/intent-classification.repository',
 *     './ai-interaction-logger.service',
 *     '@/core/errors/error-types'
 *   ],
 *   external: ['@google/generative-ai']
 * }
 * exports: ['GeminiIntentService']
 * voice_considerations: |
 *   Minimize token usage by keeping prompts concise.
 *   Track conversation context for multi-turn clarifications.
 *   Prefer browser STT over Whisper when available (cost saving).
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/domains/intent/services/gemini-intent.test.ts',
 *   integration_tests: 'tests/integration/voice-to-crud-flow.test.ts'
 * }
 * tasks: [
 *   'Implement intent classification with Gemini Flash',
 *   'Add conversation context tracking',
 *   'Implement clarification loop handling',
 *   'Add entity extraction validation',
 *   'Add cost tracking per request'
 * ]
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  VoiceIntentType,
  VoiceIntentResult,
  VoiceIntentEntities,
  ConversationContext,
  ClassifyVoiceIntentRequest,
} from '../types/voice-intent-types';
import {
  buildIntentClassificationPrompt,
  buildClarificationPrompt,
  getRequiredEntities,
} from '../prompts/intent-prompts';
import { IntentContext } from '../repositories/intent-classification.repository';
import { AIInteractionLogger } from './ai-interaction-logger.service';
import { createAppError, ErrorCategory, ErrorSeverity } from '@/core/errors/error-types';

/**
 * Service for classifying voice transcripts into intents using Gemini
 */
export class GeminiIntentService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private aiLogger: AIInteractionLogger;
  private conversationContexts: Map<string, ConversationContext>; // In-memory session store

  // Gemini configuration
  private readonly MODEL_NAME = 'gemini-2.0-flash-exp'; // Fast & cheap
  private readonly TIMEOUT_MS = 5000;
  private readonly MAX_RETRIES = 2;
  private readonly COST_PER_1K_TOKENS = 0.00001; // Gemini Flash pricing

  constructor() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.MODEL_NAME });
    this.aiLogger = new AIInteractionLogger();
    this.conversationContexts = new Map();
  }

  /**
   * Classify voice transcript into intent with entity extraction
   */
  async classifyIntent(
    request: ClassifyVoiceIntentRequest
  ): Promise<VoiceIntentResult> {
    const startTime = Date.now();

    try {
      // Get or create conversation context
      const conversationContext = this.getOrCreateConversationContext(
        request.conversation_context,
        request.context
      );

      // Build prompt
      const prompt = buildIntentClassificationPrompt(
        request.transcript,
        request.context,
        conversationContext
      );

      // Call Gemini API
      const geminiResponse = await this.callGeminiAPI(prompt);

      // Parse response
      const parsedResult = this.parseGeminiResponse(geminiResponse, request.transcript);

      // Capture turn number BEFORE updating context
      const currentTurnNumber = conversationContext.turn_number;

      // Update conversation context
      this.updateConversationContext(
        conversationContext,
        request.transcript,
        parsedResult.intent,
        parsedResult.entities
      );

      // Calculate cost
      const processingTimeMs = Date.now() - startTime;
      const estimatedTokens = this.estimateTokens(prompt, geminiResponse);
      const costUsd = (estimatedTokens / 1000) * this.COST_PER_1K_TOKENS;

      // Build result
      const result: VoiceIntentResult = {
        intent: parsedResult.intent,
        entities: parsedResult.entities,
        confidence: parsedResult.confidence,
        needs_clarification: parsedResult.needs_clarification,
        follow_up: parsedResult.follow_up,
        missing_entities: parsedResult.missing_entities,
        conversation_id: conversationContext.conversation_id,
        turn_number: currentTurnNumber,
        model_used: this.MODEL_NAME,
        processing_time_ms: processingTimeMs,
        cost_usd: costUsd,
      };

      // Log AI interaction
      await this.aiLogger.logInteraction({
        userId: conversationContext.user_id,
        tenantId: conversationContext.tenant_id,
        interactionType: 'llm',
        modelUsed: this.MODEL_NAME,
        prompt,
        response: geminiResponse,
        responseTimeMs: processingTimeMs,
        costUsd,
      });

      return result;
    } catch (error) {
      throw createAppError({
        code: 'GEMINI_INTENT_CLASSIFICATION_ERROR',
        message: `Failed to classify intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.VOICE,
        context: { transcript: request.transcript },
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Handle clarification by extracting additional entities
   */
  async clarifyIntent(
    conversationId: string,
    transcript: string
  ): Promise<VoiceIntentResult> {
    const startTime = Date.now();

    try {
      // Get existing conversation context
      const conversationContext = this.conversationContexts.get(conversationId);
      if (!conversationContext) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      // Increment clarification count
      conversationContext.clarification_count++;

      // Check if exceeded max clarifications
      if (conversationContext.clarification_count > conversationContext.max_clarifications) {
        return {
          intent: 'unknown',
          entities: conversationContext.accumulated_entities,
          confidence: 0.0,
          needs_clarification: false,
          follow_up: 'I\'m having trouble understanding. Let\'s start over or try a different command.',
          conversation_id: conversationId,
          turn_number: conversationContext.turn_number + 1,
          model_used: this.MODEL_NAME,
          processing_time_ms: Date.now() - startTime,
          cost_usd: 0,
        };
      }

      // Build clarification prompt
      const prompt = buildClarificationPrompt(transcript, conversationContext);

      // Call Gemini API
      const geminiResponse = await this.callGeminiAPI(prompt);

      // Parse response (entities only)
      const parsedResult = JSON.parse(geminiResponse);

      // Merge entities
      const mergedEntities = {
        ...conversationContext.accumulated_entities,
        ...parsedResult.entities,
      };

      // Capture turn number BEFORE updating context
      const currentTurnNumber = conversationContext.turn_number;

      // Update conversation context
      conversationContext.turn_number++;
      conversationContext.previous_transcripts.push(transcript);
      conversationContext.accumulated_entities = mergedEntities;
      conversationContext.updated_at = new Date();

      // Check if we have all required entities now
      const currentIntent = conversationContext.current_intent!;
      const requiredEntities = getRequiredEntities(currentIntent);
      const missingEntities = requiredEntities.filter(
        entity => !mergedEntities[entity as keyof VoiceIntentEntities]
      );

      const needsClarification = missingEntities.length > 0 || parsedResult.needs_clarification;

      // Calculate cost
      const processingTimeMs = Date.now() - startTime;
      const estimatedTokens = this.estimateTokens(prompt, geminiResponse);
      const costUsd = (estimatedTokens / 1000) * this.COST_PER_1K_TOKENS;

      return {
        intent: currentIntent,
        entities: mergedEntities,
        confidence: needsClarification ? 0.7 : 0.9,
        needs_clarification: needsClarification,
        follow_up: parsedResult.follow_up,
        missing_entities: missingEntities,
        conversation_id: conversationId,
        turn_number: currentTurnNumber,
        model_used: this.MODEL_NAME,
        processing_time_ms: processingTimeMs,
        cost_usd: costUsd,
      };
    } catch (error) {
      throw createAppError({
        code: 'GEMINI_CLARIFICATION_ERROR',
        message: `Failed to process clarification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.VOICE,
        context: { conversationId, transcript },
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Call Gemini API with retry logic
   */
  private async callGeminiAPI(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const result = await Promise.race([
          this.model.generateContent(prompt),
          this.timeoutPromise(this.TIMEOUT_MS),
        ]);

        if (typeof result === 'string') {
          throw new Error(result); // Timeout error
        }

        const response = result.response.text();

        // Clean response (remove markdown code blocks if present)
        let cleanedResponse = response.trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        return cleanedResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on timeout or JSON parse errors
        if (lastError.message.includes('timeout') || lastError.message.includes('JSON')) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Failed to call Gemini API');
  }

  /**
   * Parse Gemini response into structured result
   */
  private parseGeminiResponse(
    response: string,
    transcript: string
  ): {
    intent: VoiceIntentType;
    entities: VoiceIntentEntities;
    confidence: number;
    needs_clarification: boolean;
    follow_up?: string;
    missing_entities?: string[];
  } {
    try {
      const parsed = JSON.parse(response);

      // Validate required fields
      if (!parsed.intent || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid response structure');
      }

      return {
        intent: parsed.intent as VoiceIntentType,
        entities: parsed.entities || {},
        confidence: parsed.confidence,
        needs_clarification: parsed.needs_clarification || false,
        follow_up: parsed.follow_up,
        missing_entities: parsed.missing_entities || [],
      };
    } catch (error) {
      // Fallback to unknown intent if parsing fails
      return {
        intent: 'unknown',
        entities: {},
        confidence: 0.0,
        needs_clarification: true,
        follow_up: `I couldn't understand "${transcript}". Could you rephrase that?`,
        missing_entities: [],
      };
    }
  }

  /**
   * Get or create conversation context
   */
  private getOrCreateConversationContext(
    existingContext: ConversationContext | undefined,
    intentContext: IntentContext
  ): ConversationContext {
    if (existingContext) {
      return existingContext;
    }

    // Create new conversation context
    const conversationId = this.generateConversationId();
    const context: ConversationContext = {
      conversation_id: conversationId,
      user_id: '', // Will be set by caller
      tenant_id: '', // Will be set by caller
      created_at: new Date(),
      updated_at: new Date(),
      turn_number: 1,
      accumulated_entities: {},
      previous_transcripts: [],
      previous_intents: [],
      user_context: intentContext,
      clarification_count: 0,
      max_clarifications: 3,
    };

    this.conversationContexts.set(conversationId, context);
    return context;
  }

  /**
   * Update conversation context after classification
   */
  private updateConversationContext(
    context: ConversationContext,
    transcript: string,
    intent: VoiceIntentType,
    entities: VoiceIntentEntities
  ): void {
    context.turn_number++;
    context.previous_transcripts.push(transcript);
    context.previous_intents.push(intent);
    context.current_intent = intent;
    context.accumulated_entities = {
      ...context.accumulated_entities,
      ...entities,
    };
    context.updated_at = new Date();
  }

  /**
   * Generate unique conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(prompt: string, response: string): number {
    // Rough estimate: 1 token ≈ 4 characters
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
   * Clear conversation context (for cleanup)
   */
  clearConversation(conversationId: string): void {
    this.conversationContexts.delete(conversationId);
  }

  /**
   * Get conversation context (for debugging/testing)
   */
  getConversationContext(conversationId: string): ConversationContext | undefined {
    return this.conversationContexts.get(conversationId);
  }
}
