/**
 * @file /src/domains/vision/lib/openai-vision-adapter.ts
 * @phase 3.4
 * @domain Vision
 * @purpose OpenAI GPT-4 Vision adapter for kit verification fallback
 * @complexity_budget 300
 * @test_coverage ≥80%
 * @dependencies openai
 */

import OpenAI from 'openai';
import { VlmRequest, VlmResult, VlmDetection } from './vlm-fallback-router';
import { estimateVlmCost } from './cost-estimator';

const MODEL = 'gpt-4-vision-preview';
const MAX_TOKENS = 1000;
const DETAIL_LEVEL: 'low' | 'high' | 'auto' = 'high';
const PROVIDER = 'openai-gpt4-vision';

let openaiClient: OpenAI | null = null;

/**
 * Initialize OpenAI client (lazy initialization)
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }
    // Allow browser environment in test/development
    const isTestOrDev = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: isTestOrDev
    });
  }
  return openaiClient;
}

/**
 * Convert ImageData to base64 data URL for OpenAI
 */
function imageDataToBase64(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Build prompt for kit verification
 */
function buildVerificationPrompt(request: VlmRequest): string {
  const itemsList = request.expectedItems.join(', ');

  return `You are a visual AI assistant helping verify field service equipment kits.

TASK: Analyze this photo and identify which of the following items are present:
${request.expectedItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

INSTRUCTIONS:
- Look carefully for each item in the list above
- For each item you find, provide confidence (0.0-1.0) and reasoning
- Be conservative - only report items you're confident about (>0.5 confidence)
- Consider partial visibility, angles, and lighting conditions
- Look for equipment containers, toolboxes, or storage areas

${request.context ? `CONTEXT: ${request.context}` : ''}

Respond in this exact JSON format:
{
  "detections": [
    {
      "itemType": "item name from list",
      "confidence": 0.85,
      "reasoning": "why you think this item is present",
      "matchedExpectedItem": "exact item name from list"
    }
  ],
  "overallAssessment": "brief summary of what you see"
}`;
}

/**
 * Parse OpenAI response into structured detections
 */
function parseVlmResponse(content: string): VlmDetection[] {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                     content.match(/```\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonString);

    if (!parsed.detections || !Array.isArray(parsed.detections)) {
      console.warn('[OpenAI Vision] Response missing detections array:', content);
      return [];
    }

    return parsed.detections.map((d: any) => ({
      source: 'cloud_vlm' as const,
      itemType: d.itemType || d.item_type || 'unknown',
      confidence: Math.max(0, Math.min(1, parseFloat(d.confidence) || 0)),
      reasoning: d.reasoning || d.reason || 'No reasoning provided',
      matchedExpectedItem: d.matchedExpectedItem || d.matched_expected_item,
      provider: PROVIDER,
      modelVersion: MODEL,
    }));
  } catch (error) {
    console.error('[OpenAI Vision] Failed to parse response:', error);
    console.error('[OpenAI Vision] Raw content:', content);
    return [];
  }
}

/**
 * Call OpenAI GPT-4 Vision API for kit verification
 */
export async function callOpenAIVision(request: VlmRequest): Promise<VlmResult> {
  const startTime = Date.now();

  try {
    const client = getOpenAIClient();

    // Convert ImageData to base64
    const imageBase64 = imageDataToBase64(request.imageData);

    // Build prompt
    const prompt = buildVerificationPrompt(request);

    console.log(`[OpenAI Vision] Sending request for kit ${request.kitId} with ${request.expectedItems.length} expected items`);

    // Call OpenAI API
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
                detail: DETAIL_LEVEL
              }
            }
          ]
        }
      ]
    });

    const processingTime = Date.now() - startTime;

    // Extract response
    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      throw new Error('OpenAI returned empty response');
    }

    // Parse detections
    const detections = parseVlmResponse(messageContent);

    // Calculate cost
    const tokensUsed = response.usage?.total_tokens || 0;
    const estimatedCost = estimateVlmCost(request.imageData.width, request.imageData.height, tokensUsed);

    console.log(`[OpenAI Vision] Completed in ${processingTime}ms, ${detections.length} detections, $${estimatedCost.toFixed(4)} cost`);

    return {
      source: 'cloud_vlm',
      detections,
      processingTimeMs: processingTime,
      estimatedCostUsd: estimatedCost,
      provider: PROVIDER,
      modelVersion: MODEL,
      tokensUsed,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[OpenAI Vision] Request failed:', error);

    // Return empty result on error
    return {
      source: 'cloud_vlm',
      detections: [],
      processingTimeMs: processingTime,
      estimatedCostUsd: 0,
      provider: PROVIDER,
      modelVersion: MODEL,
    };
  }
}

/**
 * Test OpenAI connection without consuming quota
 */
export async function testOpenAIConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    const client = getOpenAIClient();

    // Simple test request
    await client.models.retrieve(MODEL);

    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Clear cached client (for testing)
 */
export function clearOpenAIClient(): void {
  openaiClient = null;
}
