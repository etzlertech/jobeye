/**
 * @file test-setup.ts
 * @purpose Centralized test setup for vision domain tests
 * @test_type helper
 */

import { createMockYoloInference } from '@/__tests__/mocks/yolo-inference.mock';
import { createMockOpenAIVision } from '@/__tests__/mocks/openai-vision.mock';
import { setupSpeechSynthesisMock } from '@/__tests__/mocks/speech-synthesis.mock';

/**
 * Mock YOLO inference for all vision tests
 */
export function setupYoloMock(
  scenario: 'high_confidence' | 'low_confidence' | 'partial' | 'none' = 'high_confidence'
) {
  const mockDetectObjects = createMockYoloInference(scenario);

  // Mock the YOLO module
  jest.mock('@/domains/vision/lib/yolo-inference', () => ({
    detectObjects: mockDetectObjects,
    CONFIDENCE_THRESHOLD: 0.7
  }));

  return mockDetectObjects;
}

/**
 * Mock OpenAI Vision API for VLM fallback tests
 */
export function setupOpenAIVisionMock(
  scenario: 'high_confidence' | 'low_confidence' | 'partial' | 'none' = 'high_confidence'
) {
  const mockCallOpenAIVision = createMockOpenAIVision(scenario);

  jest.mock('@/domains/vision/lib/openai-vision-adapter', () => ({
    callOpenAIVision: mockCallOpenAIVision
  }));

  return mockCallOpenAIVision;
}

/**
 * Mock Vision Verification Service for E2E tests
 */
export function setupVisionServiceMock() {
  const VisionVerificationService = jest.fn().mockImplementation(() => ({
    verifyKit: jest.fn().mockImplementation(async (request) => {
      // Simulate YOLO detection
      const detections = request.expectedItems.map((item: string, index: number) => ({
        source: 'local_yolo' as const,
        itemType: item,
        confidence: 0.85 + Math.random() * 0.15,
        boundingBox: {
          x: index * 10,
          y: 0,
          width: 50,
          height: 50,
        },
        provider: 'mock-yolo',
        modelVersion: 'mock-v1',
      }));

      const detectedItems = detections.map((detection: any) => ({
        itemType: detection.itemType,
        confidence: detection.confidence,
        matchStatus: 'matched' as const,
        source: detection.source,
        provider: detection.provider,
        modelVersion: detection.modelVersion,
        boundingBox: detection.boundingBox,
      }));

      const confidenceScore = detections.length
        ? detections.reduce((sum: number, d: any) => sum + d.confidence, 0) / detections.length
        : 0;

      return {
        data: {
          verificationId: `ver-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          verificationResult: detections.length === request.expectedItems.length ? 'complete' : 'incomplete',
          processingMethod: 'local_yolo' as const,
          confidenceScore,
          detections,
          detectedItems,
          missingItems: [],
          unexpectedItems: [],
          costUsd: 0, // YOLO is free
          processingTimeMs: 200 + Math.random() * 300,
          budgetStatus: {
            allowed: true,
            remainingBudget: 10.0,
            remainingRequests: 100
          }
        },
        error: null
      };
    }),

    runYoloDetection: jest.fn().mockResolvedValue({
      source: 'local_yolo',
      provider: 'mock-yolo',
      modelVersion: 'mock-v1',
      detections: [],
      processingTimeMs: 250,
      metadata: { mock: true },
    })
  }));

  return { VisionVerificationService };
}

/**
 * Create test image data
 */
export function createTestImageData(width: number = 640, height: number = 480): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(Math.random() * 256);     // R
    data[i + 1] = Math.floor(Math.random() * 256); // G
    data[i + 2] = Math.floor(Math.random() * 256); // B
    data[i + 3] = 255;                              // A
  }
  return new ImageData(data, width, height);
}

/**
 * Test kit definitions
 */
export const TEST_KITS = {
  basic: {
    id: 'kit-basic',
    name: 'Basic Lawn Care',
    items: ['mower', 'trimmer', 'safety_glasses']
  },
  advanced: {
    id: 'kit-advanced',
    name: 'Advanced Tree Service',
    items: ['chainsaw', 'pole_saw', 'harness', 'helmet', 'climbing_rope', 'carabiners']
  },
  empty: {
    id: 'kit-empty',
    name: 'Empty Kit',
    items: []
  },
  massive: {
    id: 'kit-massive',
    name: 'Full Truck',
    items: [
      'mower', 'trimmer', 'blower', 'edger', 'chainsaw', 'pole_saw',
      'hedge_trimmer', 'backpack_blower', 'commercial_mower', 'trailer',
      'gas_cans', 'tool_box', 'ladder', 'safety_cones', 'first_aid_kit',
      'water_cooler', 'tarps', 'bungee_cords', 'ratchet_straps', 'spare_parts'
    ]
  }
};

/**
 * Test company IDs
 */
export const TEST_COMPANIES = {
  default: 'test-company-default',
  budget: 'test-company-budget-strict',
  premium: 'test-company-premium',
  franchise: 'test-company-franchise'
};

/**
 * Setup test environment
 */
export function setupTestEnvironment() {
  // Ensure ImageData is available
  if (typeof ImageData === 'undefined') {
    global.ImageData = class ImageData {
      width: number;
      height: number;
      data: Uint8ClampedArray;

      constructor(
        dataOrWidth: Uint8ClampedArray | number,
        widthOrHeight: number,
        height?: number
      ) {
        if (dataOrWidth instanceof Uint8ClampedArray) {
          this.data = dataOrWidth;
          this.width = widthOrHeight;
          this.height = height!;
        } else {
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
        }
      }
    } as any;
  }

  // Mock navigator.onLine if not available
  if (typeof navigator === 'undefined') {
    (global as any).navigator = {
      onLine: true
    };
  }

  // Setup Speech Synthesis mock
  setupSpeechSynthesisMock();
}

/**
 * Cleanup test environment
 */
export function cleanupTestEnvironment() {
  jest.clearAllMocks();
  jest.restoreAllMocks();
}
