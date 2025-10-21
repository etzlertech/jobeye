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
 * Cost: $0.002 per image (Gemini 2.0 Flash)
 * Daily budget: $10 (5000 VLM calls max)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
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
  provider: 'google-gemini-2.0-flash';
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
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return {
        data: null,
        error: new Error('GOOGLE_GEMINI_API_KEY not configured'),
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Convert image to base64 and extract mime type
    let base64Data: string;
    let mimeType: string;

    if (typeof request.imageData === 'string') {
      // Extract from data URL
      const matches = request.imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return {
          data: null,
          error: new Error('Invalid base64 image string format'),
        };
      }
      mimeType = matches[1];
      base64Data = matches[2];
    } else {
      const buffer = await request.imageData.arrayBuffer();
      base64Data = Buffer.from(buffer).toString('base64');
      mimeType = request.imageData instanceof File ? request.imageData.type : 'image/jpeg';
    }

    const {
      model = 'gemini-1.5-flash-latest',
      maxTokens = 1500,
      includeBboxes = true, // Enable by default for mobile UI
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
      prompt += `\n\nFor each item, provide precise bounding box coordinates as percentages of image dimensions:
{
  "x": <percentage from left edge (0-100)>,
  "y": <percentage from top edge (0-100)>,
  "width": <percentage of image width (0-100)>,
  "height": <percentage of image height (0-100)>
}
Example: {"x": 25, "y": 30, "width": 15, "height": 20} means box starts 25% from left, 30% from top, is 15% wide and 20% tall.`;
    }

    prompt += `\n\nReturn results as a JSON object with a "detections" array. Each detection must have: label, confidence, reasoning, and optionally bbox.`;

    console.log('\n========== GEMINI VISION PROMPT ==========');
    console.log(prompt);
    console.log('==========================================\n');

    // Call Gemini Vision
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.4,
      }
    });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };

    const result = await geminiModel.generateContent([prompt, imagePart]);
    const response = await result.response;
    const content = response.text();

    console.log('\n========== GEMINI VISION RESPONSE ==========');
    console.log(content || '(empty response)');
    console.log('============================================\n');

    if (!content) {
      console.error('[VLM Service] No content in Gemini response');
      return {
        data: null,
        error: new Error('No response from Gemini Vision'),
      };
    }

    // Parse JSON from response (Gemini may wrap it in markdown code blocks)
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const parsed = JSON.parse(jsonContent);
    const detections = Array.isArray(parsed.detections) ? parsed.detections : [];

    console.log('[VLM Service] Parsed detections:', detections);

    const processingTimeMs = Date.now() - startTime;

    // Estimate cost: Gemini 2.0 Flash is ~$0.002 per image (much cheaper than GPT-4)
    const estimatedCost = 0.002; // $0.002 per image

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
        console.log(`[VLM Service] Added bbox for "${detection.label}":`, detection.bbox);
      } else {
        console.log(`[VLM Service] No bbox in response for "${detection.label}"`);
      }

      return detection;
    });

    console.log('[VLM Service] Final mapped detections:', mappedDetections.map(d => ({
      label: d.label,
      confidence: d.confidence,
      hasBbox: !!d.bbox,
      bbox: d.bbox
    })));

    return {
      data: {
        detections: mappedDetections,
        processingTimeMs,
        estimatedCost,
        provider: 'google-gemini-2.0-flash',
        modelVersion: model,
        tokensUsed: 0, // Gemini doesn't provide token counts in the same way
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
  return !!process.env.GOOGLE_GEMINI_API_KEY;
}

/**
 * Estimate cost for VLM detection
 */
export function estimateCost(imageCount: number = 1): number {
  return imageCount * 0.002; // $0.002 per image (Gemini 2.0 Flash)
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