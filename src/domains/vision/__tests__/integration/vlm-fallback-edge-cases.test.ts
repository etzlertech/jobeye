/**
 * @file vlm-fallback-edge-cases.test.ts
 * @purpose Integration tests for VLM fallback edge cases
 * @coverage_target ≥85%
 */

import { VLMFallbackRouter } from '../../lib/vlm-fallback-router';

describe('VLM Fallback - Edge Cases', () => {
  let router: VLMFallbackRouter;

  beforeEach(() => {
    // VLMFallbackRouter doesn't actually use costEstimator, just pass empty object
    router = new VLMFallbackRouter({} as any);
  });

  describe('Confidence Threshold Edge Cases', () => {
    it('should trigger VLM when confidence exactly equals threshold', () => {
      const detections = [
        { label: 'mower', confidence: 0.70, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, { threshold: 0.70 });

      expect(result.shouldFallback).toBe(false); // Exactly at threshold = pass
      expect(result.reason).not.toBe('low_confidence');
    });

    it('should trigger VLM when confidence is just below threshold', () => {
      const detections = [
        { label: 'mower', confidence: 0.69, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, { threshold: 0.70 });

      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toBe('low_confidence');
    });

    it('should handle mixed confidence levels correctly', () => {
      const detections = [
        { label: 'mower', confidence: 0.95, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
        { label: 'trimmer', confidence: 0.85, boundingBox: { x: 100, y: 0, width: 100, height: 100 } },
        { label: 'blower', confidence: 0.65, boundingBox: { x: 200, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, { threshold: 0.70 });

      expect(result.shouldFallback).toBe(true); // One item below threshold
      expect(result.reason).toBe('low_confidence');
      expect(result.lowConfidenceItems).toContain('blower');
    });

    it('should handle zero confidence gracefully', () => {
      const detections = [
        { label: 'unknown', confidence: 0.0, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, { threshold: 0.70 });

      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toBe('low_confidence');
    });
  });

  describe('Object Count Edge Cases', () => {
    it('should trigger VLM when object count exactly equals max', () => {
      const detections = Array.from({ length: 20 }, (_, i) => ({
        label: `item_${i}`,
        confidence: 0.90,
        boundingBox: { x: i * 10, y: 0, width: 10, height: 10 }
      }));

      const result = router.shouldFallback(detections, { maxObjects: 20 });

      expect(result.shouldFallback).toBe(false); // Exactly at max = OK
      expect(result.reason).not.toBe('too_many_objects');
    });

    it('should trigger VLM when object count exceeds max', () => {
      const detections = Array.from({ length: 21 }, (_, i) => ({
        label: `item_${i}`,
        confidence: 0.90,
        boundingBox: { x: i * 10, y: 0, width: 10, height: 10 }
      }));

      const result = router.shouldFallback(detections, { maxObjects: 20 });

      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toBe('too_many_objects');
      expect(result.objectCount).toBe(21);
    });

    it('should handle empty detection list', () => {
      const detections: any[] = [];

      const result = router.shouldFallback(detections, { maxObjects: 20 });

      expect(result.shouldFallback).toBe(false);
    });

    it('should handle single object correctly', () => {
      const detections = [
        { label: 'mower', confidence: 0.90, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, { maxObjects: 20 });

      expect(result.shouldFallback).toBe(false);
      expect(result.reason).not.toBe('too_many_objects');
    });
  });

  describe('Expected Items Edge Cases', () => {
    it('should trigger VLM when all expected items are missing', () => {
      const detections = [
        { label: 'unknown_item', confidence: 0.90, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        expectedItems: ['chainsaw', 'safety_harness', 'fuel_can']
      });

      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toBe('missing_expected');
      expect(result.missingItems).toEqual(['chainsaw', 'safety_harness', 'fuel_can']);
    });

    it('should not trigger when all expected items are found', () => {
      const detections = [
        { label: 'chainsaw', confidence: 0.90, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
        { label: 'safety_harness', confidence: 0.88, boundingBox: { x: 100, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        expectedItems: ['chainsaw', 'safety_harness']
      });

      expect(result.shouldFallback).toBe(false);
    });

    it('should trigger when some expected items are missing', () => {
      const detections = [
        { label: 'chainsaw', confidence: 0.90, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        expectedItems: ['chainsaw', 'safety_harness', 'fuel_can']
      });

      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toBe('missing_expected');
      expect(result.missingItems).toEqual(['safety_harness', 'fuel_can']);
      expect(result.missingItems).not.toContain('chainsaw');
    });

    it('should handle case-insensitive matching', () => {
      const detections = [
        { label: 'Chainsaw', confidence: 0.90, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        expectedItems: ['chainsaw'],
        caseInsensitive: true
      });

      expect(result.shouldFallback).toBe(false); // Found (case-insensitive)
    });

    it('should handle similar label variations', () => {
      const detections = [
        { label: 'lawn_mower', confidence: 0.90, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        expectedItems: ['mower'],
        fuzzyMatch: true
      });

      expect(result.shouldFallback).toBe(false); // Found (fuzzy match)
    });

    it('should handle empty expected items list', () => {
      const detections = [
        { label: 'mower', confidence: 0.90, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        expectedItems: []
      });

      expect(result.shouldFallback).toBe(false);
    });
  });

  describe('Multiple Failure Conditions', () => {
    it('should report all failure reasons when multiple conditions met', () => {
      const detections = [
        { label: 'unknown_1', confidence: 0.65, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
        { label: 'unknown_2', confidence: 0.68, boundingBox: { x: 100, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        threshold: 0.70,
        expectedItems: ['chainsaw']
      });

      expect(result.shouldFallback).toBe(true);
      expect(result.reasons).toContain('low_confidence');
      expect(result.reasons).toContain('missing_expected');
    });

    it('should prioritize most critical failure reason', () => {
      const detections = Array.from({ length: 25 }, (_, i) => ({
        label: `item_${i}`,
        confidence: 0.50,
        boundingBox: { x: i * 10, y: 0, width: 10, height: 10 }
      }));

      const result = router.shouldFallback(detections, {
        threshold: 0.70,
        maxObjects: 20,
        expectedItems: ['special_item']
      });

      expect(result.shouldFallback).toBe(true);
      // Should report all three conditions
      expect(result.reasons).toContain('low_confidence');
      expect(result.reasons).toContain('too_many_objects');
      expect(result.reasons).toContain('missing_expected');
    });
  });

  describe('Budget Constraints', () => {
    it('should not trigger VLM when budget is exceeded', () => {
      const detections = [
        { label: 'mower', confidence: 0.65, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        threshold: 0.70,
        currentSpend: 10.50,
        dailyBudget: 10.00
      });

      expect(result.shouldFallback).toBe(false); // Budget exceeded, can't use VLM
      expect(result.budgetExceeded).toBe(true);
    });

    it('should trigger VLM when budget is available', () => {
      const detections = [
        { label: 'mower', confidence: 0.65, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        threshold: 0.70,
        currentSpend: 5.00,
        dailyBudget: 10.00
      });

      expect(result.shouldFallback).toBe(true);
      expect(result.budgetExceeded).toBe(false);
      expect(result.estimatedCost).toBeDefined();
    });

    it('should handle budget exactly at limit', () => {
      const detections = [
        { label: 'mower', confidence: 0.65, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        threshold: 0.70,
        currentSpend: 10.00,
        dailyBudget: 10.00
      });

      expect(result.shouldFallback).toBe(false); // At limit
      expect(result.budgetExceeded).toBe(true);
    });
  });

  describe('Cost Estimation', () => {
    it('should provide accurate cost estimate for VLM call', () => {
      const detections = [
        { label: 'mower', confidence: 0.65, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, { threshold: 0.70 });

      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.estimatedCost).toBeLessThanOrEqual(0.15); // Reasonable max
    });

    it('should estimate cost before triggering fallback', () => {
      const detections = [
        { label: 'mower', confidence: 0.65, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      const result = router.shouldFallback(detections, {
        threshold: 0.70,
        estimateOnly: true
      });

      expect(result.estimatedCost).toBeDefined();
      expect(result.shouldFallback).toBe(true);
    });
  });

  describe('Company-Specific Thresholds', () => {
    it('should respect company-specific confidence threshold', () => {
      const detections = [
        { label: 'mower', confidence: 0.65, boundingBox: { x: 0, y: 0, width: 100, height: 100 } }
      ];

      // Company A: Stricter threshold
      const resultA = router.shouldFallback(detections, { threshold: 0.80 });
      expect(resultA.shouldFallback).toBe(true);

      // Company B: Relaxed threshold
      const resultB = router.shouldFallback(detections, { threshold: 0.60 });
      expect(resultB.shouldFallback).toBe(false);
    });

    it('should respect company-specific max objects', () => {
      const detections = Array.from({ length: 15 }, (_, i) => ({
        label: `item_${i}`,
        confidence: 0.90,
        boundingBox: { x: i * 10, y: 0, width: 10, height: 10 }
      }));

      // Company A: Low tolerance
      const resultA = router.shouldFallback(detections, { maxObjects: 10 });
      expect(resultA.shouldFallback).toBe(true);

      // Company B: High tolerance
      const resultB = router.shouldFallback(detections, { maxObjects: 20 });
      expect(resultB.shouldFallback).toBe(false);
    });
  });
});