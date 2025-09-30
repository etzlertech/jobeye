/**
 * @file voice-narration.service.test.ts
 * @purpose Unit tests for voice narration service
 * @coverage_target ≥90%
 */

import { VoiceNarrationService } from '../../services/voice-narration.service';

describe('VoiceNarrationService', () => {
  let service: VoiceNarrationService;

  beforeEach(() => {
    service = new VoiceNarrationService();
  });

  describe('narrateResultText', () => {
    it('should generate positive narration for verified kit', () => {
      const result = {
        verified: true,
        detectedItems: [
          { label: 'mower', confidence: 0.95 },
          { label: 'trimmer', confidence: 0.92 },
          { label: 'blower', confidence: 0.88 }
        ],
        missingItems: [],
        confidence: 0.92
      };

      const narration = service.narrateResultText(result);

      expect(narration).toContain('verified');
      expect(narration).toContain('mower');
      expect(narration).toContain('trimmer');
      expect(narration).toContain('blower');
      expect(narration.toLowerCase()).not.toContain('missing');
    });

    it('should generate warning narration for incomplete kit', () => {
      const result = {
        verified: false,
        detectedItems: [
          { label: 'mower', confidence: 0.93 }
        ],
        missingItems: ['chainsaw', 'safety_harness'],
        confidence: 0.90
      };

      const narration = service.narrateResultText(result);

      expect(narration.toLowerCase()).toContain('missing');
      expect(narration).toContain('chainsaw');
      expect(narration).toContain('safety');
    });

    it('should handle empty detection list', () => {
      const result = {
        verified: false,
        detectedItems: [],
        missingItems: ['all_items'],
        confidence: 0.0
      };

      const narration = service.narrateResultText(result);

      expect(narration).toBeDefined();
      expect(narration.length).toBeGreaterThan(0);
    });

    it('should mention confidence level when low', () => {
      const result = {
        verified: true,
        detectedItems: [
          { label: 'mower', confidence: 0.65 }
        ],
        missingItems: [],
        confidence: 0.65
      };

      const narration = service.narrateResultText(result);

      expect(narration.toLowerCase()).toMatch(/confidence|uncertain|may need/);
    });
  });

  describe('narrateDetectedItem', () => {
    it('should narrate high-confidence detection', () => {
      const item = { label: 'lawn_mower', confidence: 0.95 };

      const narration = service.narrateDetectedItem(item);

      expect(narration).toContain('lawn mower');
      expect(narration.toLowerCase()).not.toContain('unsure');
    });

    it('should narrate low-confidence detection with uncertainty', () => {
      const item = { label: 'trimmer', confidence: 0.62 };

      const narration = service.narrateDetectedItem(item);

      expect(narration).toContain('trimmer');
      expect(narration.toLowerCase()).toMatch(/might|possibly|appears/);
    });

    it('should format underscored labels properly', () => {
      const item = { label: 'safety_harness', confidence: 0.90 };

      const narration = service.narrateDetectedItem(item);

      expect(narration).toContain('safety harness');
      expect(narration).not.toContain('_');
    });
  });

  describe('narrateMissingItems', () => {
    it('should list all missing items', () => {
      const missingItems = ['chainsaw', 'safety_harness', 'fuel_can'];

      const narration = service.narrateMissingItems(missingItems);

      expect(narration).toContain('chainsaw');
      expect(narration).toContain('safety harness');
      expect(narration).toContain('fuel can');
    });

    it('should return empty for no missing items', () => {
      const narration = service.narrateMissingItems([]);

      expect(narration).toBe('');
    });

    it('should handle single missing item', () => {
      const narration = service.narrateMissingItems(['chainsaw']);

      expect(narration).toContain('chainsaw');
      expect(narration.toLowerCase()).toMatch(/missing|not found/);
    });
  });

  describe('narrateCostWarning', () => {
    it('should warn when cost exceeds budget', () => {
      const narration = service.narrateCostWarning(12.50, 10.00);

      expect(narration.toLowerCase()).toContain('budget');
      expect(narration).toContain('12');
      expect(narration).toContain('10');
    });

    it('should not warn when under budget', () => {
      const narration = service.narrateCostWarning(7.50, 10.00);

      expect(narration).toBe('');
    });

    it('should handle exact budget match', () => {
      const narration = service.narrateCostWarning(10.00, 10.00);

      expect(narration.toLowerCase()).toMatch(/budget|limit/);
    });
  });
});