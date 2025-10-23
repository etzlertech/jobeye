/**
 * VLM Detection API Endpoint
 * Uses Gemini 2.0 Flash for fast, accurate object detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectWithGemini } from '@/domains/vision/services/gemini-vlm.service';

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

    // Call Gemini 2.0 Flash (fast, accurate, cheap)
    const serviceStart = performance.now();
    const { data, error } = await detectWithGemini({
      imageData,
      expectedItems: expectedItems || [],
    }, {
      includeBboxes: includeBboxes ?? true,
      model: 'gemini-2.0-flash', // Switched from flash-exp due to rate limits (2K RPM, unlimited RPD)
    });
    const serviceDuration = performance.now() - serviceStart;

    console.log(`[VLM API ${requestId}] Gemini completed in ${serviceDuration.toFixed(0)}ms`);

    if (error) {
      console.error(`[VLM API ${requestId}] Gemini detection error:`, {
        message: error.message,
        stack: error.stack
      });
      const statusCode = error.message?.toLowerCase().includes('timed out') ? 504 : 500;
      return NextResponse.json(
        { error: error.message },
        { status: statusCode }
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
      provider: data.provider,
      model: data.modelVersion,
      detectionCount: data.detections.length,
      detections: data.detections.map(d => ({
        label: d.label,
        confidence: d.confidence,
        hasBbox: !!d.bbox
      })),
      processingTimeMs: data.processingTimeMs,
      cost: data.estimatedCost
    });

    return NextResponse.json({
      detections: data.detections,
      processingTimeMs: data.processingTimeMs,
      estimatedCost: data.estimatedCost,
      provider: data.provider,
      modelVersion: data.modelVersion,
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
