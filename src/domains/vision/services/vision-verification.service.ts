/**
 * @file /src/domains/vision/services/vision-verification.service.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Main orchestration service for vision-based kit verification
 * @complexity_budget 400
 * @test_coverage ≥80%
 */

import { detectObjects, YoloInferenceResult } from '../lib/yolo-inference';
import { evaluateFallbackNeed, VlmRequest, VlmResult } from '../lib/vlm-fallback-router';
import { callOpenAIVision } from '../lib/openai-vision-adapter';
import { estimateCost } from '../lib/cost-estimator';
import * as verificationRepo from '../repositories/vision-verification.repository';
import * as detectedItemRepo from '../repositories/detected-item.repository';
import * as costRecordRepo from '../repositories/cost-record.repository';

export interface VerifyKitRequest {
  kitId: string;
  companyId: string;
  imageData: ImageData;
  expectedItems: string[];
  maxBudgetUsd?: number;
  maxRequestsPerDay?: number;
}

export interface VerifyKitResult {
  verificationId: string;
  verificationResult: 'complete' | 'incomplete' | 'failed';
  processingMethod: 'local_yolo' | 'cloud_vlm';
  confidenceScore: number;
  detectedItems: Array<{
    itemType: string;
    confidence: number;
    matchStatus: 'matched' | 'unmatched' | 'uncertain';
  }>;
  missingItems: string[];
  unexpectedItems: string[];
  costUsd: number;
  processingTimeMs: number;
  budgetStatus?: {
    allowed: boolean;
    remainingBudget: number;
    remainingRequests: number;
  };
}

export interface VerificationError {
  code: 'BUDGET_EXCEEDED' | 'REQUEST_LIMIT_REACHED' | 'YOLO_FAILED' | 'VLM_FAILED' | 'UNKNOWN';
  message: string;
  details?: any;
}

/**
 * Main verification service - orchestrates YOLO, VLM, and repository operations
 */
export class VisionVerificationService {
  /**
   * Verify kit contents using YOLO + optional VLM fallback
   */
  async verifyKit(request: VerifyKitRequest): Promise<{
    data: VerifyKitResult | null;
    error: VerificationError | null;
  }> {
    const startTime = Date.now();
    const { kitId, companyId, imageData, expectedItems, maxBudgetUsd, maxRequestsPerDay } = request;

    try {
      // Step 1: Run YOLO detection
      const yoloResult = await this.runYoloDetection(imageData);
      if (!yoloResult.success) {
        return {
          data: null,
          error: {
            code: 'YOLO_FAILED',
            message: 'YOLO detection failed',
            details: yoloResult
          }
        };
      }

      // Step 2: Evaluate if we need VLM fallback
      const estimatedVlmCost = estimateCost('openai-gpt4-vision', imageData);
      const fallbackDecision = evaluateFallbackNeed(
        yoloResult,
        expectedItems.length,
        estimatedVlmCost
      );

      let finalDetections = yoloResult.detections;
      let processingMethod: 'local_yolo' | 'cloud_vlm' = 'local_yolo';
      let totalCost = 0;
      let vlmResult: VlmResult | null = null;

      // Step 3: If fallback needed, check budget and call VLM
      if (fallbackDecision.shouldUseFallback) {
        // Check budget
        const budgetCheck = await costRecordRepo.canMakeVlmRequest(
          companyId,
          maxBudgetUsd,
          maxRequestsPerDay
        );

        if (budgetCheck.error) {
          return {
            data: null,
            error: {
              code: 'UNKNOWN',
              message: 'Failed to check budget',
              details: budgetCheck.error
            }
          };
        }

        if (!budgetCheck.data?.allowed) {
          // Budget exceeded - use YOLO results only
          console.warn(`VLM fallback blocked: ${budgetCheck.data?.reason}`);
        } else {
          // Budget OK - call VLM
          const vlmRequest: VlmRequest = {
            imageData,
            kitId,
            expectedItems,
            companyId,
            context: `Verify kit ${kitId}. Expected items: ${expectedItems.join(', ')}`
          };

          vlmResult = await this.runVlmDetection(vlmRequest);
          if (vlmResult) {
            // Merge VLM detections with YOLO
            finalDetections = this.mergeDetections(yoloResult.detections, vlmResult.detections);
            processingMethod = 'cloud_vlm';
            totalCost = vlmResult.estimatedCostUsd;

            // Record cost
            await costRecordRepo.createCostRecord({
              company_id: companyId,
              verification_id: '', // Will update after creating verification
              cost_usd: vlmResult.estimatedCostUsd,
              provider: 'openai-gpt4-vision',
              model_version: vlmResult.modelVersion,
              tokens_used: vlmResult.tokensUsed,
              image_size_bytes: this.getImageSize(imageData)
            });
          }
        }
      }

      // Step 4: Match detected items against expected items
      const matchingResult = this.matchDetectedItems(finalDetections, expectedItems);

      // Step 5: Determine verification result
      const verificationResult = this.determineVerificationResult(
        matchingResult.detectedItems,
        matchingResult.missingItems
      );

      // Step 6: Calculate overall confidence
      const confidenceScore = this.calculateOverallConfidence(matchingResult.detectedItems);

      // Step 7: Save verification record
      const verification = await verificationRepo.createVerification({
        tenant_id: companyId,
        kit_id: kitId,
        verification_result: verificationResult,
        processing_method: processingMethod,
        confidence_score: confidenceScore,
        processing_time_ms: Date.now() - startTime,
        verified_at: new Date().toISOString()
      });

      if (verification.error || !verification.data) {
        return {
          data: null,
          error: {
            code: 'UNKNOWN',
            message: 'Failed to save verification record',
            details: verification.error
          }
        };
      }

      const verificationId = verification.data.id;

      // Step 8: Save detected items
      const itemsToSave = matchingResult.detectedItems.map(item => ({
        verification_id: verificationId,
        item_type: item.itemType,
        confidence_score: item.confidence,
        match_status: item.matchStatus,
        matched_kit_item_id: item.matchStatus === 'matched' ? kitId : undefined
      }));

      if (itemsToSave.length > 0) {
        await detectedItemRepo.createDetectedItems(itemsToSave);
      }

      // Step 9: Build and return result
      const processingTimeMs = Date.now() - startTime;

      const budgetCheck = await costRecordRepo.canMakeVlmRequest(
        companyId,
        maxBudgetUsd,
        maxRequestsPerDay
      );

      return {
        data: {
          verificationId,
          verificationResult,
          processingMethod,
          confidenceScore,
          detectedItems: matchingResult.detectedItems,
          missingItems: matchingResult.missingItems,
          unexpectedItems: matchingResult.unexpectedItems,
          costUsd: totalCost,
          processingTimeMs,
          budgetStatus: budgetCheck.data ? {
            allowed: budgetCheck.data.allowed,
            remainingBudget: budgetCheck.data.remainingBudget,
            remainingRequests: budgetCheck.data.remainingRequests
          } : undefined
        },
        error: null
      };

    } catch (error: any) {
      return {
        data: null,
        error: {
          code: 'UNKNOWN',
          message: error.message || 'Unknown error during verification',
          details: error
        }
      };
    }
  }

  /**
   * Run YOLO object detection
   */
  private async runYoloDetection(imageData: ImageData): Promise<YoloInferenceResult> {
    try {
      return await detectObjects(imageData);
    } catch (error: any) {
      return {
        success: false,
        detections: [],
        processingTimeMs: 0,
        error: error.message
      };
    }
  }

  /**
   * Run VLM detection via OpenAI
   */
  private async runVlmDetection(request: VlmRequest): Promise<VlmResult | null> {
    try {
      return await callOpenAIVision(request);
    } catch (error) {
      console.error('VLM detection failed:', error);
      return null;
    }
  }

  /**
   * Merge YOLO and VLM detections (VLM takes precedence for conflicts)
   */
  private mergeDetections(
    yoloDetections: Array<{ class: string; confidence: number }>,
    vlmDetections: Array<{ itemType: string; confidence: number }>
  ): Array<{ class: string; confidence: number }> {
    const merged = new Map<string, { class: string; confidence: number }>();

    // Add YOLO detections
    yoloDetections.forEach(d => {
      merged.set(d.class, { class: d.class, confidence: d.confidence });
    });

    // VLM overrides YOLO for same items
    vlmDetections.forEach(d => {
      merged.set(d.itemType, { class: d.itemType, confidence: d.confidence });
    });

    return Array.from(merged.values());
  }

  /**
   * Match detected items against expected kit items
   */
  private matchDetectedItems(
    detections: Array<{ class: string; confidence: number }>,
    expectedItems: string[]
  ): {
    detectedItems: Array<{
      itemType: string;
      confidence: number;
      matchStatus: 'matched' | 'unmatched' | 'uncertain';
    }>;
    missingItems: string[];
    unexpectedItems: string[];
  } {
    const detectedItems = detections.map(d => ({
      itemType: d.class,
      confidence: d.confidence,
      matchStatus: this.determineMatchStatus(d.class, expectedItems, d.confidence)
    }));

    const detectedTypes = new Set(detections.map(d => d.class));
    const missingItems = expectedItems.filter(item => !detectedTypes.has(item));
    const unexpectedItems = Array.from(detectedTypes).filter(type => !expectedItems.includes(type));

    return { detectedItems, missingItems, unexpectedItems };
  }

  /**
   * Determine match status for a detected item
   */
  private determineMatchStatus(
    detectedType: string,
    expectedItems: string[],
    confidence: number
  ): 'matched' | 'unmatched' | 'uncertain' {
    if (!expectedItems.includes(detectedType)) {
      return 'unmatched';
    }
    if (confidence < 0.6) {
      return 'uncertain';
    }
    return 'matched';
  }

  /**
   * Determine overall verification result
   */
  private determineVerificationResult(
    detectedItems: Array<{ matchStatus: string }>,
    missingItems: string[]
  ): 'complete' | 'incomplete' | 'failed' {
    const matchedCount = detectedItems.filter(d => d.matchStatus === 'matched').length;
    const uncertainCount = detectedItems.filter(d => d.matchStatus === 'uncertain').length;

    if (missingItems.length === 0 && uncertainCount === 0) {
      return 'complete';
    }
    if (matchedCount === 0 && missingItems.length > 0) {
      return 'failed';
    }
    return 'incomplete';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    detectedItems: Array<{ confidence: number; matchStatus: string }>
  ): number {
    if (detectedItems.length === 0) return 0;

    const matchedItems = detectedItems.filter(d => d.matchStatus === 'matched');
    if (matchedItems.length === 0) return 0;

    const sum = matchedItems.reduce((acc, item) => acc + item.confidence, 0);
    return sum / matchedItems.length;
  }

  /**
   * Get image size in bytes
   */
  private getImageSize(imageData: ImageData): number {
    return imageData.width * imageData.height * 4; // RGBA
  }
}

/**
 * Singleton instance
 */
let serviceInstance: VisionVerificationService | null = null;

export function getVisionVerificationService(): VisionVerificationService {
  if (!serviceInstance) {
    serviceInstance = new VisionVerificationService();
  }
  return serviceInstance;
}