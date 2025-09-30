/**
 * @file openai-vision.mock.ts
 * @purpose Mock OpenAI Vision API for testing VLM fallback
 * @test_type mock
 */

import { VlmDetection, VlmResult } from '@/domains/vision/lib/vlm-fallback-router';

/**
 * Generate realistic VLM detections
 */
export function generateMockVlmDetections(
  expectedItems: string[],
  scenario: 'high_confidence' | 'low_confidence' | 'partial' | 'none' = 'high_confidence'
): VlmDetection[] {
  const detections: VlmDetection[] = [];

  switch (scenario) {
    case 'high_confidence':
      // VLM detects all items with high confidence and reasoning
      expectedItems.forEach(item => {
        detections.push({
          itemType: item,
          confidence: 0.90 + Math.random() * 0.10, // 0.90-1.0
          reasoning: `Clear view of ${item.replace(/_/g, ' ')} in image. High certainty based on shape, color, and context.`,
          matchedExpectedItem: item
        });
      });
      break;

    case 'low_confidence':
      // VLM detects items but with lower confidence
      expectedItems.forEach(item => {
        detections.push({
          itemType: item,
          confidence: 0.60 + Math.random() * 0.20, // 0.60-0.80
          reasoning: `Possible ${item.replace(/_/g, ' ')} visible, but partial occlusion or poor lighting reduces certainty.`,
          matchedExpectedItem: item
        });
      });
      break;

    case 'partial':
      // VLM only detects some items
      const detectCount = Math.ceil(expectedItems.length * 0.6);
      expectedItems.slice(0, detectCount).forEach(item => {
        detections.push({
          itemType: item,
          confidence: 0.85 + Math.random() * 0.10,
          reasoning: `${item.replace(/_/g, ' ')} clearly visible with distinctive features.`,
          matchedExpectedItem: item
        });
      });
      break;

    case 'none':
      // VLM detects nothing
      break;
  }

  return detections;
}

/**
 * Create mock OpenAI Vision API call
 */
export function createMockOpenAIVision(
  scenario: 'high_confidence' | 'low_confidence' | 'partial' | 'none' = 'high_confidence'
) {
  return jest.fn().mockImplementation(
    async (request: any): Promise<VlmResult> => {
      // Simulate API processing time (slower than YOLO)
      const processingTime = 1000 + Math.random() * 2000; // 1-3 seconds

      // Extract expected items from request
      const expectedItems = request.expectedItems || [];

      // Generate detections
      const detections = generateMockVlmDetections(expectedItems, scenario);

      // Estimate tokens used (prompt + completion)
      const promptTokens = 250 + (expectedItems.length * 10);
      const completionTokens = 300 + (detections.length * 50);
      const tokensUsed = promptTokens + completionTokens;

      // Calculate cost ($0.01 per 1K input tokens, $0.03 per 1K output tokens)
      const inputCost = (promptTokens / 1000) * 0.01;
      const outputCost = (completionTokens / 1000) * 0.03;
      const imageCost = 0.065; // Base image cost
      const estimatedCostUsd = inputCost + outputCost + imageCost;

      return {
        detections,
        processingTimeMs: processingTime,
        estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
        provider: 'openai-gpt4-vision',
        modelVersion: 'gpt-4-vision-preview',
        tokensUsed
      };
    }
  );
}

/**
 * Create mock that fails
 */
export function createFailingOpenAIVision() {
  return jest.fn().mockRejectedValue(
    new Error('OpenAI Vision API error: Rate limit exceeded')
  );
}

/**
 * Create mock with custom detections
 */
export function createCustomOpenAIVision(detections: VlmDetection[]) {
  return jest.fn().mockResolvedValue({
    detections,
    processingTimeMs: 1500,
    estimatedCostUsd: 0.10,
    provider: 'openai-gpt4-vision',
    modelVersion: 'gpt-4-vision-preview',
    tokensUsed: 550
  });
}

/**
 * Create mock that times out
 */
export function createTimeoutOpenAIVision() {
  return jest.fn().mockImplementation(() => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI Vision API timeout')), 5000);
    });
  });
}

/**
 * Default export for jest.mock
 */
export default {
  callOpenAIVision: createMockOpenAIVision('high_confidence'),
  __esModule: true
};