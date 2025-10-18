/**
 * @file /src/domains/vision/services/vision-verification.service.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Main orchestration service for vision-based kit verification
 * @complexity_budget 400
 * @test_coverage ≥80%
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { voiceLogger } from '@/core/logger/voice-logger';
import { runYoloInference } from '../lib/yolo-inference';
import { evaluateFallbackNeed, VlmRequest, VlmResult } from '../lib/vlm-fallback-router';
import { callOpenAIVision } from '../lib/openai-vision-adapter';
import { estimateCost } from '../lib/cost-estimator';
import { VisionVerificationRepository } from '../repositories/vision-verification.repository.class';
import { DetectedItemRepository } from '../repositories/detected-item.repository.class';
import { CostRecordRepository } from '../repositories/cost-record.repository.class';
import { createSupabaseClient } from '@/lib/supabase/client';
import {
  detectWithRemoteYolo,
  isRemoteYoloConfigured,
  RemoteYoloConfig,
} from '@/domains/vision/services/yolo-remote-client';
import { imageDataToBlob } from '@/domains/vision/utils/image-data';
import {
  DetectionSource,
  ProcessingMethod,
  VisionDetection,
  VlmDetection,
  YoloDetectionBatch,
  VisionBoundingBox,
  MatchStatus,
} from '../lib/vision-types';

export interface VerifyKitRequest {
  kitId: string;
  tenantId: string;
  imageData: ImageData;
  expectedItems: string[];
  maxBudgetUsd?: number;
  maxRequestsPerDay?: number;
}

export interface VerifyKitResult {
  verificationId: string;
  verificationResult: 'complete' | 'incomplete' | 'failed';
  processingMethod: ProcessingMethod;
  confidenceScore: number;
  detections?: VisionDetection[];
  detectedItems: DetectionMatchSummary[];
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

export interface DetectionMatchSummary {
  itemType: string;
  confidence: number;
  matchStatus: MatchStatus;
  source?: DetectionSource;
  provider?: string;
  modelVersion?: string;
  reasoning?: string;
  boundingBox?: VisionBoundingBox;
}

export interface VerificationError {
  code: 'BUDGET_EXCEEDED' | 'REQUEST_LIMIT_REACHED' | 'YOLO_FAILED' | 'VLM_FAILED' | 'UNKNOWN';
  message: string;
  details?: any;
}

export interface VisionVerificationOptions {
  supabaseClient?: SupabaseClient;
  repositories?: {
    verificationRepo?: VisionVerificationRepository;
    detectedItemRepo?: DetectedItemRepository;
    costRecordRepo?: CostRecordRepository;
  };
  yolo?: {
    endpoint?: string;
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
    maxDetections?: number;
  };
  logger?: typeof voiceLogger;
}

function normalizeOptions(
  input?: VisionVerificationOptions | SupabaseClient | null
): VisionVerificationOptions {
  if (!input) {
    return {};
  }

  if (isSupabaseClient(input)) {
    return { supabaseClient: input };
  }

  return input;
}

function isSupabaseClient(value: unknown): value is SupabaseClient {
  return Boolean(value) && typeof (value as SupabaseClient).from === 'function';
}

function resolveRemoteYoloConfig(
  options: VisionVerificationOptions
): RemoteYoloConfig | undefined {
  const endpoint =
    options.yolo?.endpoint ??
    process.env.VISION_YOLO_ENDPOINT ??
    process.env.SAFETY_YOLO_ENDPOINT;

  if (!endpoint) {
    return undefined;
  }

  const timeoutSource =
    options.yolo?.timeoutMs?.toString() ??
    process.env.VISION_YOLO_TIMEOUT_MS ??
    process.env.SAFETY_YOLO_TIMEOUT_MS ??
    '';
  const timeoutMs = parseInt(timeoutSource, 10);

  return {
    endpoint,
    apiKey:
      options.yolo?.apiKey ??
      process.env.VISION_YOLO_API_KEY ??
      process.env.SAFETY_YOLO_API_KEY,
    model:
      options.yolo?.model ??
      process.env.VISION_YOLO_MODEL ??
      process.env.SAFETY_YOLO_MODEL,
    maxDetections: options.yolo?.maxDetections,
    timeoutMs: Number.isNaN(timeoutMs) ? undefined : timeoutMs,
  } satisfies RemoteYoloConfig;
}

/**
 * Main verification service - orchestrates YOLO, VLM, and repository operations
 */
export class VisionVerificationService {
  private readonly verificationRepo: VisionVerificationRepository;
  private readonly detectedItemRepo: DetectedItemRepository;
  private readonly costRecordRepo: CostRecordRepository;
  private readonly logger: typeof voiceLogger;
  private readonly remoteYoloConfig?: RemoteYoloConfig;

  constructor(optionsOrClient?: VisionVerificationOptions | SupabaseClient | null) {
    const options = normalizeOptions(optionsOrClient);
    this.logger = options.logger ?? voiceLogger;
    this.remoteYoloConfig = resolveRemoteYoloConfig(options);

    const needsSupabase =
      !options.repositories?.verificationRepo ||
      !options.repositories?.detectedItemRepo ||
      !options.repositories?.costRecordRepo;

    const supabase = options.supabaseClient ?? (needsSupabase ? createSupabaseClient() : undefined);

    if (!options.repositories?.verificationRepo) {
      this.verificationRepo = new VisionVerificationRepository(supabase!);
    } else {
      this.verificationRepo = options.repositories.verificationRepo;
    }

    if (!options.repositories?.detectedItemRepo) {
      this.detectedItemRepo = new DetectedItemRepository(supabase!);
    } else {
      this.detectedItemRepo = options.repositories.detectedItemRepo;
    }

    if (!options.repositories?.costRecordRepo) {
      this.costRecordRepo = new CostRecordRepository(supabase!);
    } else {
      this.costRecordRepo = options.repositories.costRecordRepo;
    }
  }

  /**
   * Verify kit contents using YOLO + optional VLM fallback
   */
  async verifyKit(request: VerifyKitRequest): Promise<{
    data: VerifyKitResult | null;
    error: VerificationError | null;
  }> {
    const startTime = Date.now();
    const { kitId, tenantId, imageData, expectedItems, maxBudgetUsd, maxRequestsPerDay } = request;

    try {
      // Step 1: Run YOLO detection
      let yoloResult: YoloDetectionBatch;
      try {
        yoloResult = await this.runYoloDetection(imageData);
      } catch (detectionError) {
        return {
          data: null,
          error: {
            code: 'YOLO_FAILED',
            message: 'YOLO detection failed',
            details: detectionError instanceof Error ? detectionError.message : detectionError,
          },
        };
      }

      // Step 2: Evaluate if we need VLM fallback
      const estimatedVlmCost = estimateCost('openai-gpt4-vision', imageData);
      const fallbackDecision = evaluateFallbackNeed(
        yoloResult,
        expectedItems.length,
        estimatedVlmCost
      );

      let finalDetections: VisionDetection[] = yoloResult.detections.map((detection) => ({ ...detection }));
      let processingMethod: ProcessingMethod =
        yoloResult.source === 'remote_yolo' ? 'remote_yolo' : 'local_yolo';
      let totalCost = 0;
      let vlmResult: VlmResult | null = null;

      // Step 3: If fallback needed, check budget and call VLM
      if (fallbackDecision.shouldUseFallback) {
        // Check budget
        try {
          const budgetCheck = await this.costRecordRepo.canMakeVlmRequest(
            tenantId,
            maxBudgetUsd || 10.0,
            maxRequestsPerDay || 100
          );

          if (!budgetCheck.allowed) {
            // Budget exceeded - use YOLO results only
            console.warn(`VLM fallback blocked: ${budgetCheck.reason}`);
          } else {
            // Budget OK - call VLM
            const vlmRequest: VlmRequest = {
            imageData,
            kitId,
            expectedItems,
            tenantId,
            context: `Verify kit ${kitId}. Expected items: ${expectedItems.join(', ')}`
          };

          vlmResult = await this.runVlmDetection(vlmRequest);
          if (vlmResult) {
            // Merge VLM detections with YOLO
            finalDetections = this.mergeDetections(yoloResult.detections, vlmResult.detections);
            processingMethod = 'cloud_vlm';
            totalCost = vlmResult.estimatedCostUsd;

            // Record cost
            await this.costRecordRepo.create({
              tenantId: tenantId,
              verificationId: undefined, // Will update after creating verification
              provider: 'openai-gpt4-vision',
              model: vlmResult.modelVersion,
              operation: 'vision_verification',
              tokenCount: vlmResult.tokensUsed ?? 0,
              costUsd: vlmResult.estimatedCostUsd,
              metadata: {
                imageSizeBytes: this.getImageSize(imageData),
                fallbackReason: fallbackDecision.reason,
              }
            });
            }
          }
        } catch (budgetError) {
          console.error('Budget check error:', budgetError);
          // Continue with YOLO results only
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
      let verificationId: string;
      try {
        const verification = await this.verificationRepo.create({
          tenantId: tenantId,
          kitId: kitId,
          verificationResult: verificationResult,
          processingMethod: processingMethod,
          confidenceScore: confidenceScore,
          detectionCount: matchingResult.detectedItems.length,
          expectedCount: expectedItems.length,
          processingTimeMs: Date.now() - startTime,
          costUsd: totalCost,
          verifiedAt: new Date().toISOString(),
          metadata: {},
        });

        verificationId = verification.id;

        // Step 8: Save detected items
        const itemsToSave = matchingResult.detectedItems.map((item) => ({
          verificationId: verificationId,
          itemType: item.itemType,
          itemName: item.itemType, // Use type as name for now
          confidenceScore: item.confidence,
          matchStatus: item.matchStatus,
          expectedItemId: item.matchStatus === 'matched' ? kitId : undefined,
          boundingBox: item.boundingBox,
          metadata: {
            source: item.source,
            provider: item.provider,
            modelVersion: item.modelVersion,
            reasoning: item.reasoning,
          },
        }));

        if (itemsToSave.length > 0) {
          await this.detectedItemRepo.createMany(itemsToSave);
        }
      } catch (error) {
        return {
          data: null,
          error: {
            code: 'UNKNOWN',
            message: 'Failed to save verification record',
            details: error
          }
        };
      }

      // Step 9: Build and return result
      const processingTimeMs = Date.now() - startTime;

      const budgetCheck = await this.costRecordRepo.canMakeVlmRequest(
        tenantId,
        maxBudgetUsd,
        maxRequestsPerDay
      );

      return {
        data: {
          verificationId,
          verificationResult,
          processingMethod,
          confidenceScore,
          detections: finalDetections,
          detectedItems: matchingResult.detectedItems,
          missingItems: matchingResult.missingItems,
          unexpectedItems: matchingResult.unexpectedItems,
          costUsd: totalCost,
          processingTimeMs,
          budgetStatus: budgetCheck ? {
            allowed: budgetCheck.allowed,
            remainingBudget: budgetCheck.remainingBudget,
            remainingRequests: budgetCheck.remainingRequests
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
  private async runYoloDetection(imageData: ImageData): Promise<YoloDetectionBatch> {
    if (this.remoteYoloConfig && isRemoteYoloConfigured(this.remoteYoloConfig)) {
      const blob = await imageDataToBlob(imageData);

      if (!blob) {
        this.logger.warn(
          'Vision verification: unable to serialise ImageData for remote YOLO. Falling back to local inference.'
        );
      } else {
        try {
          return await detectWithRemoteYolo(blob, this.remoteYoloConfig, {
            maxDetections: this.remoteYoloConfig.maxDetections,
          });
        } catch (error: any) {
          this.logger.warn('Vision verification: remote YOLO failed, using local fallback.', {
            error: error?.message ?? String(error),
          });
        }
      }
    }

    try {
      return await runYoloInference(imageData);
    } catch (error: any) {
      this.logger.error('Vision verification: local YOLO inference failed.', {
        error: error?.message ?? String(error),
      });

      throw error instanceof Error ? error : new Error(String(error));
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
    yoloDetections: VisionDetection[],
    vlmDetections: VlmDetection[]
  ): VisionDetection[] {
    if (!vlmDetections.length) {
      return yoloDetections.map((detection) => ({ ...detection }));
    }

    const merged = new Map<string, VisionDetection>();

    yoloDetections.forEach((detection) => {
      merged.set(detection.itemType.toLowerCase(), { ...detection });
    });

    vlmDetections.forEach((detection) => {
      const key = detection.itemType.toLowerCase();
      const existing = merged.get(key);

      if (!existing || detection.confidence >= existing.confidence) {
        merged.set(key, { ...detection });
        return;
      }

      merged.set(key, {
        ...existing,
        metadata: {
          ...(existing.metadata ?? {}),
          vlmConfidence: detection.confidence,
          vlmReasoning: detection.reasoning,
        },
      });
    });

    return Array.from(merged.values());
  }

  /**
   * Match detected items against expected kit items
   */
  private matchDetectedItems(
    detections: VisionDetection[],
    expectedItems: string[]
  ): {
    detectedItems: DetectionMatchSummary[];
    missingItems: string[];
    unexpectedItems: string[];
  } {
    const detectedItems = detections.map<DetectionMatchSummary>((detection) => ({
      itemType: detection.itemType,
      confidence: detection.confidence,
      matchStatus: this.determineMatchStatus(detection.itemType, expectedItems, detection.confidence),
      source: detection.source,
      provider: detection.provider,
      modelVersion: detection.modelVersion,
      reasoning: detection.source === 'cloud_vlm' ? (detection as VlmDetection).reasoning : undefined,
      boundingBox: detection.boundingBox,
    }));

    const detectedTypes = new Set(detections.map((detection) => detection.itemType));
    const missingItems = expectedItems.filter((item) => !detectedTypes.has(item));
    const unexpectedItems = Array.from(detectedTypes).filter((type) => !expectedItems.includes(type));

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
    detectedItems: DetectionMatchSummary[],
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
  private calculateOverallConfidence(detectedItems: DetectionMatchSummary[]): number {
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
