/**
 * YOLO Detection Web Worker
 * Feature 006: 1fps throttled on-device object detection
 *
 * @phase 3.1
 * @complexity_budget 300
 */

import type { DetectedItem } from '@/domains/vision/types';

// Worker message types
interface DetectMessage {
  type: 'DETECT';
  imageData: ImageData;
  expectedItems?: string[];
}

interface ResultMessage {
  type: 'RESULT';
  detectedItems: DetectedItem[];
  confidenceScore: number;
  shouldFallback: boolean;
  retryCount: number;
}

interface ErrorMessage {
  type: 'ERROR';
  error: string;
}

// Listen for messages from main thread
self.addEventListener('message', async (event: MessageEvent<DetectMessage>) => {
  const { type, imageData, expectedItems } = event.data;

  if (type === 'DETECT') {
    try {
      // Import YOLO service (lazy load to keep worker lightweight)
      const { YOLOInferenceService } = await import(
        '@/domains/vision/services/yolo-inference.service'
      );

      const yoloService = new YOLOInferenceService();

      // Run YOLO inference
      const result = await yoloService.detectObjects(imageData, {
        expectedItems,
        confidenceThreshold: 0.7,
      });

      // Post result back to main thread
      const response: ResultMessage = {
        type: 'RESULT',
        detectedItems: result.detectedItems,
        confidenceScore: result.confidenceScore,
        shouldFallback: result.confidenceScore < 0.7,
        retryCount: result.retryCount || 0,
      };

      self.postMessage(response);
    } catch (error) {
      const errorResponse: ErrorMessage = {
        type: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      self.postMessage(errorResponse);
    }
  }
});

// Export empty object to satisfy TypeScript
export {};
