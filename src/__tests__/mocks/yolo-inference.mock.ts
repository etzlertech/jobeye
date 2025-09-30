/**
 * @file yolo-inference.mock.ts
 * @purpose Mock YOLO inference for testing without ONNX Runtime
 * @test_type mock
 */

import { YoloDetection, YoloInferenceResult } from '@/domains/vision/lib/yolo-inference';

/**
 * Generate realistic YOLO detections based on expected items
 */
export function generateMockDetections(
  expectedItems: string[],
  scenario: 'high_confidence' | 'low_confidence' | 'partial' | 'none' = 'high_confidence'
): YoloDetection[] {
  const detections: YoloDetection[] = [];

  switch (scenario) {
    case 'high_confidence':
      // All items detected with high confidence
      expectedItems.forEach((item, index) => {
        detections.push({
          itemType: item,
          confidence: 0.85 + Math.random() * 0.15, // 0.85-1.0
          boundingBox: {
            x: index * 100,
            y: index * 50,
            width: 80 + Math.random() * 20,
            height: 60 + Math.random() * 20
          },
          classId: index
        });
      });
      break;

    case 'low_confidence':
      // All items detected but with low confidence (triggers VLM)
      expectedItems.forEach((item, index) => {
        detections.push({
          itemType: item,
          confidence: 0.50 + Math.random() * 0.15, // 0.50-0.65
          boundingBox: {
            x: index * 100,
            y: index * 50,
            width: 80,
            height: 60
          },
          classId: index
        });
      });
      break;

    case 'partial':
      // Only detect half the items
      const halfCount = Math.ceil(expectedItems.length / 2);
      expectedItems.slice(0, halfCount).forEach((item, index) => {
        detections.push({
          itemType: item,
          confidence: 0.80 + Math.random() * 0.15,
          boundingBox: {
            x: index * 100,
            y: index * 50,
            width: 80,
            height: 60
          },
          classId: index
        });
      });
      break;

    case 'none':
      // No items detected (empty array)
      break;
  }

  return detections;
}

/**
 * Mock YOLO inference function
 */
export function createMockYoloInference(
  scenario: 'high_confidence' | 'low_confidence' | 'partial' | 'none' = 'high_confidence'
) {
  return jest.fn().mockImplementation(
    async (imageData: ImageData, expectedItems?: string[]): Promise<YoloInferenceResult> => {
      // Simulate processing time
      const processingTime = 200 + Math.random() * 300; // 200-500ms

      // Generate detections based on scenario
      const items = expectedItems || ['object'];
      const detections = generateMockDetections(items, scenario);

      return {
        detections,
        processingTimeMs: processingTime,
        success: true,
        imageWidth: imageData.width,
        imageHeight: imageData.height
      };
    }
  );
}

/**
 * Mock YOLO inference that fails
 */
export function createFailingYoloInference() {
  return jest.fn().mockResolvedValue({
    detections: [],
    processingTimeMs: 0,
    success: false,
    error: 'YOLO model not loaded'
  });
}

/**
 * Mock YOLO inference with custom detections
 */
export function createCustomYoloInference(detections: YoloDetection[]) {
  return jest.fn().mockResolvedValue({
    detections,
    processingTimeMs: 250,
    success: true
  });
}

/**
 * Mock YOLO inference that times out
 */
export function createTimeoutYoloInference() {
  return jest.fn().mockImplementation(() => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('YOLO inference timeout')), 3000);
    });
  });
}

/**
 * Setup YOLO mock for all tests
 */
export function setupYoloMock(
  scenario: 'high_confidence' | 'low_confidence' | 'partial' | 'none' = 'high_confidence'
) {
  const mockDetectObjects = createMockYoloInference(scenario);

  jest.mock('@/domains/vision/lib/yolo-inference', () => ({
    detectObjects: mockDetectObjects,
    YoloDetection: jest.fn(),
    YoloInferenceResult: jest.fn(),
    CONFIDENCE_THRESHOLD: 0.7
  }));

  return mockDetectObjects;
}

/**
 * Default export for jest.mock
 */
export default {
  detectObjects: createMockYoloInference('high_confidence'),
  __esModule: true
};