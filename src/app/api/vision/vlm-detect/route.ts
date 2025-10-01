/**
 * VLM Detection API Endpoint
 * Accepts base64 image and returns detected items with bounding boxes
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectWithDualVlm } from '@/domains/vision/services/dual-vlm.service';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();

  try {
    console.log(`[VLM API ${requestId}] ${timestamp} - Request received`);

    const body = await request.json();
    const { imageData, expectedItems, includeBboxes } = body;

    console.log(`[VLM API ${requestId}] Expected items:`, expectedItems);
    console.log(`[VLM API ${requestId}] Include bboxes:`, includeBboxes);

    if (!imageData) {
      console.error(`[VLM API ${requestId}] Missing imageData`);
      return NextResponse.json(
        { error: 'Missing imageData' },
        { status: 400 }
      );
    }

    // Call Dual VLM service (GPT-4 + Gemini in parallel)
    const serviceStart = performance.now();
    const { data, error } = await detectWithDualVlm({
      imageData,
      expectedItems: expectedItems || [],
      includeBboxes: includeBboxes ?? true,
    });
    const serviceDuration = performance.now() - serviceStart;

    console.log(`[VLM API ${requestId}] Dual VLM completed in ${serviceDuration.toFixed(0)}ms`);

    if (error) {
      console.error(`[VLM API ${requestId}] VLM detection error:`, {
        message: error.message,
        stack: error.stack
      });
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      console.error(`[VLM API ${requestId}] No detection data returned`);
      return NextResponse.json(
        { error: 'No detection data returned' },
        { status: 500 }
      );
    }

    console.log(`[VLM API ${requestId}] Success:`, {
      winner: data.winner,
      detectionCount: data.detections.length,
      detections: data.detections.map(d => ({
        label: d.label,
        confidence: d.confidence,
        source: d.source,
        hasBbox: !!d.bbox
      })),
      gpt4TimeMs: data.gpt4TimeMs,
      geminiTimeMs: data.geminiTimeMs,
      gpt4Success: data.gpt4Success,
      geminiSuccess: data.geminiSuccess,
      cost: data.estimatedCost
    });

    return NextResponse.json({
      detections: data.detections,
      processingTimeMs: data.totalTimeMs,
      estimatedCost: data.estimatedCost,
      winner: data.winner,
      gpt4TimeMs: data.gpt4TimeMs,
      geminiTimeMs: data.geminiTimeMs,
      gpt4Success: data.gpt4Success,
      geminiSuccess: data.geminiSuccess,
    });
  } catch (err: any) {
    console.error(`[VLM API ${requestId}] API error:`, {
      message: err.message,
      stack: err.stack
    });
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
