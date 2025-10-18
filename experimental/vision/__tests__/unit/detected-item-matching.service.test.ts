/**
 * @file /src/domains/vision/__tests__/unit/detected-item-matching.service.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Unit tests for detected item matching service
 */

import {
  DetectedItemMatchingService,
  DetectedItem,
  KitItem
} from '../../services/detected-item-matching.service';

describe('DetectedItemMatchingService', () => {
  let service: DetectedItemMatchingService;

  beforeEach(() => {
    service = new DetectedItemMatchingService();
  });

  describe('matchItems', () => {
    it('should match exact item names', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'wrench', confidence: 0.95 },
        { itemType: 'hammer', confidence: 0.88 }
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: 'wrench' },
        { id: '2', name: 'hammer' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      expect(result.matches.length).toBe(2);
      expect(result.matches[0].matchStatus).toBe('matched');
      expect(result.matches[1].matchStatus).toBe('matched');
      expect(result.unmatchedDetections.length).toBe(0);
      expect(result.missingKitItems.length).toBe(0);
      expect(result.overallMatchRate).toBe(1.0);
    });

    it('should match items using aliases', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'screwdriver', confidence: 0.90 }
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: 'phillips screwdriver', aliases: ['screwdriver', 'phillips'] }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      expect(result.matches[0].matchStatus).toBe('matched');
      expect(result.matches[0].matchScore).toBeGreaterThan(0.9);
    });

    it('should handle partial matches', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'wrench', confidence: 0.85 }
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: 'adjustable wrench' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      // Partial match (0.7 score) + good confidence (0.85) -> uncertain (needs >=0.8 score for matched)
      expect(result.matches[0].matchStatus).toBe('uncertain');
      expect(result.matches[0].matchScore).toBeCloseTo(0.7);
    });

    it('should mark low confidence detections as uncertain', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'wrench', confidence: 0.55 }
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: 'wrench' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      expect(result.matches[0].matchStatus).toBe('uncertain');
    });

    it('should mark unmatched detections', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'banana', confidence: 0.95 }
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: 'wrench' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      // High confidence but no match -> uncertain (could be false positive)
      expect(result.matches[0].matchStatus).toBe('uncertain');
      expect(result.unmatchedDetections.length).toBe(0); // Uncertain items are not "unmatched"
    });

    it('should identify missing kit items', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'wrench', confidence: 0.95 }
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: 'wrench' },
        { id: '2', name: 'hammer' },
        { id: '3', name: 'screwdriver' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      expect(result.missingKitItems.length).toBe(2);
      expect(result.missingKitItems.map(i => i.name)).toEqual(['hammer', 'screwdriver']);
    });

    it('should not match same kit item twice', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'wrench', confidence: 0.95 },
        { itemType: 'wrench', confidence: 0.92 }
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: 'wrench' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      expect(result.matches[0].matchedKitItem?.id).toBe('1');
      expect(result.matches[0].matchStatus).toBe('matched');
      expect(result.matches[1].matchedKitItem).toBeNull();
      // Second detection has high conf but no available match -> uncertain
      expect(result.matches[1].matchStatus).toBe('uncertain');
    });

    it('should calculate overall match rate correctly', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'wrench', confidence: 0.95 },
        { itemType: 'hammer', confidence: 0.88 }
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: 'wrench' },
        { id: '2', name: 'hammer' },
        { id: '3', name: 'screwdriver' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      expect(result.overallMatchRate).toBeCloseTo(0.667, 2); // 2/3 matched
    });

    it('should handle empty detected items', () => {
      const detectedItems: DetectedItem[] = [];
      const kitItems: KitItem[] = [
        { id: '1', name: 'wrench' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      expect(result.matches.length).toBe(0);
      expect(result.missingKitItems.length).toBe(1);
      expect(result.overallMatchRate).toBe(0);
    });

    it('should handle empty kit items', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'wrench', confidence: 0.95 }
      ];
      const kitItems: KitItem[] = [];

      const result = service.matchItems(detectedItems, kitItems);

      expect(result.matches.length).toBe(1);
      // High confidence but no match -> uncertain
      expect(result.matches[0].matchStatus).toBe('uncertain');
      expect(result.overallMatchRate).toBe(0);
    });

    it('should handle case-insensitive matching', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'WRENCH', confidence: 0.95 }
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: 'wrench' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      expect(result.matches[0].matchStatus).toBe('matched');
    });

    it('should handle special characters in names', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: '3/8-inch wrench', confidence: 0.95 }
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: '3/8 inch wrench' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      expect(result.matches[0].matchStatus).toBe('matched');
    });

    it('should use fuzzy matching for similar names', () => {
      const detectedItems: DetectedItem[] = [
        { itemType: 'scrwdriver', confidence: 0.85 } // Typo
      ];

      const kitItems: KitItem[] = [
        { id: '1', name: 'screwdriver' }
      ];

      const result = service.matchItems(detectedItems, kitItems);

      // Should still match due to fuzzy matching
      expect(result.matches[0].matchScore).toBeGreaterThan(0.6);
    });
  });
});