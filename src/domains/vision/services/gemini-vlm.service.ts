/**
 * Gemini VLM service for object detection
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { BoundingBox } from './crop-generator.service';

export interface GeminiDetectionRequest {
  imageData: File | Blob | string;
  expectedItems?: string[];
  context?: string;
  maxDetections?: number;
}

export interface GeminiDetection {
  label: string;
  confidence: number;
  reasoning: string;
  bbox?: BoundingBox;
  matchedExpectedItem?: string;
}

export interface GeminiResult {
  detections: GeminiDetection[];
  processingTimeMs: number;
  estimatedCost: number;
  provider: 'google-gemini-2.5';
  modelVersion: string;
}

export interface GeminiOptions {
  model?: string;
  includeBboxes?: boolean;
}

/**
 * Gemini-based object detection
 */
export async function detectWithGemini(
  request: GeminiDetectionRequest,
  options: GeminiOptions = {}
): Promise<{ data: GeminiResult | null; error: Error | null }> {
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
    const model = genAI.getGenerativeModel({
      model: options.model || 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    // Convert image to proper format
    let imageData: string;
    if (typeof request.imageData === 'string') {
      // Remove data URL prefix if present
      imageData = request.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    } else {
      const buffer = await request.imageData.arrayBuffer();
      imageData = Buffer.from(buffer).toString('base64');
    }

    const { includeBboxes = true } = options;

    // Build prompt
    let prompt = `Identify all tools, equipment, and materials visible in this inventory photo.

For each item detected, provide:
- label: item name (e.g., "hammer", "drill", "tape measure")
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
}`;
    }

    prompt += `\n\nReturn results as JSON with this exact structure:
{
  "detections": [
    {
      "label": "item name",
      "confidence": 0.95,
      "reasoning": "explanation",
      "bbox": { "x": 25, "y": 30, "width": 15, "height": 20 }
    }
  ]
}`;

    console.log('\n========== GEMINI PROMPT ==========');
    console.log(prompt);
    console.log('===================================\n');

    // Call Gemini
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData,
          mimeType: 'image/jpeg',
        },
      },
    ]);

    const response = result.response;
    const text = response.text();

    console.log('\n========== GEMINI RESPONSE ==========');
    console.log(text || '(empty response)');
    console.log('=====================================\n');

    if (!text) {
      console.error('[Gemini Service] No text in response');
      return {
        data: null,
        error: new Error('No response from Gemini'),
      };
    }

    const parsed = JSON.parse(text);
    const detections = Array.isArray(parsed.detections) ? parsed.detections : [];

    console.log('[Gemini Service] Parsed detections:', detections);

    const processingTimeMs = Date.now() - startTime;

    // Map detections
    const mappedDetections: GeminiDetection[] = detections.map((d: any) => {
      const detection: GeminiDetection = {
        label: d.label || 'unknown',
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
        console.log(`[Gemini Service] Added bbox for "${detection.label}":`, detection.bbox);
      } else {
        console.log(`[Gemini Service] No bbox for "${detection.label}"`);
      }

      return detection;
    });

    console.log('[Gemini Service] Final detections:', mappedDetections.map(d => ({
      label: d.label,
      confidence: d.confidence,
      hasBbox: !!d.bbox
    })));

    return {
      data: {
        detections: mappedDetections,
        processingTimeMs,
        estimatedCost: 0.001, // Gemini is much cheaper
        provider: 'google-gemini-2.5',
        modelVersion: options.model || 'gemini-1.5-flash',
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[Gemini Service] Error:', err);
    return {
      data: null,
      error: new Error(`Gemini detection failed: ${err.message}`),
    };
  }
}

export function isGeminiAvailable(): boolean {
  return !!process.env.GOOGLE_GEMINI_API_KEY;
}
