/**
 * @file /src/domains/vision/services/batch-verification.service.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Batch verification service for multiple kits
 * @complexity_budget 400
 * @test_coverage ≥80%
 */

import { getVisionVerificationService, VerifyKitRequest, VerifyKitResult, VerificationError } from './vision-verification.service';

export interface BatchVerificationItem {
  kitId: string;
  imageData: ImageData;
  expectedItems: string[];
}

export interface BatchVerificationRequest {
  tenantId: string;
  items: BatchVerificationItem[];
  maxBudgetUsd?: number;
  maxRequestsPerDay?: number;
  stopOnError?: boolean; // Stop batch if one fails
  concurrency?: number; // Max parallel verifications (default 3)
}

export interface BatchVerificationResult {
  batchId: string;
  totalItems: number;
  completedItems: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    kitId: string;
    success: boolean;
    result?: VerifyKitResult;
    error?: VerificationError;
    processingOrder: number;
  }>;
  totalCostUsd: number;
  totalProcessingTimeMs: number;
  budgetStatus?: {
    allowed: boolean;
    remainingBudget: number;
    remainingRequests: number;
  };
}

/**
 * Batch verification service for processing multiple kits efficiently
 */
export class BatchVerificationService {
  private visionService = getVisionVerificationService();

  /**
   * Process multiple kit verifications in batch with concurrency control
   */
  async verifyBatch(request: BatchVerificationRequest): Promise<{
    data: BatchVerificationResult | null;
    error: Error | null;
  }> {
    const startTime = Date.now();
    const {
      tenantId,
      items,
      maxBudgetUsd,
      maxRequestsPerDay,
      stopOnError = false,
      concurrency = 3
    } = request;

    if (items.length === 0) {
      return {
        data: null,
        error: new Error('No items provided for batch verification')
      };
    }

    const batchId = this.generateBatchId();
    const results: BatchVerificationResult['results'] = [];
    let totalCost = 0;
    let completedCount = 0;
    let successCount = 0;
    let failureCount = 0;

    try {
      // Process items in chunks with concurrency control
      for (let i = 0; i < items.length; i += concurrency) {
        const chunk = items.slice(i, i + concurrency);

        // Process chunk in parallel
        const chunkResults = await Promise.all(
          chunk.map(async (item, idx) => {
            const processingOrder = i + idx + 1;

            try {
              const verifyRequest: VerifyKitRequest = {
                kitId: item.kitId,
                tenantId,
                imageData: item.imageData,
                expectedItems: item.expectedItems,
                maxBudgetUsd,
                maxRequestsPerDay
              };

              const { data, error } = await this.visionService.verifyKit(verifyRequest);

              completedCount++;

              if (error) {
                failureCount++;

                if (stopOnError) {
                  throw new Error(`Verification failed for kit ${item.kitId}: ${error.message}`);
                }

                return {
                  kitId: item.kitId,
                  success: false,
                  error,
                  processingOrder
                };
              }

              successCount++;
              totalCost += data?.costUsd || 0;

              return {
                kitId: item.kitId,
                success: true,
                result: data!,
                processingOrder
              };

            } catch (error: any) {
              failureCount++;

              if (stopOnError) {
                throw error;
              }

              return {
                kitId: item.kitId,
                success: false,
                error: {
                  code: 'UNKNOWN' as const,
                  message: error.message || 'Unknown error',
                  details: error
                },
                processingOrder
              };
            }
          })
        );

        results.push(...chunkResults);

        // If stopOnError is true and we have failures, break
        if (stopOnError && chunkResults.some(r => !r.success)) {
          break;
        }
      }

      const totalProcessingTimeMs = Date.now() - startTime;

      // Get final budget status from last successful result
      const lastSuccessfulResult = results
        .reverse()
        .find(r => r.success && r.result);

      const budgetStatus = lastSuccessfulResult?.result?.budgetStatus;

      const batchResult: BatchVerificationResult = {
        batchId,
        totalItems: items.length,
        completedItems: completedCount,
        successCount,
        failureCount,
        results,
        totalCostUsd: totalCost,
        totalProcessingTimeMs,
        budgetStatus
      };

      return {
        data: batchResult,
        error: null
      };

    } catch (error: any) {
      return {
        data: {
          batchId,
          totalItems: items.length,
          completedItems: completedCount,
          successCount,
          failureCount,
          results,
          totalCostUsd: totalCost,
          totalProcessingTimeMs: Date.now() - startTime
        },
        error: new Error(error.message || 'Batch verification failed')
      };
    }
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate cost for batch verification
   * @param photoCount Number of photos to verify
   * @returns Estimated cost in USD
   */
  estimateBatchCost(photoCount: number): number {
    if (photoCount <= 0) {
      return 0;
    }

    // Assume 20% of photos will use VLM (80% use local YOLO)
    const vlmRate = 0.2;
    const vlmCount = Math.ceil(photoCount * vlmRate);

    // VLM cost: ~$0.10 per photo
    const vlmCost = vlmCount * 0.10;

    // Local YOLO cost: $0 (runs on device)
    return vlmCost;
  }
}

/**
 * Singleton instance
 */
let serviceInstance: BatchVerificationService | null = null;

export function getBatchVerificationService(): BatchVerificationService {
  if (!serviceInstance) {
    serviceInstance = new BatchVerificationService();
  }
  return serviceInstance;
}