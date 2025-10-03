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
  tenantId: string;
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

/**
 * VLM Fallback Router Class
 * Determines when to fallback from YOLO to cloud VLM
 */
export class VLMFallbackRouter {
  constructor(private costEstimator: any) {}

  /**
   * Determine if should fallback to VLM based on detections
   */
  shouldFallback(
    detections: Array<{ label: string; confidence: number; boundingBox: any }>,
    options: {
      threshold?: number;
      maxObjects?: number;
      expectedItems?: string[];
      caseInsensitive?: boolean;
      fuzzyMatch?: boolean;
      currentSpend?: number;
      dailyBudget?: number;
      estimateOnly?: boolean;
    } = {}
  ): {
    shouldFallback: boolean;
    reason?: string;
    reasons?: string[];
    lowConfidenceItems?: string[];
    missingItems?: string[];
    objectCount?: number;
    budgetExceeded?: boolean;
    estimatedCost?: number;
  } {
    const {
      threshold = 0.70,
      maxObjects = 20,
      expectedItems = [],
      caseInsensitive = false,
      fuzzyMatch = false,
      currentSpend = 0,
      dailyBudget = 10.00,
      estimateOnly = false
    } = options;

    const result: any = {
      shouldFallback: false,
      reasons: [],
      budgetExceeded: false // Explicitly track budget status
    };

    // 1. Check budget first (blocking condition)
    if (currentSpend >= dailyBudget) {
      result.budgetExceeded = true;
      result.shouldFallback = false; // Can't use VLM if over budget
      return result;
    }

    // 2. Check confidence threshold
    const lowConfItems = detections.filter(d => d.confidence < threshold);
    if (lowConfItems.length > 0) {
      result.reasons.push('low_confidence');
      result.lowConfidenceItems = lowConfItems.map(d => d.label);
      result.shouldFallback = true;
    }

    // 3. Check object count
    if (detections.length > maxObjects) {
      result.reasons.push('too_many_objects');
      result.objectCount = detections.length;
      result.shouldFallback = true;
    }

    // 4. Check expected items
    if (expectedItems.length > 0) {
      const detectedLabels = detections.map(d => d.label);
      const missing: string[] = [];

      for (const expected of expectedItems) {
        let found = false;

        for (const detected of detectedLabels) {
          if (this.matchesLabel(detected, expected, { caseInsensitive, fuzzyMatch })) {
            found = true;
            break;
          }
        }

        if (!found) {
          missing.push(expected);
        }
      }

      if (missing.length > 0) {
        result.reasons.push('missing_expected');
        result.missingItems = missing;
        result.shouldFallback = true;
      }
    }

    // 5. Set primary reason (first one)
    if (result.reasons.length > 0) {
      result.reason = result.reasons[0];
    }

    // 6. Estimate cost
    if (result.shouldFallback || estimateOnly) {
      result.estimatedCost = this.estimateCost();
    }

    return result;
  }

  private matchesLabel(
    detected: string,
    expected: string,
    options: { caseInsensitive?: boolean; fuzzyMatch?: boolean }
  ): boolean {
    let d = detected;
    let e = expected;

    if (options.caseInsensitive) {
      d = d.toLowerCase();
      e = e.toLowerCase();
    }

    // Exact match
    if (d === e) return true;

    // Fuzzy match (contains)
    if (options.fuzzyMatch) {
      return d.includes(e) || e.includes(d);
    }

    return false;
  }

  private estimateCost(): number {
    // OpenAI GPT-4 Vision pricing
    return 0.10; // $0.10 per image
  }
}