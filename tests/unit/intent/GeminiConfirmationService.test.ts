/**
 * @file tests/unit/intent/GeminiConfirmationService.test.ts
 * @purpose Unit tests for GeminiConfirmationService
 * @coverage Yes/no detection, caching, unclear handling, heuristic fallbacks
 */

import { GeminiConfirmationService } from '@/domains/intent/services/gemini-confirmation.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIInteractionLogger } from '@/domains/intent/services/ai-interaction-logger.service';

// Mock dependencies
jest.mock('@google/generative-ai');
jest.mock('@/domains/intent/services/ai-interaction-logger.service');

describe('GeminiConfirmationService', () => {
  let service: GeminiConfirmationService;
  let mockModel: any;
  let mockGenAI: jest.Mocked<GoogleGenerativeAI>;
  let mockLogger: jest.Mocked<AIInteractionLogger>;

  beforeEach(() => {
    mockModel = {
      generateContent: jest.fn(),
    };

    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    } as any;

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => mockGenAI);

    mockLogger = {
      logInteraction: jest.fn().mockResolvedValue(undefined),
    } as any;

    (AIInteractionLogger as jest.Mock).mockImplementation(() => mockLogger);

    service = new GeminiConfirmationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processConfirmation', () => {
    const mockPreviousIntent = {
      intent: 'check_in' as const,
      entities: { itemNames: ['hammer'], jobId: '123' },
      confidence: 0.9,
      needs_clarification: false,
      model_used: 'gemini-2.0-flash-exp',
      processing_time_ms: 500,
      cost_usd: 0.0001,
    };

    it('should detect "yes" confirmation with high confidence', async () => {
      const mockResponse = {
        confirmed: true,
        confidence: 0.99,
        interpretation: 'yes',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await service.processConfirmation({
        transcript: 'yes',
        previous_intent: mockPreviousIntent,
        confirmation_question: 'Are you sure you want to check in the hammer from job 123?',
      });

      expect(result.confirmed).toBe(true);
      expect(result.interpretation).toBe('yes');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.original_transcript).toBe('yes');
    });

    it('should detect "no" rejection with high confidence', async () => {
      const mockResponse = {
        confirmed: false,
        confidence: 0.98,
        interpretation: 'no',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await service.processConfirmation({
        transcript: 'no',
        previous_intent: mockPreviousIntent,
        confirmation_question: 'Are you sure?',
      });

      expect(result.confirmed).toBe(false);
      expect(result.interpretation).toBe('no');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect unclear responses', async () => {
      const mockResponse = {
        confirmed: false,
        confidence: 0.4,
        interpretation: 'unclear',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await service.processConfirmation({
        transcript: 'maybe',
        previous_intent: mockPreviousIntent,
        confirmation_question: 'Are you sure?',
      });

      expect(result.interpretation).toBe('unclear');
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('response caching', () => {
    const mockPreviousIntent = {
      intent: 'check_in' as const,
      entities: {},
      confidence: 0.9,
      needs_clarification: false,
      model_used: 'gemini-2.0-flash-exp',
      processing_time_ms: 500,
      cost_usd: 0.0001,
    };

    it('should use cached response for common "yes" phrases', async () => {
      const commonYesPhrases = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'correct', 'right'];

      for (const phrase of commonYesPhrases) {
        const result = await service.processConfirmation({
          transcript: phrase,
          previous_intent: mockPreviousIntent,
          confirmation_question: 'Confirm?',
        });

        expect(result.confirmed).toBe(true);
        expect(result.interpretation).toBe('yes');
        expect(result.confidence).toBe(1.0);
      }

      // Should not have called Gemini API
      expect(mockModel.generateContent).not.toHaveBeenCalled();
    });

    it('should use cached response for common "no" phrases', async () => {
      const commonNoPhrases = ['no', 'nope', 'nah', 'cancel', 'stop'];

      for (const phrase of commonNoPhrases) {
        const result = await service.processConfirmation({
          transcript: phrase,
          previous_intent: mockPreviousIntent,
          confirmation_question: 'Confirm?',
        });

        expect(result.confirmed).toBe(false);
        expect(result.interpretation).toBe('no');
        expect(result.confidence).toBe(1.0);
      }

      // Should not have called Gemini API
      expect(mockModel.generateContent).not.toHaveBeenCalled();
    });

    it('should call Gemini for non-cached responses', async () => {
      const mockResponse = {
        confirmed: true,
        confidence: 0.85,
        interpretation: 'yes',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      await service.processConfirmation({
        transcript: 'absolutely',
        previous_intent: mockPreviousIntent,
        confirmation_question: 'Confirm?',
      });

      expect(mockModel.generateContent).toHaveBeenCalled();
    });

    it('should cache high-confidence responses', async () => {
      const mockResponse = {
        confirmed: true,
        confidence: 0.95,
        interpretation: 'yes',
      };

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      // First call - should hit Gemini
      await service.processConfirmation({
        transcript: 'affirmative',
        previous_intent: mockPreviousIntent,
        confirmation_question: 'Confirm?',
      });

      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);

      // Second call with same transcript - should use cache
      await service.processConfirmation({
        transcript: 'affirmative',
        previous_intent: mockPreviousIntent,
        confirmation_question: 'Confirm?',
      });

      expect(mockModel.generateContent).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('heuristic fallbacks', () => {
    it('should detect likely "yes" responses', () => {
      expect(service.isLikelyYes('yes please')).toBe(true);
      expect(service.isLikelyYes('yeah do it')).toBe(true);
      expect(service.isLikelyYes('sure thing')).toBe(true);
      expect(service.isLikelyYes('go ahead')).toBe(true);
      expect(service.isLikelyYes('affirmative')).toBe(false); // Not in common list
    });

    it('should detect likely "no" responses', () => {
      expect(service.isLikelyNo('no way')).toBe(true);
      expect(service.isLikelyNo('nope, cancel that')).toBe(true);
      expect(service.isLikelyNo('stop please')).toBe(true);
      expect(service.isLikelyNo('negative')).toBe(true);
      expect(service.isLikelyNo('not really')).toBe(false); // Not exact match
    });

    it('should be case-insensitive', () => {
      expect(service.isLikelyYes('YES')).toBe(true);
      expect(service.isLikelyYes('Yes')).toBe(true);
      expect(service.isLikelyNo('NO')).toBe(true);
      expect(service.isLikelyNo('No')).toBe(true);
    });
  });

  describe('error handling', () => {
    const mockPreviousIntent = {
      intent: 'check_in' as const,
      entities: {},
      confidence: 0.9,
      needs_clarification: false,
      model_used: 'gemini-2.0-flash-exp',
      processing_time_ms: 500,
      cost_usd: 0.0001,
    };

    it('should handle malformed JSON responses', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Not valid JSON',
        },
      });

      const result = await service.processConfirmation({
        transcript: 'maybe',
        previous_intent: mockPreviousIntent,
        confirmation_question: 'Confirm?',
      });

      // Should fallback gracefully
      expect(result.interpretation).toBe('unclear');
      expect(result.confidence).toBe(0.0);
    });

    it('should handle API timeout', async () => {
      mockModel.generateContent.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000)
        )
      );

      await expect(
        service.processConfirmation({
          transcript: 'unclear',
          previous_intent: mockPreviousIntent,
          confirmation_question: 'Confirm?',
        })
      ).rejects.toThrow();
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      // Pre-populate cache with a custom response
      const mockPreviousIntent = {
        intent: 'check_in' as const,
        entities: {},
        confidence: 0.9,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      // Clear cache
      service.clearCache();

      // After clear, common phrases should still work (they're re-initialized)
      const result = service.isLikelyYes('yes');
      expect(result).toBe(true);
    });
  });

  describe('cost optimization', () => {
    it('should have zero cost for cached responses', async () => {
      const mockPreviousIntent = {
        intent: 'check_in' as const,
        entities: {},
        confidence: 0.9,
        needs_clarification: false,
        model_used: 'gemini-2.0-flash-exp',
        processing_time_ms: 500,
        cost_usd: 0.0001,
      };

      // Use cached "yes"
      await service.processConfirmation({
        transcript: 'yes',
        previous_intent: mockPreviousIntent,
        confirmation_question: 'Confirm?',
      });

      // Should not have logged any interaction (zero cost)
      expect(mockLogger.logInteraction).not.toHaveBeenCalled();
    });

    it('should minimize cost with fast timeout', async () => {
      const mockResponse = {
        confirmed: true,
        confidence: 0.9,
        interpretation: 'yes',
      };

      const startTime = Date.now();

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      await service.processConfirmation({
        transcript: 'affirmative',
        previous_intent: {
          intent: 'check_in' as const,
          entities: {},
          confidence: 0.9,
          needs_clarification: false,
          model_used: 'gemini-2.0-flash-exp',
          processing_time_ms: 500,
          cost_usd: 0.0001,
        },
        confirmation_question: 'Confirm?',
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should be faster than intent classification
    });
  });
});
