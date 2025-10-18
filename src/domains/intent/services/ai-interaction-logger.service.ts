/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/domains/intent/services/ai-interaction-logger.service.ts
 * phase: 3
 * domain: intent
 * purpose: Service for logging all AI/LLM interactions for cost tracking and auditing
 * spec_ref: 007-mvp-intent-driven/contracts/logs-api.md
 * complexity_budget: 250
 * migrations_touched: ['040_ai_interaction_logs.sql']
 * state_machine: null
 * estimated_llm_cost: {
 *   "logInteraction": "$0.00 (DB write only)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '../repositories/ai-interaction-log.repository',
 *     '@/core/errors/error-types',
 *     '@/lib/offline/offline-db'
 *   ],
 *   external: [],
 *   supabase: ['ai_interaction_logs table']
 * }
 * exports: ['AIInteractionLogger', 'LogInteractionOptions']
 * voice_considerations: All voice interactions (STT/TTS) must be logged with costs
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/domains/intent/services/ai-interaction-logger.test.ts'
 * }
 * tasks: [
 *   'Implement centralized AI interaction logging',
 *   'Add cost tracking and budget enforcement',
 *   'Create aggregation methods for reporting',
 *   'Implement offline queueing'
 * ]
 */

import { 
  AIInteractionLogRepository, 
  InteractionType,
  CreateAIInteractionLogDto 
} from '../repositories/ai-interaction-log.repository';
import { OfflineDatabase } from '@/lib/offline/offline-db';

export interface LogInteractionOptions {
  userId: string;
  tenantId: string;
  interactionType: InteractionType;
  modelUsed: string;
  prompt: string;
  imageUrl?: string;
  response: any;
  responseTimeMs: number;
  costUsd: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface BudgetStatus {
  dailyBudget: number;
  currentSpend: number;
  remainingBudget: number;
  percentUsed: number;
  isExceeded: boolean;
}

export class AIInteractionLogger {
  private repository: AIInteractionLogRepository;
  private offlineDb: OfflineDatabase;
  private readonly DAILY_BUDGET_USD = 10.00; // $10/day default budget
  
  // Model cost rates (per 1K tokens or per request)
  private readonly MODEL_COSTS = {
    'gpt-4-vision-preview': 0.03,  // $0.03 per image
    'gpt-4': 0.03,                  // $0.03 per 1K tokens
    'gpt-3.5-turbo': 0.001,        // $0.001 per 1K tokens
    'whisper': 0.006,               // $0.006 per minute
    'tts-1': 0.015,                 // $0.015 per 1K characters
    'yolo-local': 0.00              // Free (local inference)
  };

  constructor() {
    this.repository = new AIInteractionLogRepository();
    this.offlineDb = OfflineDatabase.getInstance();
  }

  /**
   * Log an AI interaction
   */
  async logInteraction(options: LogInteractionOptions): Promise<void> {
    try {
      // Check budget before logging
      const budgetStatus = await this.checkBudget(options.tenantId);
      
      // Warn if budget exceeded but still log
      if (budgetStatus.isExceeded) {
        console.warn(`⚠️ Daily AI budget exceeded for tenant ${options.tenantId}`);
      }

      // Create log entry
      await this.repository.create({
        userId: options.userId,
        interactionType: options.interactionType,
        modelUsed: options.modelUsed,
        prompt: options.prompt,
        imageUrl: options.imageUrl,
        response: options.response,
        responseTimeMs: options.responseTimeMs,
        costUsd: options.costUsd,
        error: options.error,
        metadata: {
          ...options.metadata,
          budgetExceeded: budgetStatus.isExceeded,
          dailySpendAtTime: budgetStatus.currentSpend + options.costUsd
        }
      }, options.tenantId);

      // If cost exceeds threshold, trigger alert
      if (options.costUsd > 0.10) {
        await this.triggerHighCostAlert(options);
      }

    } catch (error) {
      // Don't let logging failures break the main flow
      console.error('Failed to log AI interaction:', error);
      
      // Queue for offline sync if needed
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await this.offlineDb.queueOperation({
          operation: 'create',
          entity: 'ai_interaction_logs',
          data: options,
          priority: 'low'
        });
      }
    }
  }

  /**
   * Check current budget status
   */
  async checkBudget(tenantId: string): Promise<BudgetStatus> {
    try {
      const budgetCheck = await this.repository.isDailyBudgetExceeded(
        tenantId,
        this.DAILY_BUDGET_USD
      );

      return {
        dailyBudget: this.DAILY_BUDGET_USD,
        currentSpend: budgetCheck.currentSpend,
        remainingBudget: Math.max(0, this.DAILY_BUDGET_USD - budgetCheck.currentSpend),
        percentUsed: (budgetCheck.currentSpend / this.DAILY_BUDGET_USD) * 100,
        isExceeded: budgetCheck.exceeded
      };
    } catch (error) {
      // Return safe defaults on error
      return {
        dailyBudget: this.DAILY_BUDGET_USD,
        currentSpend: 0,
        remainingBudget: this.DAILY_BUDGET_USD,
        percentUsed: 0,
        isExceeded: false
      };
    }
  }

  /**
   * Estimate cost for an interaction
   */
  estimateCost(
    interactionType: InteractionType,
    modelUsed: string,
    inputSize: number
  ): number {
    const baseRate = this.MODEL_COSTS[modelUsed as keyof typeof this.MODEL_COSTS] || 0.01;
    
    switch (interactionType) {
      case 'vlm':
        // Vision models charge per image
        return baseRate;
        
      case 'llm':
        // Text models charge per 1K tokens (rough estimate: 1 token ≈ 4 chars)
        const estimatedTokens = inputSize / 4;
        return (estimatedTokens / 1000) * baseRate;
        
      case 'stt':
        // Whisper charges per minute (rough estimate: 150 words/minute)
        const estimatedMinutes = (inputSize / 150) / 60;
        return estimatedMinutes * baseRate;
        
      case 'tts':
        // TTS charges per 1K characters
        return (inputSize / 1000) * baseRate;
        
      case 'intent':
        // Intent classification uses VLM
        return this.MODEL_COSTS['gpt-4-vision-preview'];
        
      default:
        return 0.01; // Default cost
    }
  }

  /**
   * Get cost summary for a time period
   */
  async getCostSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    filters?: {
      userId?: string;
      interactionType?: InteractionType;
    }
  ) {
    return this.repository.calculateCostSummary(
      tenantId,
      startDate,
      endDate,
      filters
    );
  }

  /**
   * Get recent interactions for a user
   */
  async getRecentInteractions(
    tenantId: string,
    userId: string,
    limit: number = 10
  ) {
    return this.repository.findRecentByUser(tenantId, userId, limit);
  }

  /**
   * Log a batch of interactions
   */
  async logBatch(interactions: LogInteractionOptions[]): Promise<void> {
    // Process in parallel but catch individual errors
    await Promise.allSettled(
      interactions.map(interaction => this.logInteraction(interaction))
    );
  }

  /**
   * Trigger high cost alert
   */
  private async triggerHighCostAlert(options: LogInteractionOptions): Promise<void> {
    console.warn(`⚠️ High cost AI interaction detected:`, {
      type: options.interactionType,
      model: options.modelUsed,
      cost: `$${options.costUsd.toFixed(4)}`,
      userId: options.userId
    });

    // Could integrate with notification service here
    // For now, just log the warning
  }

  /**
   * Get interaction statistics
   */
  async getInteractionStats(
    tenantId: string,
    dateRange: { start: Date; end: Date }
  ) {
    const logs = await this.repository.findByDateRange(
      tenantId,
      dateRange.start,
      dateRange.end
    );

    const stats = {
      totalInteractions: logs.length,
      successfulInteractions: logs.filter(l => !l.error).length,
      failedInteractions: logs.filter(l => !!l.error).length,
      averageResponseTime: 0,
      interactionsByType: {} as Record<InteractionType, number>,
      interactionsByModel: {} as Record<string, number>,
      errorRate: 0
    };

    // Calculate averages and breakdowns
    let totalResponseTime = 0;
    
    logs.forEach(log => {
      totalResponseTime += log.responseTimeMs;
      
      // Count by type
      if (!stats.interactionsByType[log.interactionType]) {
        stats.interactionsByType[log.interactionType] = 0;
      }
      stats.interactionsByType[log.interactionType]++;
      
      // Count by model
      if (!stats.interactionsByModel[log.modelUsed]) {
        stats.interactionsByModel[log.modelUsed] = 0;
      }
      stats.interactionsByModel[log.modelUsed]++;
    });

    if (logs.length > 0) {
      stats.averageResponseTime = totalResponseTime / logs.length;
      stats.errorRate = (stats.failedInteractions / logs.length) * 100;
    }

    return stats;
  }

  /**
   * Check if a specific model is within budget
   */
  async canUseModel(
    tenantId: string,
    modelName: string,
    estimatedCost: number
  ): Promise<boolean> {
    const budget = await this.checkBudget(tenantId);
    return (budget.currentSpend + estimatedCost) <= this.DAILY_BUDGET_USD;
  }

  /**
   * Get model usage recommendations based on budget
   */
  async getModelRecommendations(tenantId: string): Promise<{
    recommendedModels: string[];
    budgetRemaining: number;
    suggestions: string[];
  }> {
    const budget = await this.checkBudget(tenantId);
    const recommendations = {
      recommendedModels: [] as string[],
      budgetRemaining: budget.remainingBudget,
      suggestions: [] as string[]
    };

    // Recommend models based on remaining budget
    if (budget.remainingBudget > 1.00) {
      recommendations.recommendedModels = ['gpt-4-vision-preview', 'gpt-4', 'whisper', 'tts-1'];
      recommendations.suggestions.push('Full AI capabilities available');
    } else if (budget.remainingBudget > 0.10) {
      recommendations.recommendedModels = ['gpt-3.5-turbo', 'whisper'];
      recommendations.suggestions.push('Consider using GPT-3.5 instead of GPT-4 to save costs');
    } else {
      recommendations.recommendedModels = ['yolo-local'];
      recommendations.suggestions.push('Budget nearly exhausted - using local models only');
    }

    if (budget.percentUsed > 80) {
      recommendations.suggestions.push(`⚠️ ${budget.percentUsed.toFixed(0)}% of daily budget used`);
    }

    return recommendations;
  }
}
