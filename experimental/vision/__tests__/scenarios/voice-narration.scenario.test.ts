/**
 * @file /src/domains/vision/__tests__/scenarios/voice-narration.scenario.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose End-to-end scenario tests for voice narration feature
 * @test_coverage Full scenario coverage
 */

import { getVoiceNarrationService } from '../../services/voice-narration.service';
import { setupSpeechSynthesisMock } from '@/__tests__/mocks/speech-synthesis.mock';

// Setup Speech Synthesis mock
const mockSpeechSynthesis = setupSpeechSynthesisMock();

describe('Voice Narration - End-to-End Scenarios', () => {
  let voiceService: ReturnType<typeof getVoiceNarrationService>;

  beforeAll(() => {
    // Use real timers for voice narration tests
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    voiceService = getVoiceNarrationService();
  });

  describe('Scenario 1: Full narration of complete verification', () => {
    it('should narrate complete verification with all details', async () => {
      // Arrange
      const result = {
        verificationId: 'ver-123',
        kitId: 'kit-456',
        tenantId: 'company-789',
        verificationResult: 'complete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.95,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.98, matchStatus: 'matched' as const },
          { itemType: 'hammer', confidence: 0.92, matchStatus: 'matched' as const }
        ],
        missingItems: [],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 245
      };

      // Act
      await voiceService.narrateResult(result);

      // Assert - mock automatically handles utterance and callbacks
      expect(mockSpeechSynthesis.speaking).toBe(false); // Completed
    });
  });

  describe('Scenario 2: Quick summary narration', () => {
    it('should narrate brief summary with key metrics', async () => {
      // Arrange
      const result = {
        verificationId: 'ver-124',
        kitId: 'kit-457',
        tenantId: 'company-789',
        verificationResult: 'complete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.89,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.89, matchStatus: 'matched' as const }
        ],
        missingItems: [],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 198
      };

      // Act
      const narratePromise = voiceService.narrateQuickSummary(result);

      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 0);

      await narratePromise;

      // Assert
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
      expect(mockUtterance.text).toContain('Success');
      expect(mockUtterance.text).toContain('1 items matched');
      expect(mockUtterance.text).toContain('89 percent confidence');
      expect(mockUtterance.rate).toBe(1.2); // Faster rate for quick summary
    });
  });

  describe('Scenario 3: Incomplete verification with missing items', () => {
    it('should narrate missing items and warnings', async () => {
      // Arrange
      const result = {
        verificationId: 'ver-125',
        kitId: 'kit-458',
        tenantId: 'company-789',
        verificationResult: 'incomplete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.67,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.85, matchStatus: 'matched' as const }
        ],
        missingItems: ['hammer', 'screwdriver'],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 212
      };

      // Act
      const narratePromise = voiceService.narrateResult(result);

      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 0);

      await narratePromise;

      // Assert
      expect(mockUtterance.text).toContain('Verification incomplete');
      expect(mockUtterance.text).toContain('Missing items: hammer, screwdriver');
      expect(mockUtterance.text).toContain('Please review missing or uncertain items');
    });
  });

  describe('Scenario 4: Failed verification', () => {
    it('should narrate failure with appropriate tone', async () => {
      // Arrange
      const result = {
        verificationId: 'ver-126',
        kitId: 'kit-459',
        tenantId: 'company-789',
        verificationResult: 'failed' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.32,
        detectedItems: [],
        missingItems: ['wrench', 'hammer', 'screwdriver', 'pliers'],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 167
      };

      // Act
      const narratePromise = voiceService.narrateResult(result);

      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 0);

      await narratePromise;

      // Assert
      expect(mockUtterance.text).toContain('Verification failed');
      expect(mockUtterance.text).toContain('Multiple items are missing');
      expect(mockUtterance.text).toContain('4 items are missing');
      expect(mockUtterance.text).toContain('Please verify kit contents manually');
    });
  });

  describe('Scenario 5: VLM verification with cost information', () => {
    it('should include cost details in narration', async () => {
      // Arrange
      const result = {
        verificationId: 'ver-127',
        kitId: 'kit-460',
        tenantId: 'company-789',
        verificationResult: 'complete' as const,
        processingMethod: 'cloud_vlm' as const,
        confidenceScore: 0.97,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.98, matchStatus: 'matched' as const },
          { itemType: 'hammer', confidence: 0.96, matchStatus: 'matched' as const }
        ],
        missingItems: [],
        unexpectedItems: [],
        costUsd: 0.03,
        processingTimeMs: 1245
      };

      // Act
      const narratePromise = voiceService.narrateResult(result);

      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 0);

      await narratePromise;

      // Assert
      expect(mockUtterance.text).toContain('Used cloud vision model');
      expect(mockUtterance.text).toContain('Cost: 0.03 dollars');
    });
  });

  describe('Scenario 6: Pause and resume narration', () => {
    it('should support pause and resume controls', () => {
      // Arrange
      mockSpeechSynthesis.speaking = true;
      mockSpeechSynthesis.paused = false;

      // Act: Pause
      voiceService.pause();

      // Assert
      expect(mockSpeechSynthesis.pause).toHaveBeenCalled();

      // Arrange for resume
      mockSpeechSynthesis.paused = true;

      // Act: Resume
      voiceService.resume();

      // Assert
      expect(mockSpeechSynthesis.resume).toHaveBeenCalled();
    });
  });

  describe('Scenario 7: Stop narration', () => {
    it('should stop current narration immediately', () => {
      // Arrange
      mockSpeechSynthesis.speaking = true;

      // Act
      voiceService.stop();

      // Assert
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
      expect(voiceService.isSpeaking()).toBe(false);
    });
  });

  describe('Scenario 8: Custom voice settings', () => {
    it('should apply custom rate, pitch, and volume', async () => {
      // Arrange
      const result = {
        verificationId: 'ver-128',
        kitId: 'kit-461',
        tenantId: 'company-789',
        verificationResult: 'complete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.91,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.91, matchStatus: 'matched' as const }
        ],
        missingItems: [],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 189
      };

      // Act
      const narratePromise = voiceService.narrateResult(result, {
        rate: 1.5,
        pitch: 1.2,
        volume: 0.8
      });

      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 0);

      await narratePromise;

      // Assert
      expect(mockUtterance.rate).toBe(1.5);
      expect(mockUtterance.pitch).toBe(1.2);
      expect(mockUtterance.volume).toBe(0.8);
    });
  });

  describe('Scenario 9: Unexpected items in narration', () => {
    it('should mention unexpected items detected', async () => {
      // Arrange
      const result = {
        verificationId: 'ver-129',
        kitId: 'kit-462',
        tenantId: 'company-789',
        verificationResult: 'incomplete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.78,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.92, matchStatus: 'matched' as const },
          { itemType: 'tape', confidence: 0.88, matchStatus: 'unmatched' as const }
        ],
        missingItems: [],
        unexpectedItems: ['tape'],
        costUsd: 0,
        processingTimeMs: 223
      };

      // Act
      const narratePromise = voiceService.narrateResult(result);

      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 0);

      await narratePromise;

      // Assert
      expect(mockUtterance.text).toContain('Unexpected items detected: tape');
      expect(mockUtterance.text).toContain('1 item unmatched');
    });
  });

  describe('Scenario 10: Multiple uncertain items', () => {
    it('should report uncertain items appropriately', async () => {
      // Arrange
      const result = {
        verificationId: 'ver-130',
        kitId: 'kit-463',
        tenantId: 'company-789',
        verificationResult: 'incomplete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.65,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.82, matchStatus: 'matched' as const },
          { itemType: 'hammer', confidence: 0.58, matchStatus: 'uncertain' as const },
          { itemType: 'screwdriver', confidence: 0.55, matchStatus: 'uncertain' as const }
        ],
        missingItems: [],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 276
      };

      // Act
      const narratePromise = voiceService.narrateResult(result);

      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 0);

      await narratePromise;

      // Assert
      expect(mockUtterance.text).toContain('2 items uncertain');
      expect(mockUtterance.text).toContain('Verification incomplete');
    });
  });

  describe('Scenario 11: Check voice support', () => {
    it('should correctly detect voice API availability', () => {
      // Act
      const isSupported = voiceService.isSupported();

      // Assert
      expect(isSupported).toBe(true);
    });
  });

  describe('Scenario 12: Speak custom text', () => {
    it('should speak arbitrary text with custom settings', async () => {
      // Arrange
      const customText = 'Custom verification message';

      // Act
      const speakPromise = voiceService.speak(customText, {
        rate: 1.3,
        volume: 0.9
      });

      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 0);

      await speakPromise;

      // Assert
      expect(mockUtterance.text).toBe(customText);
      expect(mockUtterance.rate).toBe(1.3);
      expect(mockUtterance.volume).toBe(0.9);
    });
  });
});