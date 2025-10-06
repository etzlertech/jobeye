/**
 * @file yolo-inference.mock.ts
 * @purpose Mock YOLO inference for testing without ONNX Runtime
 * @test_type mock
 */

import { YoloInferenceResult } from '@/domains/vision/lib/yolo-inference';
import { YoloDetection } from '@/domains/vision/lib/vision-types';

const PROVIDER = 'mock-yolo';
const MODEL_VERSION = 'mock-v1';

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
      expectedItems.forEach((item, index) => {
        detections.push({
          source: 'local_yolo',
          itemType: item,
          confidence: 0.85 + Math.random() * 0.15,
          boundingBox: {
            x: index * 100,
            y: index * 50,
            width: 80 + Math.random() * 20,
            height: 60 + Math.random() * 20,
          },
          classId: index,
          provider: PROVIDER,
          modelVersion: MODEL_VERSION,
        });
      });
      break;

    case 'low_confidence':
      expectedItems.forEach((item, index) => {
        detections.push({
          source: 'local_yolo',
          itemType: item,
          confidence: 0.5 + Math.random() * 0.15,
          boundingBox: {
            x: index * 100,
            y: index * 50,
            width: 80,
            height: 60,
          },
          classId: index,
          provider: PROVIDER,
          modelVersion: MODEL_VERSION,
        });
      });
      break;

    case 'partial': {
      const halfCount = Math.ceil(expectedItems.length / 2);
      expectedItems.slice(0, halfCount).forEach((item, index) => {
        detections.push({
          source: 'local_yolo',
          itemType: item,
          confidence: 0.8 + Math.random() * 0.15,
          boundingBox: {
            x: index * 100,
            y: index * 50,
            width: 80,
            height: 60,
          },
          classId: index,
          provider: PROVIDER,
          modelVersion: MODEL_VERSION,
        });
      });
      break;
    }

    case 'none':
      break;
  }

  return detections;
}

function buildResult(
  detections: YoloDetection[],
  imageData: ImageData,
  processingTimeMs: number
): YoloInferenceResult {
  return {
    source: 'local_yolo',
    provider: PROVIDER,
    modelVersion: MODEL_VERSION,
    detections,
    processingTimeMs,
    imageDimensions: { width: imageData.width, height: imageData.height },
    metadata: { modelInputSize: 640 },
  };
}

/**
 * Mock YOLO inference function
 */
export function createMockYoloInference(
  scenario: 'high_confidence' | 'low_confidence' | 'partial' | 'none' = 'high_confidence'
) {
  return jest.fn().mockImplementation(
    async (imageData: ImageData, expectedItems?: string[]): Promise<YoloInferenceResult> => {
      const processingTime = 200 + Math.random() * 300;
      const items = expectedItems && expectedItems.length > 0 ? expectedItems : ['object'];
      const detections = generateMockDetections(items, scenario);

      return buildResult(detections, imageData, processingTime);
    }
  );
}

/**
 * Mock YOLO inference that fails
 */
export function createFailingYoloInference() {
  return jest.fn().mockRejectedValue(new Error('YOLO inference failed'));
}

/**
 * Mock YOLO inference with custom detections
 */
export function createCustomYoloInference(detections: YoloDetection[]) {
  return jest.fn().mockImplementation(async (imageData: ImageData) => {
    const processingTime = 200 + Math.random() * 150;
    return buildResult(detections, imageData, processingTime);
  });
}

/**
 * Mock YOLO inference that times out
 */
export function createTimeoutYoloInference() {
  return jest.fn().mockImplementation(
    () => new Promise((_, reject) => setTimeout(() => reject(new Error('YOLO inference timeout')), 3000))
  );
}

/**
 * Setup YOLO mock for all tests
 */
export function setupYoloMock(
  scenario: 'high_confidence' | 'low_confidence' | 'partial' | 'none' = 'high_confidence'
) {
  const mockRunYoloInference = createMockYoloInference(scenario);

  jest.mock('@/domains/vision/lib/yolo-inference', () => ({
    runYoloInference: mockRunYoloInference,
  }));

  return mockRunYoloInference;
}

export default {
  runYoloInference: createMockYoloInference('high_confidence'),
  __esModule: true,
};
