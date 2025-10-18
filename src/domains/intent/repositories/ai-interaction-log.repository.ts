/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/domains/intent/repositories/ai-interaction-log.repository.ts
 * phase: 3
 * domain: intent
 * purpose: Repository for AI interaction logging and retrieval
 * spec_ref: 007-mvp-intent-driven/contracts/logs-api.md
 * complexity_budget: 300
 * migrations_touched: ['040_ai_interaction_logs.sql']
 * state_machine: null
 * estimated_llm_cost: {
 *   "create": "$0.00 (local DB)",
 *   "findByDateRange": "$0.00 (local query)",
 *   "calculateCosts": "$0.00 (aggregation)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/core/errors/error-types', '@/core/config/environment', '@/lib/offline/offline-db'],
 *   external: ['@supabase/supabase-js'],
 *   supabase: ['ai_interaction_logs table']
 * }
 * exports: ['AIInteractionLogRepository', 'AIInteractionLog', 'InteractionType']
 * voice_considerations: All AI/LLM interactions must be logged for cost tracking
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/intent/repositories/ai-interaction-log.test.ts',
 *   integration_tests: 'tests/integration/ai-logging.test.ts'
 * }
 * tasks: [
 *   'Define types for AI interaction logs',
 *   'Implement CRUD operations with offline support',
 *   'Add cost aggregation methods',
 *   'Implement tenant isolation'
 * ]
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { OfflineDatabase } from '@/lib/offline/offline-db';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { Database } from '@/types/database';

// Types
export type InteractionType = 'intent' | 'stt' | 'tts' | 'llm' | 'vlm';

export interface AIInteractionLog {
  id: string;
  tenantId: string;
  createdAt: Date;
  userId: string;
  interactionType: InteractionType;
  modelUsed: string;
  prompt: string;
  imageUrl?: string | null;
  response: any; // JSONB
  responseTimeMs: number;
  costUsd: number;
  error?: string | null;
  metadata?: Record<string, any> | null;
}

export interface CreateAIInteractionLogDto {
  userId: string;
  interactionType: InteractionType;
  modelUsed: string;
  prompt: string;
  imageUrl?: string | null;
  response: any;
  responseTimeMs: number;
  costUsd: number;
  error?: string | null;
  metadata?: Record<string, any> | null;
}

export interface AIInteractionCostSummary {
  totalCost: number;
  costByType: Record<InteractionType, number>;
  costByModel: Record<string, number>;
  interactionCount: number;
  averageCostPerInteraction: number;
  periodStart: Date;
  periodEnd: Date;
}

export class AIInteractionLogRepository {
  private offlineDb: OfflineDatabase;

  constructor() {
    this.offlineDb = OfflineDatabase.getInstance();
  }

  /**
   * Create a new AI interaction log entry
   */
  async create(
    data: CreateAIInteractionLogDto,
    tenantId: string
  ): Promise<AIInteractionLog> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const table = (supabase as any).from('ai_interaction_logs');

      const { data: log, error } = await table
        .insert({
          tenant_id: tenantId,
          user_id: data.userId,
          interaction_type: data.interactionType,
          model_used: data.modelUsed,
          prompt: data.prompt,
          image_url: data.imageUrl,
          response: data.response,
          response_time_ms: data.responseTimeMs,
          cost_usd: data.costUsd.toString(), // Store as string for decimal precision
          error: data.error,
          metadata: data.metadata
        })
        .select()
        .single();

      if (error) {
        // If offline or error, queue for later
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          await this.offlineDb.queueOperation({
            operation: 'create',
            entity: 'ai_interaction_logs',
            data: { ...data, tenant_id: tenantId },
            priority: 'low' // Log entries are low priority
          });
          
          // Return a temporary log entry
          return {
            id: `temp-${Date.now()}`,
            tenantId,
            createdAt: new Date(),
            userId: data.userId,
            interactionType: data.interactionType,
            modelUsed: data.modelUsed,
            prompt: data.prompt,
            imageUrl: data.imageUrl,
            response: data.response,
            responseTimeMs: data.responseTimeMs,
            costUsd: data.costUsd,
            error: data.error,
            metadata: data.metadata
          };
        }
        
        throw createAppError({
          code: 'AI_LOG_CREATE_ERROR',
          message: 'Failed to create AI interaction log',
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.DATABASE,
          originalError: error as Error,
        });
      }

      return this.mapToModel(log);
    } catch (error) {
      throw createAppError({
        code: 'AI_LOG_CREATE_ERROR',
        message: 'Failed to create AI interaction log',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find logs by date range with optional filters
   */
  async findByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    filters?: {
      userId?: string;
      interactionType?: InteractionType;
      modelUsed?: string;
      hasError?: boolean;
    }
  ): Promise<AIInteractionLog[]> {
    try {
      const supabase = await createServerSupabaseClient();
      
      let query = (supabase as any)
        .from('ai_interaction_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      // Apply optional filters
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.interactionType) {
        query = query.eq('interaction_type', filters.interactionType);
      }
      if (filters?.modelUsed) {
        query = query.eq('model_used', filters.modelUsed);
      }
      if (filters?.hasError !== undefined) {
        if (filters.hasError) {
          query = query.not('error', 'is', null);
        } else {
          query = query.is('error', null);
        }
      }

      const { data: logs, error } = await query;

      if (error) {
        throw createAppError({
          code: 'AI_LOG_FETCH_ERROR',
          message: 'Failed to fetch AI interaction logs',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.DATABASE,
          originalError: error as Error,
        });
      }

      return (logs ?? []).map((log: any) => this.mapToModel(log));
    } catch (error) {
      throw createAppError({
        code: 'AI_LOG_FETCH_ERROR',
        message: 'Failed to fetch AI interaction logs',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Calculate cost summary for a date range
   */
  async calculateCostSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    filters?: {
      userId?: string;
      interactionType?: InteractionType;
    }
  ): Promise<AIInteractionCostSummary> {
    try {
      const logs = await this.findByDateRange(tenantId, startDate, endDate, filters);
      
      const summary: AIInteractionCostSummary = {
        totalCost: 0,
        costByType: {} as Record<InteractionType, number>,
        costByModel: {},
        interactionCount: logs.length,
        averageCostPerInteraction: 0,
        periodStart: startDate,
        periodEnd: endDate
      };

      // Calculate aggregations
      logs.forEach(log => {
        summary.totalCost += log.costUsd;
        
        // Cost by type
        if (!summary.costByType[log.interactionType]) {
          summary.costByType[log.interactionType] = 0;
        }
        summary.costByType[log.interactionType] += log.costUsd;
        
        // Cost by model
        if (!summary.costByModel[log.modelUsed]) {
          summary.costByModel[log.modelUsed] = 0;
        }
        summary.costByModel[log.modelUsed] += log.costUsd;
      });

      summary.averageCostPerInteraction = 
        summary.interactionCount > 0 ? summary.totalCost / summary.interactionCount : 0;

      return summary;
    } catch (error) {
      throw createAppError({
        code: 'AI_COST_CALCULATION_ERROR',
        message: 'Failed to calculate cost summary',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error
      });
    }
  }

  /**
   * Get recent logs for a user
   */
  async findRecentByUser(
    tenantId: string,
    userId: string,
    limit: number = 10
  ): Promise<AIInteractionLog[]> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { data: logs, error } = await (supabase as any)
        .from('ai_interaction_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw createAppError({
          code: 'AI_LOG_FETCH_ERROR',
          message: 'Failed to fetch recent logs',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.DATABASE,
          originalError: error as Error,
        });
      }

      return (logs ?? []).map((log: any) => this.mapToModel(log));
    } catch (error) {
      throw createAppError({
        code: 'AI_LOG_FETCH_ERROR',
        message: 'Failed to fetch recent logs',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Check if daily budget is exceeded
   */
  async isDailyBudgetExceeded(
    tenantId: string,
    budgetLimit: number
  ): Promise<{ exceeded: boolean; currentSpend: number }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const summary = await this.calculateCostSummary(
        tenantId,
        today,
        tomorrow
      );
      
      return {
        exceeded: summary.totalCost >= budgetLimit,
        currentSpend: summary.totalCost
      };
    } catch (error) {
      throw createAppError({
        code: 'AI_BUDGET_CHECK_ERROR',
        message: 'Failed to check budget',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Map database row to model
   */
  private mapToModel(row: any): AIInteractionLog {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      createdAt: new Date(row.created_at),
      userId: row.user_id,
      interactionType: row.interaction_type as InteractionType,
      modelUsed: row.model_used,
      prompt: row.prompt,
      imageUrl: row.image_url,
      response: row.response,
      responseTimeMs: row.response_time_ms,
      costUsd: parseFloat(row.cost_usd),
      error: row.error,
      metadata: row.metadata
    };
  }
}
