/**
 * @file /src/domains/vision/services/vlm-fallback.service.ts
 * @phase 3.5
 * @domain Vision
 * @purpose VLM fallback service for inventory detection when YOLO fails
 * @complexity_budget 250
 * @feature 004-voice-vision-inventory
 *
 * VLM fallback triggers when:
 * - YOLO confidence < 70%
 * - Missing expected items
 * - User requests re-scan
 *
 * Cost: $0.10 per image (GPT-4 Vision)
 * Daily budget: $10 (100 VLM calls max)
 */

import OpenAI from 'openai';
import type { BoundingBox } from './crop-generator.service';

export interface VlmDetectionRequest {
  imageData: File | Blob | string;
  expectedItems?: string[];
  context?: string;
  maxDetections?: number;
}

export interface VlmDetection {
  label: string;
  confidence: number;
  reasoning: string;
  bbox?: BoundingBox;
  matchedExpectedItem?: string;
}

export interface VlmResult {
  detections: VlmDetection[];
  processingTimeMs: number;
  estimatedCost: number;
  provider: 'openai-gpt4-vision';
  modelVersion: string;
  tokensUsed?: number;
}

export interface VlmFallbackOptions {
  model?: string;
  maxTokens?: number;
  includeBboxes?: boolean;
}

/**
 * VLM-based object detection for inventory items
 */
export async function detectWithVlm(
  request: VlmDetectionRequest,
  options: VlmFallbackOptions = {}
): Promise<{ data: VlmResult | null; error: Error | null }> {
  const startTime = Date.now();

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        data: null,
        error: new Error('OPENAI_API_KEY not configured'),
      };
    }

    const openai = new OpenAI({ apiKey });

    // Convert image to base64 if needed
    let imageUrl: string;
    if (typeof request.imageData === 'string') {
      imageUrl = request.imageData;
    } else {
      const buffer = await request.imageData.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType =
        request.imageData instanceof File ? request.imageData.type : 'image/jpeg';
      imageUrl = `data:${mimeType};base64,${base64}`;
    }

    const {
      model = 'gpt-4o',
      maxTokens = 1500,
      includeBboxes = false,
    } = options;

    // Build prompt
    let prompt = `Identify all tools, equipment, and materials visible in this inventory photo.

For each item detected, provide:
- label: item name (e.g., "hammer", "drill", "2x4 lumber")
- confidence: confidence score 0.0-1.0
- reasoning: brief explanation of what you see`;

    if (request.expectedItems && request.expectedItems.length > 0) {
      prompt += `\n\nExpected items to look for: ${request.expectedItems.join(', ')}`;
    }

    if (request.context) {
      prompt += `\n\nContext: ${request.context}`;
    }

    if (includeBboxes) {
      prompt += `\n\nFor each item, also provide approximate bounding box coordinates as percentages of image dimensions (x, y, width, height).`;
    }

    prompt += `\n\nReturn results as a JSON array of detections.`;

    // Call GPT-4 Vision
    const response = await openai.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        data: null,
        error: new Error('No response from GPT-4 Vision'),
      };
    }

    const parsed = JSON.parse(content);
    const detections = Array.isArray(parsed.detections) ? parsed.detections : [];

    const processingTimeMs = Date.now() - startTime;

    // Estimate cost: gpt-4o is ~$0.10 per image
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const estimatedCost = 0.10; // Flat rate for simplicity

    // Map detections to VlmDetection format
    const mappedDetections: VlmDetection[] = detections.map((d: any) => {
      const detection: VlmDetection = {
        label: d.label || d.itemType || 'unknown',
        confidence: d.confidence || 0.8,
        reasoning: d.reasoning || '',
      };

      // Check if matches expected item
      if (request.expectedItems) {
        const normalized = detection.label.toLowerCase();
        const match = request.expectedItems.find((item) =>
          normalized.includes(item.toLowerCase()) || item.toLowerCase().includes(normalized)
        );
        if (match) {
          detection.matchedExpectedItem = match;
        }
      }

      // Add bounding box if provided
      if (d.bbox && typeof d.bbox === 'object') {
        detection.bbox = {
          x: d.bbox.x || 0,
          y: d.bbox.y || 0,
          width: d.bbox.width || 0,
          height: d.bbox.height || 0,
        };
      }

      return detection;
    });

    return {
      data: {
        detections: mappedDetections,
        processingTimeMs,
        estimatedCost,
        provider: 'openai-gpt4-vision',
        modelVersion: model,
        tokensUsed: inputTokens + outputTokens,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(`VLM detection failed: ${err.message}`),
    };
  }
}

/**
 * Check if VLM is available (API key configured)
 */
export function isAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Estimate cost for VLM detection
 */
export function estimateCost(imageCount: number = 1): number {
  return imageCount * 0.10; // $0.10 per image
}

/**
 * Check if within daily budget
 */
export function isWithinBudget(
  currentSpend: number,
  additionalCost: number,
  dailyBudget: number = 10.0
): {
  allowed: boolean;
  remaining: number;
  wouldExceed: boolean;
} {
  const remaining = dailyBudget - currentSpend;
  const wouldExceed = additionalCost > remaining;

  return {
    allowed: !wouldExceed,
    remaining,
    wouldExceed,
  };
}