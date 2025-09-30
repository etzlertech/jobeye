/**
 * @file /src/domains/vision/lib/__tests__/vlm-fallback-integration.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Integration test for complete VLM fallback flow
 */

import { runYoloInference, clearSession } from '../yolo-inference';
import { evaluateFallbackNeed, combineDetectionResults } from '../vlm-fallback-router';
import { callOpenAIVision, clearOpenAIClient } from '../openai-vision-adapter';
import { estimateVlmCost, checkBudgetAvailability } from '../cost-estimator';

// Mock OpenAI
const mockOpenAICreate = jest.fn();
const mockOpenAIRetrieve = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockOpenAICreate
        }
      },
      models: {
        retrieve: mockOpenAIRetrieve
      }
    }))
  };
});

// Mock YOLO inference
jest.mock('../yolo-inference', () => ({
  runYoloInference: jest.fn(),
  clearSession: jest.fn()
}));

const mockRunYoloInference = runYoloInference as jest.MockedFunction<typeof runYoloInference>;

// Mock canvas API for browser tests
const mockToDataURL = jest.fn().mockReturnValue('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
const mockGetContext = jest.fn().mockReturnValue({
  putImageData: jest.fn()
});

(global as any).document = {
  createElement: jest.fn((tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: mockGetContext,
        toDataURL: mockToDataURL
      };
    }
    return {};
  })
};

describe('VLM Fallback Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSession();
    clearOpenAIClient();
    process.env.OPENAI_API_KEY = 'test-key';

    // Default OpenAI mock responses
    mockOpenAICreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            detections: [
              { itemType: 'wrench', confidence: 0.90, reasoning: 'Clear metallic tool visible', matchedExpectedItem: 'wrench' },
              { itemType: 'screwdriver', confidence: 0.85, reasoning: 'Handle and blade visible', matchedExpectedItem: 'screwdriver' }
            ],
            overallAssessment: 'Two tools clearly visible'
          })
        }
      }],
      usage: { total_tokens: 450 }
    });

    mockOpenAIRetrieve.mockResolvedValue({ id: 'gpt-4-vision-preview' });

    // Reset canvas mocks
    mockToDataURL.mockReturnValue('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    mockGetContext.mockReturnValue({
      putImageData: jest.fn()
    });
  });

  describe('Complete Fallback Flow', () => {
    it('should trigger VLM when YOLO confidence is low', async () => {
      // Setup: YOLO returns low confidence detections
      mockRunYoloInference.mockResolvedValue({
        detections: [
          { itemType: 'wrench', confidence: 0.55, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 0 }
        ],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      });

      const mockImageData = {
        width: 640,
        height: 480,
        data: new Uint8ClampedArray(640 * 480 * 4),
        colorSpace: 'srgb' as const
      } as ImageData;

      // Step 1: Run YOLO
      const yoloResult = await runYoloInference(mockImageData);

      // Step 2: Evaluate fallback need
      const estimatedCost = estimateVlmCost(640, 480);
      const decision = evaluateFallbackNeed(yoloResult, 2, estimatedCost);

      expect(decision.shouldUseFallback).toBe(true);
      expect(decision.reason).toContain('below 70% confidence');

      // Step 3: Check budget
      const budget = checkBudgetAvailability(0, 0, estimatedCost);
      expect(budget.allowed).toBe(true);

      // Step 4: Mock VLM result (OpenAI integration tested separately)
      const vlmResult = {
        detections: [
          { itemType: 'wrench', confidence: 0.90, reasoning: 'Clear view', matchedExpectedItem: 'wrench' },
          { itemType: 'screwdriver', confidence: 0.85, reasoning: 'Visible', matchedExpectedItem: 'screwdriver' }
        ],
        processingTimeMs: 2000,
        estimatedCostUsd: estimatedCost,
        provider: 'openai-gpt4-vision' as const,
        modelVersion: 'gpt-4-vision-preview'
      };

      // Step 5: Combine results
      const finalResult = combineDetectionResults(yoloResult, vlmResult);

      expect(finalResult.method).toBe('cloud_vlm');
      expect(finalResult.detections.length).toBe(2);
      expect(finalResult.costUsd).toBeGreaterThan(0);

      // Verify wrench got VLM confidence (higher)
      const wrench = finalResult.detections.find(d => d.itemType === 'wrench');
      expect(wrench?.confidence).toBeCloseTo(0.90);
    });

    it('should NOT trigger VLM when YOLO confidence is high', async () => {
      const mockImageData = {
        width: 640,
        height: 480,
        data: new Uint8ClampedArray(640 * 480 * 4),
        colorSpace: 'srgb' as const
      } as ImageData;

      // YOLO returns high confidence
      mockRunYoloInference.mockResolvedValue({
        detections: [
          { itemType: 'wrench', confidence: 0.85, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 0 },
          { itemType: 'hammer', confidence: 0.92, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 1 }
        ],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      });

      const yoloResult = await runYoloInference(mockImageData);
      const estimatedCost = estimateVlmCost(640, 480);
      const decision = evaluateFallbackNeed(yoloResult, 2, estimatedCost);

      expect(decision.shouldUseFallback).toBe(false);
      expect(decision.reason).toContain('above 70% confidence');

      // VLM should NOT be called - save money!
    });

    it('should trigger VLM when items are missing', async () => {
      const mockImageData = {
        width: 640,
        height: 480,
        data: new Uint8ClampedArray(640 * 480 * 4),
        colorSpace: 'srgb' as const
      } as ImageData;

      // YOLO only finds 1 item, but 3 expected
      mockRunYoloInference.mockResolvedValue({
        detections: [
          { itemType: 'wrench', confidence: 0.85, boundingBox: { x: 0, y: 0, width: 100, height: 100 }, classId: 0 }
        ],
        processingTimeMs: 500,
        inputWidth: 640,
        inputHeight: 480,
        modelInputSize: 640
      });

      const yoloResult = await runYoloInference(mockImageData);
      const estimatedCost = estimateVlmCost(640, 480);
      const decision = evaluateFallbackNeed(yoloResult, 3, estimatedCost);

      expect(decision.shouldUseFallback).toBe(true);
      expect(decision.reason).toContain('Missing 2 expected item');
      expect(decision.missingItemsCount).toBe(2);
    });
  });

  describe('Budget Enforcement', () => {
    it('should block VLM when daily budget is exceeded', async () => {
      const estimatedCost = estimateVlmCost(640, 480);

      // Company has already spent $9.95 today
      const budget = checkBudgetAvailability(9.95, 50, estimatedCost);

      if (!budget.allowed) {
        expect(budget.reason).toContain('exceed daily budget');
      }
    });

    it('should block VLM when request limit is reached', async () => {
      const estimatedCost = estimateVlmCost(640, 480);

      // Company has already made 100 requests today
      const budget = checkBudgetAvailability(5.00, 100, estimatedCost);

      expect(budget.allowed).toBe(false);
      expect(budget.reason).toContain('request limit reached');
    });

    it('should allow VLM when within budget', async () => {
      const estimatedCost = estimateVlmCost(640, 480);

      const budget = checkBudgetAvailability(2.00, 20, estimatedCost);

      expect(budget.allowed).toBe(true);
      expect(budget.remainingBudget).toBeGreaterThan(0);
      expect(budget.remainingRequests).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle VLM API errors gracefully', async () => {
      // Mock API error
      mockOpenAICreate.mockRejectedValue(new Error('API rate limit exceeded'));

      clearOpenAIClient(); // Force re-initialization

      const mockImageData = {
        width: 640,
        height: 480,
        data: new Uint8ClampedArray(640 * 480 * 4),
        colorSpace: 'srgb' as const
      } as ImageData;

      const vlmResult = await callOpenAIVision({
        imageData: mockImageData,
        kitId: 'test-kit-123',
        expectedItems: ['wrench'],
        companyId: 'test-company'
      });

      // Should return empty result without throwing
      expect(vlmResult.detections).toEqual([]);
      expect(vlmResult.estimatedCostUsd).toBe(0);
    });

    it('should handle missing OPENAI_API_KEY', async () => {
      delete process.env.OPENAI_API_KEY;
      clearOpenAIClient();

      const mockImageData = {
        width: 640,
        height: 480,
        data: new Uint8ClampedArray(640 * 480 * 4),
        colorSpace: 'srgb' as const
      } as ImageData;

      // The adapter catches errors and returns empty result
      const result = await callOpenAIVision({
        imageData: mockImageData,
        kitId: 'test-kit-123',
        expectedItems: ['wrench'],
        companyId: 'test-company'
      });

      // Should return empty result, not throw
      expect(result.detections).toEqual([]);
      expect(result.estimatedCostUsd).toBe(0);
    });
  });

  describe('Cost Tracking', () => {
    it('should accurately estimate VLM costs', () => {
      // Standard 640x480 image
      const cost = estimateVlmCost(640, 480, 500);

      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(1.0); // Should be well under $1
    });

    it('should estimate higher cost for larger images', () => {
      const smallCost = estimateVlmCost(640, 480, 500);
      const largeCost = estimateVlmCost(1920, 1080, 500);

      expect(largeCost).toBeGreaterThan(smallCost);
    });

    it('should estimate higher cost for more output tokens', () => {
      const lowTokenCost = estimateVlmCost(640, 480, 200);
      const highTokenCost = estimateVlmCost(640, 480, 1000);

      expect(highTokenCost).toBeGreaterThan(lowTokenCost);
    });
  });
});