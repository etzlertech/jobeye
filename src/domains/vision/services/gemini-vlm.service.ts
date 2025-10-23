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

export interface GeminiChecklistItem {
  name: string;
  status: 'present' | 'missing' | 'uncertain';
  confidence?: number;
  note?: string;
}

export interface GeminiChecklistRequest extends GeminiDetectionRequest {
  remainingItems: string[];
  verifiedItems?: string[];
  priorDetections?: GeminiChecklistItem[];
  frameNumber?: number;
  lightingHint?: string;
  bboxHints?: string;
}

export interface GeminiChecklistResult {
  items: GeminiChecklistItem[];
  processingTimeMs: number;
  estimatedCost: number;
  provider: 'google-gemini-2.5';
  modelVersion: string;
  frameNumber: number;
}

/**
 * Gemini-based object detection
 * Using Gemini 2.0 Flash for fast, real-time detection
 */
const DEFAULT_TIMEOUT_MS = 10000; // Increased to 10s for reliability
const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_ESTIMATED_COST = 0.0001;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Gemini request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

async function normalizeImageData(image: File | Blob | string): Promise<string> {
  if (typeof image === 'string') {
    return image.replace(/^data:image\/[a-z]+;base64,/, '');
  }

  const buffer = await image.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

export async function detectWithGemini(
  request: GeminiDetectionRequest,
  options: GeminiOptions = {}
): Promise<{ data: GeminiResult | null; error: Error | null }> {
  const startTime = Date.now();
  const configuredTimeout = process.env.GEMINI_VLM_TIMEOUT_MS
    ? Number(process.env.GEMINI_VLM_TIMEOUT_MS)
    : undefined;
  const timeoutMs =
    configuredTimeout && Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_TIMEOUT_MS;

  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return {
        data: null,
        error: new Error('GOOGLE_GEMINI_API_KEY not configured'),
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = options.model || DEFAULT_MODEL;
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const imageData = await normalizeImageData(request.imageData);

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
    const result = await withTimeout(
      model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageData,
            mimeType: 'image/jpeg',
          },
        },
      ]),
      timeoutMs
    );

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
        estimatedCost: DEFAULT_ESTIMATED_COST,
        provider: 'google-gemini-2.5-flash',
        modelVersion: modelName,
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

export async function detectChecklistWithGemini(
  request: GeminiChecklistRequest,
  options: GeminiOptions = {}
): Promise<{ data: GeminiChecklistResult | null; error: Error | null }> {
  const startTime = Date.now();
  const configuredTimeout = process.env.GEMINI_VLM_TIMEOUT_MS
    ? Number(process.env.GEMINI_VLM_TIMEOUT_MS)
    : undefined;
  const timeoutMs =
    configuredTimeout && Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_TIMEOUT_MS;

  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return {
        data: null,
        error: new Error('GOOGLE_GEMINI_API_KEY not configured'),
      };
    }

    if (!request.remainingItems || request.remainingItems.length === 0) {
      return {
        data: {
          items: [],
          processingTimeMs: 0,
          estimatedCost: 0,
          provider: 'google-gemini-2.5-flash',
          modelVersion: options.model || DEFAULT_MODEL,
          frameNumber: request.frameNumber ?? 1,
        },
        error: null,
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = options.model || DEFAULT_MODEL;
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const imageData = await normalizeImageData(request.imageData);
    const frameNumber = request.frameNumber ?? 1;

    const remainingItemsList = request.remainingItems
      .map((item, index) => `${index + 1}. ${item}`)
      .join('\n');

    const verifiedItemsList =
      request.verifiedItems && request.verifiedItems.length > 0
        ? request.verifiedItems.join(', ')
        : 'none';

    const priorDetectionsSummary =
      request.priorDetections && request.priorDetections.length > 0
        ? request.priorDetections
            .map((item) => {
              const confidence =
                typeof item.confidence === 'number'
                  ? `@${Math.round(item.confidence * 100)}%`
                  : '';
              return `${item.name}=${item.status}${confidence}`;
            })
            .join('; ')
        : '[]';

    const lightingHint = request.lightingHint || 'unknown';
    const bboxHint = request.bboxHints || 'none';

    const prompt = `You are verifying job equipment for a field service crew. Respond ONLY with valid JSON matching the provided schema.

Frame #${frameNumber}
Lighting: ${lightingHint}
Region hints: ${bboxHint}

Remaining items (use exact names):
${remainingItemsList}

Already verified items:
${verifiedItemsList}

Recent detections summary:
${priorDetectionsSummary}

Instructions:
1. Evaluate ONLY the remaining items listed above.
2. For each item, return an object with keys: name, status, confidence, note.
3. status MUST be one of: "present", "uncertain", "missing".
4. Use the item name EXACTLY as provided—match case and spacing.
5. confidence must be 0-1. note must be <= 20 characters.
6. If an item is not clearly visible, mark it "missing" (or "uncertain" if partially visible).
7. If nothing is visible, respond with an empty items array.

Respond as JSON:
{
  "frame": ${frameNumber},
  "items": [
    {
      "name": "Leaf Blower",
      "status": "present",
      "confidence": 0.82,
      "note": "orange blower"
    }
  ],
  "provider": "gemini-2.5-flash"
}`;

    console.log('\n========== GEMINI CHECKLIST PROMPT ==========');
    console.log(prompt);
    console.log('=============================================\n');

    const result = await withTimeout(
      model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageData,
            mimeType: 'image/jpeg',
          },
        },
      ]),
      timeoutMs
    );

    const response = result.response;
    const text = response.text();

    console.log('\n========== GEMINI CHECKLIST RESPONSE ==========');
    console.log(text || '(empty response)');
    console.log('===============================================\n');

    if (!text) {
      return {
        data: null,
        error: new Error('No response from Gemini'),
      };
    }

    const parsed = JSON.parse(text);
    const itemsRaw: any[] = Array.isArray(parsed.items) ? parsed.items : [];
    const normalizedItems: GeminiChecklistItem[] = itemsRaw.map((item) => ({
      name: item.name || '',
      status:
        item.status === 'present' || item.status === 'missing' || item.status === 'uncertain'
          ? item.status
          : 'missing',
      confidence:
        typeof item.confidence === 'number'
          ? Math.max(0, Math.min(1, item.confidence))
          : undefined,
      note: typeof item.note === 'string' ? item.note.slice(0, 40) : undefined,
    }));

    const processingTimeMs = Date.now() - startTime;

    return {
      data: {
        items: normalizedItems,
        processingTimeMs,
        estimatedCost: DEFAULT_ESTIMATED_COST,
        provider: 'google-gemini-2.5-flash',
        modelVersion: modelName,
        frameNumber,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[Gemini Checklist] Error:', err);
    return {
      data: null,
      error: new Error(`Gemini checklist detection failed: ${err.message}`),
    };
  }
}

export function isGeminiAvailable(): boolean {
  return !!process.env.GOOGLE_GEMINI_API_KEY;
}
