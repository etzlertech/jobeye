/**
 * @file /src/domains/vision/lib/vlm-fallback-router.ts
 * @phase 3.4
 * @domain Vision
 * @purpose VLM fallback router - triggers cloud vision when YOLO confidence < 70%
 * @complexity_budget 300
 * @test_coverage ≥80%
 * @dependencies openai, ./yolo-inference, ./cost-estimator
 */

import { YoloInferenceResult } from './yolo-inference';

export const CONFIDENCE_THRESHOLD = 0.7; // 70% from spec clarification Q2

export interface VlmRequest {
  imageData: ImageData;
  kitId: string;
  expectedItems: string[]; // Kit items expected in the photo
  companyId: string;
  context?: string; // Optional context for better detection
}

export interface VlmDetection {
  itemType: string;
  confidence: number;
  reasoning: string; // Why the VLM thinks this item is present
  matchedExpectedItem?: string; // Which expected item this matches
}

export interface VlmResult {
  detections: VlmDetection[];
  processingTimeMs: number;
  estimatedCostUsd: number;
  provider: 'openai-gpt4-vision';
  modelVersion: string;
  tokensUsed?: number;
}

export interface FallbackDecision {
  shouldUseFallback: boolean;
  reason: string;
  yoloConfidence: number;
  detectionCount: number;
  missingItemsCount: number;
  estimatedCostUsd: number;
}

export interface VerificationResult {
  method: 'local_yolo' | 'cloud_vlm';
  detections: Array<{
    itemType: string;
    confidence: number;
    source: 'yolo' | 'vlm';
  }>;
  totalConfidence: number;
  processingTimeMs: number;
  costUsd: number;
  fallbackDecision?: FallbackDecision;
}

/**
 * Evaluate if VLM fallback is needed based on YOLO results
 */
export function evaluateFallbackNeed(
  yoloResult: YoloInferenceResult,
  expectedItemCount: number,
  estimatedCost: number
): FallbackDecision {
  const detections = yoloResult.detections;
  const detectionCount = detections.length;

  // Calculate average confidence
  const avgConfidence = detectionCount > 0
    ? detections.reduce((sum, d) => sum + d.confidence, 0) / detectionCount
    : 0;

  // Check if any detection is below threshold
  const lowConfidenceDetections = detections.filter(d => d.confidence < CONFIDENCE_THRESHOLD);
  const hasLowConfidence = lowConfidenceDetections.length > 0;

  // Check if we're missing expected items
  const missingItemsCount = Math.max(0, expectedItemCount - detectionCount);
  const hasMissingItems = missingItemsCount > 0;

  // Decision logic
  let shouldUseFallback = false;
  let reason = '';

  if (hasLowConfidence) {
    shouldUseFallback = true;
    reason = `${lowConfidenceDetections.length} detection(s) below ${CONFIDENCE_THRESHOLD * 100}% confidence (avg: ${(avgConfidence * 100).toFixed(1)}%)`;
  } else if (hasMissingItems) {
    shouldUseFallback = true;
    reason = `Missing ${missingItemsCount} expected item(s) (detected ${detectionCount}/${expectedItemCount})`;
  } else if (detectionCount === 0 && expectedItemCount > 0) {
    shouldUseFallback = true;
    reason = 'No items detected, but kit should contain items';
  } else {
    reason = `All detections above ${CONFIDENCE_THRESHOLD * 100}% confidence (avg: ${(avgConfidence * 100).toFixed(1)}%)`;
  }

  return {
    shouldUseFallback,
    reason,
    yoloConfidence: avgConfidence,
    detectionCount,
    missingItemsCount,
    estimatedCostUsd: estimatedCost
  };
}

/**
 * Combine YOLO and VLM results with conflict resolution
 */
export function combineDetectionResults(
  yoloResult: YoloInferenceResult,
  vlmResult: VlmResult
): VerificationResult {
  const combinedDetections = new Map<string, {
    itemType: string;
    confidence: number;
    source: 'yolo' | 'vlm' | 'both';
    yoloConfidence?: number;
    vlmConfidence?: number;
  }>();

  // Add YOLO detections
  yoloResult.detections.forEach(detection => {
    const key = detection.itemType.toLowerCase();
    combinedDetections.set(key, {
      itemType: detection.itemType,
      confidence: detection.confidence,
      source: 'yolo',
      yoloConfidence: detection.confidence
    });
  });

  // Add or merge VLM detections
  vlmResult.detections.forEach(detection => {
    const key = detection.itemType.toLowerCase();
    const existing = combinedDetections.get(key);

    if (existing) {
      // Both detected same item - use higher confidence
      const maxConfidence = Math.max(existing.confidence, detection.confidence);
      combinedDetections.set(key, {
        itemType: existing.itemType,
        confidence: maxConfidence,
        source: 'both',
        yoloConfidence: existing.yoloConfidence,
        vlmConfidence: detection.confidence
      });
    } else {
      // VLM found something YOLO missed
      combinedDetections.set(key, {
        itemType: detection.itemType,
        confidence: detection.confidence,
        source: 'vlm',
        vlmConfidence: detection.confidence
      });
    }
  });

  // Convert to array
  const detections = Array.from(combinedDetections.values()).map(d => ({
    itemType: d.itemType,
    confidence: d.confidence,
    source: d.source === 'both' ? 'vlm' : d.source as 'yolo' | 'vlm'
  }));

  // Calculate overall confidence (weighted average)
  const totalConfidence = detections.length > 0
    ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
    : 0;

  return {
    method: 'cloud_vlm',
    detections,
    totalConfidence,
    processingTimeMs: yoloResult.processingTimeMs + vlmResult.processingTimeMs,
    costUsd: vlmResult.estimatedCostUsd
  };
}

/**
 * Create verification result from YOLO-only detection
 */
export function createYoloOnlyResult(yoloResult: YoloInferenceResult): VerificationResult {
  const detections = yoloResult.detections.map(d => ({
    itemType: d.itemType,
    confidence: d.confidence,
    source: 'yolo' as const
  }));

  const totalConfidence = detections.length > 0
    ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
    : 0;

  return {
    method: 'local_yolo',
    detections,
    totalConfidence,
    processingTimeMs: yoloResult.processingTimeMs,
    costUsd: 0
  };
}

/**
 * Format detection summary for voice output
 */
export function formatDetectionSummary(result: VerificationResult): string {
  const itemCount = result.detections.length;
  const avgConfidence = (result.totalConfidence * 100).toFixed(0);
  const method = result.method === 'local_yolo' ? 'local detection' : 'cloud verification';

  if (itemCount === 0) {
    return `No items detected using ${method}`;
  }

  const items = result.detections
    .map(d => `${d.itemType} (${(d.confidence * 100).toFixed(0)}%)`)
    .join(', ');

  return `Detected ${itemCount} item(s) using ${method} with ${avgConfidence}% average confidence: ${items}`;
}

/**
 * Check if user approval is needed for VLM fallback cost
 */
export function requiresUserApproval(estimatedCostUsd: number, remainingBudget: number): {
  required: boolean;
  reason?: string;
} {
  // Always require approval if cost would exceed remaining budget
  if (estimatedCostUsd > remainingBudget) {
    return {
      required: true,
      reason: `Cost $${estimatedCostUsd.toFixed(2)} exceeds remaining daily budget $${remainingBudget.toFixed(2)}`
    };
  }

  // Require approval if cost is significant (>10% of daily budget $10)
  const significantCost = 1.0; // $1.00
  if (estimatedCostUsd >= significantCost) {
    return {
      required: true,
      reason: `Cost $${estimatedCostUsd.toFixed(2)} requires approval`
    };
  }

  return { required: false };
}