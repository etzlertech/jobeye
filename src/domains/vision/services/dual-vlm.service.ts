/**
 * Cascade VLM service - tries Gemini first, GPT-4 fallback only on failure
 * Cost optimization: 99% savings by avoiding expensive GPT-4 calls
 */

import { detectWithVlm, type VlmDetectionRequest, type VlmResult } from './vlm-fallback.service';
import { detectWithGemini, type GeminiDetectionRequest, type GeminiResult } from './gemini-vlm.service';
import type { BoundingBox } from './crop-generator.service';

export interface DualVlmDetection {
  label: string;
  confidence: number;
  reasoning?: string;
  bbox?: BoundingBox;
  matchedExpectedItem?: string;
  source: 'gpt4' | 'gemini' | 'both';
}

export interface DualVlmResult {
  detections: DualVlmDetection[];
  winner: 'gpt4' | 'gemini' | 'tie';
  gpt4TimeMs?: number;
  geminiTimeMs?: number;
  totalTimeMs: number;
  gpt4Success: boolean;
  geminiSuccess: boolean;
  estimatedCost: number;
}

export interface DualVlmRequest {
  imageData: File | Blob | string;
  expectedItems?: string[];
  includeBboxes?: boolean;
  minConfidence?: number; // Minimum confidence threshold (default: 0.65)
}

/**
 * Cascade detection: Try Gemini first (fast, cheap), GPT-4 only if Gemini fails
 */
export async function detectWithDualVlm(
  request: DualVlmRequest
): Promise<{ data: DualVlmResult | null; error: Error | null }> {
  const startTime = Date.now();
  const minConfidence = request.minConfidence ?? 0.70; // Increased to 70% to reduce false positives

  console.log('[Cascade VLM] 🚀 Starting Gemini detection (fast & cheap)...');

  // Step 1: Try Gemini first (1-2 seconds, $0.001)
  const geminiResult = await detectWithGemini(
    {
      imageData: request.imageData,
      expectedItems: request.expectedItems,
    },
    {
      includeBboxes: request.includeBboxes ?? true,
    }
  );

  const geminiData = geminiResult.data;
  const geminiError = geminiResult.error;
  const geminiSuccess = !!geminiData && !geminiError;

  console.log('[Cascade VLM] Gemini result:', {
    success: geminiSuccess,
    detections: geminiData?.detections.length || 0,
    timeMs: geminiData?.processingTimeMs,
    cost: geminiData?.estimatedCost,
  });

  // Filter by confidence threshold
  const geminiValidDetections = geminiSuccess
    ? geminiData!.detections.filter(d => d.confidence >= minConfidence)
    : [];

  console.log('[Cascade VLM] Gemini valid detections (>= ' + minConfidence + '):', geminiValidDetections.length);

  // Step 2: Only call GPT-4 if Gemini completely failed
  let gpt4Data: VlmResult | null = null;
  let gpt4Error: Error | null = null;
  let gpt4Success = false;

  if (!geminiSuccess || geminiValidDetections.length === 0) {
    console.log('[Cascade VLM] ⚠️ Gemini failed or found nothing - falling back to GPT-4...');

    const gpt4Result = await detectWithVlm(
      {
        imageData: request.imageData,
        expectedItems: request.expectedItems,
      },
      {
        includeBboxes: request.includeBboxes ?? true,
      }
    );

    gpt4Data = gpt4Result.data;
    gpt4Error = gpt4Result.error;
    gpt4Success = !!gpt4Data && !gpt4Error;

    console.log('[Cascade VLM] GPT-4 result:', {
      success: gpt4Success,
      detections: gpt4Data?.detections.length || 0,
      timeMs: gpt4Data?.processingTimeMs,
      cost: gpt4Data?.estimatedCost,
    });
  } else {
    console.log('[Cascade VLM] ✅ Gemini succeeded - skipping expensive GPT-4 call!');
  }

  const totalTimeMs = Date.now() - startTime;

  // If both failed, return error
  if (!geminiSuccess && !gpt4Success) {
    console.error('[Cascade VLM] ❌ Both VLMs failed');
    return {
      data: null,
      error: new Error('Both VLMs failed: Gemini: ' + (geminiError?.message || 'unknown') + ' | GPT-4: ' + (gpt4Error?.message || 'not attempted')),
    };
  }

  // Determine winner and map detections
  let winner: 'gpt4' | 'gemini' | 'tie' = 'gemini';
  let primaryDetections: DualVlmDetection[] = [];

  if (geminiSuccess && geminiValidDetections.length > 0) {
    // Gemini succeeded - use its detections
    winner = 'gemini';
    primaryDetections = geminiValidDetections.map(d => ({
      ...d,
      source: 'gemini' as const,
    }));
    console.log('[Cascade VLM] 🏆 Winner: Gemini (' + primaryDetections.length + ' items)');
  } else if (gpt4Success) {
    // Gemini failed, GPT-4 succeeded
    winner = 'gpt4';
    const gpt4ValidDetections = gpt4Data!.detections.filter(d => d.confidence >= minConfidence);
    primaryDetections = gpt4ValidDetections.map(d => ({
      ...d,
      source: 'gpt4' as const,
    }));
    console.log('[Cascade VLM] 🏆 Winner: GPT-4 (fallback - ' + primaryDetections.length + ' items)');
  }

  const estimatedCost = (geminiData?.estimatedCost || 0) + (gpt4Data?.estimatedCost || 0);

  console.log('[Cascade VLM] 💰 Total cost: $' + estimatedCost.toFixed(4));

  return {
    data: {
      detections: primaryDetections,
      winner,
      gpt4TimeMs: gpt4Data?.processingTimeMs,
      geminiTimeMs: geminiData?.processingTimeMs,
      totalTimeMs,
      gpt4Success,
      geminiSuccess,
      estimatedCost,
    },
    error: null,
  };
}
