/**
 * VLM Detection API Endpoint
 * Uses Gemini 2.5 Flash for fast, accurate object detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectChecklistWithGemini } from '@/domains/vision/services/gemini-vlm.service';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();

  try {
    console.log(`[VLM API ${requestId}] ${timestamp} - Request received`);

    const body = await request.json();
    const {
      imageData,
      remainingItems,
      verifiedItems,
      priorDetections,
      frameNumber,
      lightingHint,
      bboxHints,
      expectedItems, // legacy field fallback
    } = body;

    const checklistItems: string[] =
      Array.isArray(remainingItems) && remainingItems.length > 0
        ? remainingItems
        : Array.isArray(expectedItems)
          ? expectedItems
          : [];

    console.log(`[VLM API ${requestId}] Remaining items:`, checklistItems);
    console.log(`[VLM API ${requestId}] Verified items:`, verifiedItems);

    if (!imageData) {
      console.error(`[VLM API ${requestId}] Missing imageData`);
      return NextResponse.json(
        { error: 'Missing imageData' },
        { status: 400 }
      );
    }

    if (checklistItems.length === 0) {
      console.warn(`[VLM API ${requestId}] No remaining items to verify`);
      return NextResponse.json({
        items: [],
        processingTimeMs: 0,
        estimatedCost: 0,
        provider: 'google-gemini-2.5-flash',
        modelVersion: 'gemini-2.5-flash',
        frameNumber: frameNumber ?? 1,
      });
    }

    // Call Gemini 2.5 Flash checklist verifier
    const serviceStart = performance.now();
    const { data, error } = await detectChecklistWithGemini({
      imageData,
      remainingItems: checklistItems,
      verifiedItems: Array.isArray(verifiedItems) ? verifiedItems : [],
      priorDetections: Array.isArray(priorDetections) ? priorDetections : [],
      frameNumber,
      lightingHint,
      bboxHints,
    }, {
      model: 'gemini-2.5-flash',
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
      itemCount: data.items.length,
      items: data.items,
      processingTimeMs: data.processingTimeMs,
      cost: data.estimatedCost
    });

    const legacyDetections = data.items.map((item) => ({
      label: item.name,
      confidence: item.confidence ?? 0,
      source: item.status,
      status: item.status,
      note: item.note,
    }));

    return NextResponse.json({
      items: data.items,
      detections: legacyDetections,
      processingTimeMs: data.processingTimeMs,
      estimatedCost: data.estimatedCost,
      provider: data.provider,
      modelVersion: data.modelVersion,
      frameNumber: data.frameNumber,
      winner: 'gemini',
      geminiTimeMs: data.processingTimeMs,
      geminiSuccess: true,
      gpt4TimeMs: null,
      gpt4Success: false,
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
