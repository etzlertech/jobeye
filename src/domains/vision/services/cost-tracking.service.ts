/**
 * @file /src/domains/vision/services/cost-tracking.service.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Cost tracking and budget enforcement service for VLM usage
 * @complexity_budget 250
 * @test_coverage ≥80%
 */

import { CostRecordRepository } from '../repositories/cost-record.repository.class';
import { createSupabaseClient } from '@/lib/supabase/client';

export interface CostAlert {
  type: 'warning' | 'critical';
  message: string;
  currentCost: number;
  budgetLimit: number;
  percentageUsed: number;
}

export interface CostSummary {
  tenantId: string;
  todayCost: number;
  todayRequests: number;
  totalCost: number;
  totalRequests: number;
  averageCostPerRequest: number;
  budgetRemaining?: number;
  requestsRemaining?: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  currentCost: number;
  currentRequests: number;
  remainingBudget: number;
  remainingRequests: number;
  alerts: CostAlert[];
}

/**
 * Service for tracking VLM costs and enforcing budgets
 */
export class CostTrackingService {
  private readonly WARNING_THRESHOLD = 0.8; // 80% of budget
  private readonly CRITICAL_THRESHOLD = 0.95; // 95% of budget
  private costRecordRepo: CostRecordRepository;

  constructor() {
    const supabase = createSupabaseClient();
    this.costRecordRepo = new CostRecordRepository(supabase);
  }

  /**
   * Check if a VLM request is within budget
   */
  async checkBudget(
    tenantId: string,
    dailyBudgetUsd?: number,
    dailyRequestLimit?: number
  ): Promise<BudgetCheckResult> {
    try {
      const budgetCheck = await this.costRecordRepo.canMakeVlmRequest(
        tenantId,
        dailyBudgetUsd,
        dailyRequestLimit
      );

      const { allowed, currentCost, currentRequests, remainingBudget, remainingRequests, reason } = budgetCheck;

      // Generate alerts based on usage
      const alerts = this.generateAlerts(
        currentCost,
        currentRequests,
        dailyBudgetUsd || 10.0,
        dailyRequestLimit || 100
      );

      return {
        allowed,
        reason,
        currentCost,
        currentRequests,
        remainingBudget,
        remainingRequests,
        alerts
      };
    } catch (error) {
      throw new Error(`Failed to check budget: ${error}`);
    }
  }

  /**
   * Record a VLM cost
   */
  async recordCost(
    tenantId: string,
    verificationId: string,
    costUsd: number,
    provider: string,
    modelVersion: string,
    tokensUsed?: number,
    imageSizeBytes?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.costRecordRepo.create({
        tenantId: tenantId,
        verificationId: verificationId,
        provider,
        model: modelVersion,
        operation: 'vision_verification',
        tokenCount: tokensUsed || 0,
        costUsd: costUsd,
        metadata: {
          imageSizeBytes
        }
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get today's cost summary
   */
  async getTodayCostSummary(tenantId: string): Promise<CostSummary> {
    try {
      const todayResult = await this.costRecordRepo.getTodaysCost(tenantId);
      const totalResult = await this.costRecordRepo.getTotalCost(tenantId);

      const averageCostPerRequest =
        totalResult.requestCount > 0
          ? totalResult.totalCost / totalResult.requestCount
          : 0;

      return {
        tenantId,
        todayCost: todayResult.totalCost,
        todayRequests: todayResult.requestCount,
        totalCost: totalResult.totalCost,
        totalRequests: totalResult.requestCount,
        averageCostPerRequest
      };
    } catch (error) {
      throw new Error(`Failed to get cost summary: ${error}`);
    }
  }

  /**
   * Get cost breakdown by provider
   */
  async getCostBreakdownByProvider(
    tenantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    provider: string;
    totalCost: number;
    requestCount: number;
    avgCost: number;
  }>> {
    try {
      return await this.costRecordRepo.getCostStatsByProvider(tenantId, startDate, endDate);
    } catch (error) {
      throw new Error(`Failed to get cost breakdown: ${error}`);
    }

    return result.data;
  }

  /**
   * Get daily cost summaries for a date range
   */
  async getDailyCostSummaries(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{
    date: string;
    totalCost: number;
    requestCount: number;
    avgCostPerRequest: number;
  }>> {
    const result = await costRecordRepo.getDailyCostSummaries(tenantId, startDate, endDate);

    if (result.error || !result.data) {
      throw new Error(`Failed to get daily summaries: ${result.error?.message}`);
    }

    return result.data;
  }

  /**
   * Generate budget alerts
   */
  private generateAlerts(
    currentCost: number,
    currentRequests: number,
    budgetLimit: number,
    requestLimit: number
  ): CostAlert[] {
    const alerts: CostAlert[] = [];

    // Cost-based alerts
    const costPercentage = currentCost / budgetLimit;
    if (costPercentage >= this.CRITICAL_THRESHOLD) {
      alerts.push({
        type: 'critical',
        message: `Cost usage critical: ${(costPercentage * 100).toFixed(1)}% of budget used`,
        currentCost,
        budgetLimit,
        percentageUsed: costPercentage
      });
    } else if (costPercentage >= this.WARNING_THRESHOLD) {
      alerts.push({
        type: 'warning',
        message: `Cost usage high: ${(costPercentage * 100).toFixed(1)}% of budget used`,
        currentCost,
        budgetLimit,
        percentageUsed: costPercentage
      });
    }

    // Request-based alerts
    const requestPercentage = currentRequests / requestLimit;
    if (requestPercentage >= this.CRITICAL_THRESHOLD) {
      alerts.push({
        type: 'critical',
        message: `Request limit critical: ${currentRequests}/${requestLimit} requests used`,
        currentCost: currentRequests,
        budgetLimit: requestLimit,
        percentageUsed: requestPercentage
      });
    } else if (requestPercentage >= this.WARNING_THRESHOLD) {
      alerts.push({
        type: 'warning',
        message: `Request usage high: ${currentRequests}/${requestLimit} requests used`,
        currentCost: currentRequests,
        budgetLimit: requestLimit,
        percentageUsed: requestPercentage
      });
    }

    return alerts;
  }

  /**
   * Check if alerts should be sent based on thresholds
   */
  shouldSendAlert(alerts: CostAlert[]): boolean {
    return alerts.some(alert => alert.type === 'critical');
  }

}

/**
 * Singleton instance
 */
let serviceInstance: CostTrackingService | null = null;

export function getCostTrackingService(): CostTrackingService {
  if (!serviceInstance) {
    serviceInstance = new CostTrackingService();
  }
  return serviceInstance;
}