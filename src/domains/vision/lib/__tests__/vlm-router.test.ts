/**
 * @file /src/domains/vision/lib/__tests__/vlm-router.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Unit tests for VLM fallback router decision logic
 */

import {
  evaluateFallbackNeed,
  combineDetectionResults,
  createYoloOnlyResult,
  formatDetectionSummary,
  requiresUserApproval,
  CONFIDENCE_THRESHOLD
} from '../vlm-fallback-router';
import { YoloInferenceResult } from '../yolo-inference';
import { VlmResult } from '../vlm-fallback-router';

describe('VLM Fallback Router', () => {
  describe('evaluateFallbackNeed', () => {
    it('should NOT trigger fallback when all detections are above threshold', () => {
      const yoloResult: YoloInferenceResult = {
        detections: [
          { itemType: 'wrench', confidence: 0.85, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 0 },
          { itemType: 'hammer', confidence: 0.92, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 1 }
        ],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      };

      const decision = evaluateFallbackNeed(yoloResult, 2, 0.10);

      expect(decision.shouldUseFallback).toBe(false);
      expect(decision.reason).toContain('above 70% confidence');
      expect(decision.yoloConfidence).toBeCloseTo(0.885);
      expect(decision.detectionCount).toBe(2);
      expect(decision.missingItemsCount).toBe(0);
    });

    it('should trigger fallback when detection confidence is below threshold', () => {
      const yoloResult: YoloInferenceResult = {
        detections: [
          { itemType: 'wrench', confidence: 0.65, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 0 },
          { itemType: 'hammer', confidence: 0.92, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 1 }
        ],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      };

      const decision = evaluateFallbackNeed(yoloResult, 2, 0.10);

      expect(decision.shouldUseFallback).toBe(true);
      expect(decision.reason).toContain('below 70% confidence');
      expect(decision.yoloConfidence).toBeCloseTo(0.785);
    });

    it('should trigger fallback when expected items are missing', () => {
      const yoloResult: YoloInferenceResult = {
        detections: [
          { itemType: 'wrench', confidence: 0.85, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 0 }
        ],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      };

      const decision = evaluateFallbackNeed(yoloResult, 3, 0.10);

      expect(decision.shouldUseFallback).toBe(true);
      expect(decision.reason).toContain('Missing 2 expected item');
      expect(decision.missingItemsCount).toBe(2);
    });

    it('should trigger fallback when no items detected but items expected', () => {
      const yoloResult: YoloInferenceResult = {
        detections: [],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      };

      const decision = evaluateFallbackNeed(yoloResult, 3, 0.10);

      expect(decision.shouldUseFallback).toBe(true);
      expect(decision.reason).toContain('Missing 3 expected item');
    });

    it('should include estimated cost in decision', () => {
      const yoloResult: YoloInferenceResult = {
        detections: [],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      };

      const estimatedCost = 0.15;
      const decision = evaluateFallbackNeed(yoloResult, 2, estimatedCost);

      expect(decision.estimatedCostUsd).toBe(estimatedCost);
    });
  });

  describe('combineDetectionResults', () => {
    it('should merge YOLO and VLM detections with higher confidence', () => {
      const yoloResult: YoloInferenceResult = {
        detections: [
          { itemType: 'wrench', confidence: 0.65, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 0 },
          { itemType: 'hammer', confidence: 0.85, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 1 }
        ],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      };

      const vlmResult: VlmResult = {
        detections: [
          { itemType: 'wrench', confidence: 0.90, reasoning: 'Clear view', matchedExpectedItem: 'wrench' },
          { itemType: 'screwdriver', confidence: 0.80, reasoning: 'Visible handle', matchedExpectedItem: 'screwdriver' }
        ],
        processingTimeMs: 2000,
        estimatedCostUsd: 0.10,
        provider: 'openai-gpt4-vision',
        modelVersion: 'gpt-4-vision-preview'
      };

      const combined = combineDetectionResults(yoloResult, vlmResult);

      expect(combined.method).toBe('cloud_vlm');
      expect(combined.detections.length).toBe(3);

      // Wrench should have VLM confidence (higher)
      const wrench = combined.detections.find(d => d.itemType === 'wrench');
      expect(wrench?.confidence).toBeCloseTo(0.90);

      // Hammer should have YOLO confidence (only source)
      const hammer = combined.detections.find(d => d.itemType === 'hammer');
      expect(hammer?.confidence).toBeCloseTo(0.85);
      expect(hammer?.source).toBe('yolo');

      // Screwdriver should have VLM confidence (only source)
      const screwdriver = combined.detections.find(d => d.itemType === 'screwdriver');
      expect(screwdriver?.confidence).toBeCloseTo(0.80);
      expect(screwdriver?.source).toBe('vlm');

      // Cost should be VLM cost
      expect(combined.costUsd).toBe(0.10);

      // Processing time should be sum
      expect(combined.processingTimeMs).toBe(2500);
    });

    it('should handle case-insensitive item matching', () => {
      const yoloResult: YoloInferenceResult = {
        detections: [
          { itemType: 'Wrench', confidence: 0.85, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 0 }
        ],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      };

      const vlmResult: VlmResult = {
        detections: [
          { itemType: 'wrench', confidence: 0.90, reasoning: 'Clear view', matchedExpectedItem: 'wrench' }
        ],
        processingTimeMs: 2000,
        estimatedCostUsd: 0.10,
        provider: 'openai-gpt4-vision',
        modelVersion: 'gpt-4-vision-preview'
      };

      const combined = combineDetectionResults(yoloResult, vlmResult);

      // Should merge as one item despite case difference
      expect(combined.detections.length).toBe(1);
      expect(combined.detections[0].confidence).toBeCloseTo(0.90);
    });
  });

  describe('createYoloOnlyResult', () => {
    it('should create result from YOLO detections', () => {
      const yoloResult: YoloInferenceResult = {
        detections: [
          { itemType: 'wrench', confidence: 0.85, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 0 },
          { itemType: 'hammer', confidence: 0.92, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 1 }
        ],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      };

      const result = createYoloOnlyResult(yoloResult);

      expect(result.method).toBe('local_yolo');
      expect(result.detections.length).toBe(2);
      expect(result.costUsd).toBe(0);
      expect(result.processingTimeMs).toBe(500);

      const avgConfidence = (0.85 + 0.92) / 2;
      expect(result.totalConfidence).toBeCloseTo(avgConfidence);

      expect(result.detections[0].source).toBe('yolo');
      expect(result.detections[1].source).toBe('yolo');
    });

    it('should handle empty YOLO result', () => {
      const yoloResult: YoloInferenceResult = {
        detections: [],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      };

      const result = createYoloOnlyResult(yoloResult);

      expect(result.method).toBe('local_yolo');
      expect(result.detections.length).toBe(0);
      expect(result.totalConfidence).toBe(0);
      expect(result.costUsd).toBe(0);
    });
  });

  describe('formatDetectionSummary', () => {
    it('should format YOLO-only result for voice', () => {
      const result = {
        method: 'local_yolo' as const,
        detections: [
          { itemType: 'wrench', confidence: 0.85, source: 'yolo' as const },
          { itemType: 'hammer', confidence: 0.92, source: 'yolo' as const }
        ],
        totalConfidence: 0.885,
        processingTimeMs: 500,
        costUsd: 0
      };

      const summary = formatDetectionSummary(result);

      expect(summary).toContain('Detected 2 item(s)');
      expect(summary).toContain('local detection');
      expect(summary).toContain('89% average confidence');
      expect(summary).toContain('wrench (85%)');
      expect(summary).toContain('hammer (92%)');
    });

    it('should format VLM result for voice', () => {
      const result = {
        method: 'cloud_vlm' as const,
        detections: [
          { itemType: 'wrench', confidence: 0.90, source: 'vlm' as const }
        ],
        totalConfidence: 0.90,
        processingTimeMs: 2500,
        costUsd: 0.10
      };

      const summary = formatDetectionSummary(result);

      expect(summary).toContain('Detected 1 item(s)');
      expect(summary).toContain('cloud verification');
      expect(summary).toContain('90% average confidence');
    });

    it('should handle zero detections', () => {
      const result = {
        method: 'local_yolo' as const,
        detections: [],
        totalConfidence: 0,
        processingTimeMs: 500,
        costUsd: 0
      };

      const summary = formatDetectionSummary(result);

      expect(summary).toContain('No items detected');
      expect(summary).toContain('local detection');
    });
  });

  describe('requiresUserApproval', () => {
    it('should require approval when cost exceeds remaining budget', () => {
      const approval = requiresUserApproval(0.15, 0.10);

      expect(approval.required).toBe(true);
      expect(approval.reason).toContain('exceeds remaining daily budget');
    });

    it('should require approval for significant cost (>$1)', () => {
      const approval = requiresUserApproval(1.50, 5.00);

      expect(approval.required).toBe(true);
      expect(approval.reason).toContain('requires approval');
    });

    it('should NOT require approval for small costs within budget', () => {
      const approval = requiresUserApproval(0.10, 5.00);

      expect(approval.required).toBe(false);
      expect(approval.reason).toBeUndefined();
    });

    it('should require approval at $1 threshold', () => {
      const approval = requiresUserApproval(1.00, 5.00);

      expect(approval.required).toBe(true);
    });
  });
});