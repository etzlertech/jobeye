/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/domains/intent/repositories/intent-classification.repository.ts
 * phase: 3
 * domain: intent
 * purpose: Repository for intent classification results and feedback
 * spec_ref: 007-mvp-intent-driven/contracts/intent-api.md
 * complexity_budget: 300
 * migrations_touched: ['041_intent_classifications.sql']
 * state_machine: null
 * estimated_llm_cost: {
 *   "create": "$0.00 (local DB)",
 *   "updateFeedback": "$0.00 (local update)",
 *   "findByUser": "$0.00 (local query)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/core/errors/error-types', '@/lib/offline/offline-db'],
 *   external: ['@supabase/supabase-js'],
 *   supabase: ['intent_classifications table']
 * }
 * exports: ['IntentClassificationRepository', 'IntentClassification', 'IntentType', 'IntentContext']
 * voice_considerations: Store voice transcript alongside visual intent for better accuracy
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/intent/repositories/intent-classification.test.ts',
 *   integration_tests: 'tests/integration/intent-classification.test.ts'
 * }
 * tasks: [
 *   'Define intent classification types',
 *   'Implement classification storage with offline support',
 *   'Add feedback mechanism for improving accuracy',
 *   'Implement retrieval methods with filters'
 * ]
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { OfflineDatabase } from '@/lib/offline/offline-db';
import { AppError } from '@/core/errors/error-types';

// Intent types based on user actions
export type IntentType = 
  | 'inventory_add'
  | 'inventory_check'
  | 'job_create'
  | 'job_assign'
  | 'job_status'
  | 'load_verify'
  | 'maintenance_report'
  | 'receipt_scan'
  | 'unknown';

// Context for the intent
export interface IntentContext {
  userRole: 'supervisor' | 'crew' | 'admin';
  currentPage?: string;
  previousIntent?: IntentType;
  timeOfDay?: string;
  metadata?: Record<string, any>;
}

// Main intent classification model
export interface IntentClassification {
  id: string;
  tenantId: string;
  userId: string;
  createdAt: Date;
  imageUrl: string;
  thumbnailUrl: string;
  intent: IntentType;
  confidence: number;
  context: IntentContext;
  voiceTranscript?: string | null;
  detectedEntities?: string[] | null;
  userFeedback?: 'correct' | 'incorrect' | null;
  correctedIntent?: IntentType | null;
  processedAt?: Date | null;
  metadata?: Record<string, any> | null;
}

export interface CreateIntentClassificationDto {
  userId: string;
  imageUrl: string;
  thumbnailUrl: string;
  intent: IntentType;
  confidence: number;
  context: IntentContext;
  voiceTranscript?: string | null;
  detectedEntities?: string[] | null;
  metadata?: Record<string, any> | null;
}

export interface UpdateFeedbackDto {
  userFeedback: 'correct' | 'incorrect';
  correctedIntent?: IntentType;
}

export class IntentClassificationRepository {
  private offlineDb: OfflineDatabase;

  constructor() {
    this.offlineDb = new OfflineDatabase();
  }

  /**
   * Create a new intent classification record
   */
  async create(
    data: CreateIntentClassificationDto,
    tenantId: string
  ): Promise<IntentClassification> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { data: classification, error } = await supabase
        .from('intent_classifications')
        .insert({
          tenant_id: tenantId,
          user_id: data.userId,
          image_url: data.imageUrl,
          thumbnail_url: data.thumbnailUrl,
          intent: data.intent,
          confidence: data.confidence,
          context: data.context,
          voice_transcript: data.voiceTranscript,
          detected_entities: data.detectedEntities,
          metadata: data.metadata
        })
        .select()
        .single();

      if (error) {
        // Handle offline scenario
        if (navigator && !navigator.onLine) {
          await this.offlineDb.queueOperation({
            operation: 'create',
            entity: 'intent_classifications',
            data: { ...data, tenant_id: tenantId },
            priority: 'medium'
          });
          
          // Return temporary classification
          return {
            id: `temp-${Date.now()}`,
            tenantId,
            createdAt: new Date(),
            userId: data.userId,
            imageUrl: data.imageUrl,
            thumbnailUrl: data.thumbnailUrl,
            intent: data.intent,
            confidence: data.confidence,
            context: data.context,
            voiceTranscript: data.voiceTranscript,
            detectedEntities: data.detectedEntities,
            userFeedback: null,
            correctedIntent: null,
            processedAt: null,
            metadata: data.metadata
          };
        }
        
        throw new AppError('Failed to create intent classification', {
          code: 'INTENT_CREATE_ERROR',
          details: error
        });
      }

      return this.mapToModel(classification);
    } catch (error) {
      throw new AppError('Failed to create intent classification', {
        code: 'INTENT_CREATE_ERROR',
        details: error
      });
    }
  }

  /**
   * Update user feedback for a classification
   */
  async updateFeedback(
    id: string,
    tenantId: string,
    feedback: UpdateFeedbackDto
  ): Promise<IntentClassification> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { data: classification, error } = await supabase
        .from('intent_classifications')
        .update({
          user_feedback: feedback.userFeedback,
          corrected_intent: feedback.correctedIntent
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        // Queue for offline sync
        if (navigator && !navigator.onLine) {
          await this.offlineDb.queueOperation({
            operation: 'update',
            entity: 'intent_classifications',
            entityId: id,
            data: feedback,
            priority: 'low'
          });
          
          throw new AppError('Feedback queued for sync', {
            code: 'OFFLINE_FEEDBACK_QUEUED'
          });
        }
        
        throw new AppError('Failed to update feedback', {
          code: 'INTENT_FEEDBACK_ERROR',
          details: error
        });
      }

      return this.mapToModel(classification);
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      throw new AppError('Failed to update feedback', {
        code: 'INTENT_FEEDBACK_ERROR',
        details: error
      });
    }
  }

  /**
   * Find classifications by user with optional filters
   */
  async findByUser(
    tenantId: string,
    userId: string,
    filters?: {
      intent?: IntentType;
      startDate?: Date;
      endDate?: Date;
      hasUserFeedback?: boolean;
      limit?: number;
    }
  ): Promise<IntentClassification[]> {
    try {
      const supabase = await createServerSupabaseClient();
      
      let query = supabase
        .from('intent_classifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.intent) {
        query = query.eq('intent', filters.intent);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }
      if (filters?.hasUserFeedback !== undefined) {
        if (filters.hasUserFeedback) {
          query = query.not('user_feedback', 'is', null);
        } else {
          query = query.is('user_feedback', null);
        }
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data: classifications, error } = await query;

      if (error) {
        throw new AppError('Failed to fetch classifications', {
          code: 'INTENT_FETCH_ERROR',
          details: error
        });
      }

      return classifications.map(this.mapToModel);
    } catch (error) {
      throw new AppError('Failed to fetch classifications', {
        code: 'INTENT_FETCH_ERROR',
        details: error
      });
    }
  }

  /**
   * Find recent classifications for a specific intent type
   */
  async findRecentByIntent(
    tenantId: string,
    intent: IntentType,
    limit: number = 10
  ): Promise<IntentClassification[]> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { data: classifications, error } = await supabase
        .from('intent_classifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('intent', intent)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new AppError('Failed to fetch recent intents', {
          code: 'INTENT_FETCH_ERROR',
          details: error
        });
      }

      return classifications.map(this.mapToModel);
    } catch (error) {
      throw new AppError('Failed to fetch recent intents', {
        code: 'INTENT_FETCH_ERROR',
        details: error
      });
    }
  }

  /**
   * Get accuracy metrics for intents
   */
  async getAccuracyMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalClassifications: number;
    feedbackCount: number;
    correctCount: number;
    incorrectCount: number;
    accuracyRate: number;
    intentBreakdown: Record<IntentType, {
      total: number;
      correct: number;
      incorrect: number;
      accuracy: number;
    }>;
  }> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { data: classifications, error } = await supabase
        .from('intent_classifications')
        .select('intent, user_feedback')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        throw new AppError('Failed to fetch accuracy metrics', {
          code: 'INTENT_METRICS_ERROR',
          details: error
        });
      }

      const metrics = {
        totalClassifications: classifications.length,
        feedbackCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        accuracyRate: 0,
        intentBreakdown: {} as Record<IntentType, any>
      };

      // Calculate metrics
      classifications.forEach(c => {
        // Initialize intent breakdown
        if (!metrics.intentBreakdown[c.intent as IntentType]) {
          metrics.intentBreakdown[c.intent as IntentType] = {
            total: 0,
            correct: 0,
            incorrect: 0,
            accuracy: 0
          };
        }

        metrics.intentBreakdown[c.intent as IntentType].total++;

        if (c.user_feedback) {
          metrics.feedbackCount++;
          if (c.user_feedback === 'correct') {
            metrics.correctCount++;
            metrics.intentBreakdown[c.intent as IntentType].correct++;
          } else {
            metrics.incorrectCount++;
            metrics.intentBreakdown[c.intent as IntentType].incorrect++;
          }
        }
      });

      // Calculate accuracy rates
      if (metrics.feedbackCount > 0) {
        metrics.accuracyRate = metrics.correctCount / metrics.feedbackCount;
      }

      // Calculate per-intent accuracy
      Object.keys(metrics.intentBreakdown).forEach(intent => {
        const breakdown = metrics.intentBreakdown[intent as IntentType];
        const feedbackTotal = breakdown.correct + breakdown.incorrect;
        if (feedbackTotal > 0) {
          breakdown.accuracy = breakdown.correct / feedbackTotal;
        }
      });

      return metrics;
    } catch (error) {
      throw new AppError('Failed to calculate accuracy metrics', {
        code: 'INTENT_METRICS_ERROR',
        details: error
      });
    }
  }

  /**
   * Mark classification as processed
   */
  async markAsProcessed(
    id: string,
    tenantId: string
  ): Promise<IntentClassification> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { data: classification, error } = await supabase
        .from('intent_classifications')
        .update({
          processed_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        throw new AppError('Failed to mark as processed', {
          code: 'INTENT_UPDATE_ERROR',
          details: error
        });
      }

      return this.mapToModel(classification);
    } catch (error) {
      throw new AppError('Failed to mark as processed', {
        code: 'INTENT_UPDATE_ERROR',
        details: error
      });
    }
  }

  /**
   * Map database row to model
   */
  private mapToModel(row: any): IntentClassification {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      imageUrl: row.image_url,
      thumbnailUrl: row.thumbnail_url,
      intent: row.intent as IntentType,
      confidence: row.confidence,
      context: row.context as IntentContext,
      voiceTranscript: row.voice_transcript,
      detectedEntities: row.detected_entities,
      userFeedback: row.user_feedback,
      correctedIntent: row.corrected_intent,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      metadata: row.metadata
    };
  }
}