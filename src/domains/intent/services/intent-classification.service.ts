/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/domains/intent/services/intent-classification.service.ts
 * phase: 3
 * domain: intent
 * purpose: Service for classifying user intents from camera images using VLM
 * spec_ref: 007-mvp-intent-driven/contracts/intent-api.md
 * complexity_budget: 400
 * migrations_touched: ['041_intent_classifications.sql']
 * state_machine: null
 * estimated_llm_cost: {
 *   "classifyIntent": "$0.02-0.05 per image (VLM)",
 *   "improveWithFeedback": "$0.00 (local learning)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/domains/vision/services/vision-verification.service',
 *     './ai-interaction-logger.service',
 *     '../repositories/intent-classification.repository',
 *     '@/core/errors/error-types'
 *   ],
 *   external: ['openai'],
 *   supabase: ['intent_classifications table']
 * }
 * exports: ['IntentClassificationService', 'IntentClassificationResult']
 * voice_considerations: Combine visual intent with voice transcript for higher accuracy
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/domains/intent/services/intent-classification.test.ts',
 *   integration_tests: 'tests/integration/intent-classification-flow.test.ts'
 * }
 * tasks: [
 *   'Implement intent classification using existing VLM',
 *   'Add role-based intent filtering',
 *   'Implement offline fallback logic',
 *   'Add feedback loop for accuracy improvement'
 * ]
 */

import { VisionVerificationService } from '@/domains/vision/services/vision-verification.service';
import { AIInteractionLogger } from './ai-interaction-logger.service';
import { IntentClassificationRepository, IntentType, IntentContext } from '../repositories/intent-classification.repository';
import { createAppError, ErrorCategory, ErrorSeverity } from '@/core/errors/error-types';
import { OfflineDatabase } from '@/lib/offline/offline-db';

export interface IntentClassificationResult {
  id: string;
  intent: IntentType;
  confidence: number;
  suggestedAction?: string;
  detectedEntities?: string[];
  requiresConfirmation: boolean;
}

export interface ClassifyIntentOptions {
  imageBlob: Blob;
  userId: string;
  tenantId: string;
  context: IntentContext;
  voiceTranscript?: string;
}

export class IntentClassificationService {
  private visionService: VisionVerificationService;
  private aiLogger: AIInteractionLogger;
  private repository: IntentClassificationRepository;
  private offlineDb: OfflineDatabase;

  constructor() {
    this.visionService = new VisionVerificationService();
    this.aiLogger = new AIInteractionLogger();
    this.repository = new IntentClassificationRepository();
    this.offlineDb = OfflineDatabase.getInstance();
  }

  /**
   * Classify user intent from image
   */
  async classifyIntent(
    options: ClassifyIntentOptions
  ): Promise<IntentClassificationResult> {
    const startTime = Date.now();

    try {
      // Check if offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return this.handleOfflineClassification(options);
      }

      // Generate prompt based on user role and context
      const prompt = this.buildClassificationPrompt(options);
      
      // Create thumbnail (512x512)
      const thumbnailUrl = await this.createThumbnail(options.imageBlob);
      
      // Upload image to storage
      const imageUrl = await this.uploadImage(options.imageBlob, options.userId);

      // Call VLM for classification
      const vlmResponse = await this.callVLM(imageUrl, prompt);
      
      // Parse VLM response
      const classification = this.parseVLMResponse(vlmResponse, options.context);
      
      // Store classification result
      const stored = await this.repository.create({
        userId: options.userId,
        imageUrl,
        thumbnailUrl,
        intent: classification.intent,
        confidence: classification.confidence,
        context: options.context,
        voiceTranscript: options.voiceTranscript,
        detectedEntities: classification.detectedEntities,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          modelUsed: 'gpt-4-vision-preview'
        }
      }, options.tenantId);

      // Log AI interaction
      await this.aiLogger.logInteraction({
        userId: options.userId,
        tenantId: options.tenantId,
        interactionType: 'vlm',
        modelUsed: 'gpt-4-vision-preview',
        prompt,
        imageUrl,
        response: vlmResponse,
        responseTimeMs: Date.now() - startTime,
        costUsd: this.calculateVLMCost(prompt.length + JSON.stringify(vlmResponse).length)
      });

      return {
        id: stored.id,
        intent: classification.intent,
        confidence: classification.confidence,
        suggestedAction: this.getSuggestedAction(classification.intent, options.context),
        detectedEntities: classification.detectedEntities,
        requiresConfirmation: classification.confidence < 0.8
      };
    } catch (error) {
      // Log error
      await this.aiLogger.logInteraction({
        userId: options.userId,
        tenantId: options.tenantId,
        interactionType: 'vlm',
        modelUsed: 'gpt-4-vision-preview',
        prompt: 'Intent classification',
        response: {},
        responseTimeMs: Date.now() - startTime,
        costUsd: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw createAppError({
        code: 'INTENT_CLASSIFICATION_ERROR',
        message: 'Failed to classify intent',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error
      });
    }
  }

  /**
   * Build classification prompt based on context
   */
  private buildClassificationPrompt(options: ClassifyIntentOptions): string {
    const { context, voiceTranscript } = options;
    
    let prompt = `You are analyzing an image from a field service mobile app to determine the user's intent.

User Role: ${context.userRole}
Current Page: ${context.currentPage || 'unknown'}
Time: ${context.timeOfDay || new Date().toLocaleTimeString()}

Possible intents based on role:`;

    // Role-specific intents
    if (context.userRole === 'supervisor') {
      prompt += `
- inventory_add: Adding new equipment/materials to inventory
- inventory_check: Checking current inventory levels
- job_create: Creating a new job
- job_assign: Assigning a job to crew members
- job_status: Checking job status/progress
- receipt_scan: Scanning a purchase receipt`;
    } else if (context.userRole === 'crew') {
      prompt += `
- load_verify: Verifying equipment loaded for a job
- job_status: Checking job details
- maintenance_report: Reporting equipment issues
- receipt_scan: Scanning fuel/supply receipts`;
    }

    if (voiceTranscript) {
      prompt += `\n\nThe user also said: "${voiceTranscript}"`;
    }

    prompt += `\n\nAnalyze the image and return a JSON object with:
{
  "intent": "one of the intents listed above or 'unknown'",
  "confidence": 0.0-1.0,
  "detectedEntities": ["list of objects/text detected"],
  "reasoning": "brief explanation"
}`;

    return prompt;
  }

  /**
   * Handle offline classification
   */
  private async handleOfflineClassification(
    options: ClassifyIntentOptions
  ): Promise<IntentClassificationResult> {
    // Queue for later processing
    await this.offlineDb.queueOperation({
      operation: 'create',
      entity: 'intent_classification',
      data: {
        userId: options.userId,
        imageBlob: options.imageBlob,
        context: options.context,
        voiceTranscript: options.voiceTranscript
      },
      priority: 'high'
    });

    // Return a basic classification based on context
    const offlineIntent = this.guessOfflineIntent(options.context, options.voiceTranscript);
    
    return {
      id: `offline-${Date.now()}`,
      intent: offlineIntent,
      confidence: 0.5,
      suggestedAction: 'Classification will be processed when online',
      requiresConfirmation: true
    };
  }

  /**
   * Guess intent based on context when offline
   */
  private guessOfflineIntent(
    context: IntentContext,
    voiceTranscript?: string
  ): IntentType {
    // Simple heuristics based on context
    if (voiceTranscript) {
      const lower = voiceTranscript.toLowerCase();
      if (lower.includes('add') && lower.includes('inventory')) return 'inventory_add';
      if (lower.includes('create') && lower.includes('job')) return 'job_create';
      if (lower.includes('verify') || lower.includes('check')) return 'load_verify';
      if (lower.includes('broken') || lower.includes('issue')) return 'maintenance_report';
    }

    // Fallback based on role and page
    if (context.userRole === 'supervisor') {
      if (context.currentPage?.includes('inventory')) return 'inventory_add';
      if (context.currentPage?.includes('jobs')) return 'job_create';
    } else if (context.userRole === 'crew') {
      if (context.currentPage?.includes('verify')) return 'load_verify';
    }

    return 'unknown';
  }

  /**
   * Call VLM for classification
   */
  private async callVLM(imageUrl: string, prompt: string): Promise<any> {
    // Reuse existing VLM service from vision domain
    const response = await fetch('/api/vision/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        prompt,
        maxTokens: 500
      })
    });

    if (!response.ok) {
      throw createAppError({
        code: 'VLM_REQUEST_ERROR',
        message: 'VLM request failed',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.EXTERNAL_SERVICE,
        originalError: new Error(`HTTP ${response.status}`)
      });
    }

    return response.json();
  }

  /**
   * Parse VLM response into classification
   */
  private parseVLMResponse(
    response: any,
    context: IntentContext
  ): {
    intent: IntentType;
    confidence: number;
    detectedEntities?: string[];
  } {
    try {
      // Handle different response formats
      let parsed: any;
      
      if (typeof response === 'string') {
        // Extract JSON from text response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } else {
        parsed = response;
      }

      // Validate intent against role
      const validIntents = this.getValidIntentsForRole(context.userRole);
      const intent = parsed.intent as IntentType;
      
      if (!validIntents.includes(intent)) {
        return {
          intent: 'unknown',
          confidence: 0,
          detectedEntities: parsed.detectedEntities
        };
      }

      return {
        intent,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        detectedEntities: parsed.detectedEntities || []
      };
    } catch (error) {
      return {
        intent: 'unknown',
        confidence: 0
      };
    }
  }

  /**
   * Get valid intents for user role
   */
  private getValidIntentsForRole(role: string): IntentType[] {
    switch (role) {
      case 'supervisor':
        return [
          'inventory_add', 'inventory_check',
          'job_create', 'job_assign', 'job_status',
          'receipt_scan', 'unknown'
        ];
      case 'crew':
        return [
          'load_verify', 'job_status',
          'maintenance_report', 'receipt_scan',
          'unknown'
        ];
      case 'admin':
        // Admins can perform all intents
        return [
          'inventory_add', 'inventory_check',
          'job_create', 'job_assign', 'job_status',
          'load_verify', 'maintenance_report',
          'receipt_scan', 'unknown'
        ];
      default:
        return ['unknown'];
    }
  }

  /**
   * Get suggested action for intent
   */
  private getSuggestedAction(
    intent: IntentType,
    context: IntentContext
  ): string {
    const actions: Record<IntentType, string> = {
      inventory_add: 'Navigate to inventory add form',
      inventory_check: 'Show current inventory levels',
      job_create: 'Open job creation form',
      job_assign: 'Show available crew members',
      job_status: 'Display job details and status',
      load_verify: 'Open equipment verification checklist',
      maintenance_report: 'Open maintenance report form',
      receipt_scan: 'Process receipt for expense tracking',
      unknown: 'Unable to determine action'
    };

    return actions[intent] || 'No action available';
  }

  /**
   * Create thumbnail from blob
   */
  private async createThumbnail(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        canvas.width = 512;
        canvas.height = 512;
        
        // Calculate crop for square aspect ratio
        const size = Math.min(img.width, img.height);
        const x = (img.width - size) / 2;
        const y = (img.height - size) / 2;
        
        ctx!.drawImage(img, x, y, size, size, 0, 0, 512, 512);
        
        canvas.toBlob((thumbnailBlob) => {
          if (thumbnailBlob) {
            resolve(URL.createObjectURL(thumbnailBlob));
          } else {
            reject(new Error('Failed to create thumbnail'));
          }
        }, 'image/jpeg', 0.8);
      };
      
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * Upload image to storage
   */
  private async uploadImage(blob: Blob, userId: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', blob, `intent-${Date.now()}.jpg`);
    formData.append('userId', userId);
    
    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const { url } = await response.json();
    return url;
  }

  /**
   * Calculate VLM API cost
   */
  private calculateVLMCost(totalTokens: number): number {
    // Rough estimate: $0.01 per 1K tokens
    return (totalTokens / 1000) * 0.01;
  }

  /**
   * Process user feedback
   */
  async processFeedback(
    classificationId: string,
    tenantId: string,
    feedback: 'correct' | 'incorrect',
    correctedIntent?: IntentType
  ): Promise<void> {
    try {
      await this.repository.updateFeedback(
        classificationId,
        tenantId,
        {
          userFeedback: feedback,
          correctedIntent
        }
      );

      // Learn from feedback for future improvements
      if (feedback === 'incorrect' && correctedIntent) {
        // Store feedback patterns in offline cache when available
        await this.offlineDb.queueOperation({
          operation: 'create',
          entity: 'intent_feedback_patterns',
          entityId: classificationId,
          data: {
            classificationId,
            correctedIntent,
            timestamp: Date.now()
          },
        });
      }
    } catch (error) {
      throw createAppError({
        code: 'FEEDBACK_PROCESSING_ERROR',
        message: 'Failed to process feedback',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error
      });
    }
  }

  /**
   * Get classification accuracy metrics
   */
  async getAccuracyMetrics(
    tenantId: string,
    dateRange: { start: Date; end: Date }
  ) {
    return this.repository.getAccuracyMetrics(
      tenantId,
      dateRange.start,
      dateRange.end
    );
  }
}
