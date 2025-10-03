/**
 * @file /src/domains/inventory/services/detection-orchestrator.service.ts
 * @phase 3.6
 * @domain Inventory
 * @purpose Orchestrates full detection pipeline: YOLO → user confirmation → VLM fallback
 * @complexity_budget 300
 * @feature 004-voice-vision-inventory
 *
 * Detection orchestration flow:
 * 1. Run YOLO detection (client-side, free)
 * 2. Generate crops for detected objects
 * 3. User confirms selections
 * 4. If confidence low or user requests, trigger VLM fallback
 * 5. Return matched inventory items
 */

import * as detectionSessionService from '../../vision/services/detection-session.service';
import * as yoloInferenceService from '../../vision/services/yolo-inference.service';
import * as vlmFallbackService from '../../vision/services/vlm-fallback.service';
import * as inventoryItemsRepo from '../repositories/inventory-items.repository';
import type { InventoryItem } from '../types/inventory-types';

export interface DetectionRequest {
  tenantId: string;
  userId: string;
  imageSource: HTMLImageElement | File | Blob | string;
  imageUrl: string; // For session storage
  expectedItems?: string[]; // Item names to look for
  jobId?: string;
  locationId?: string;
  context?: string;
}

export interface DetectionCandidate {
  id: string;
  label: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cropDataUrl: string;
  matchedItems: InventoryItem[];
}

export interface DetectionResult {
  sessionId: string;
  method: 'yolo' | 'vlm';
  candidates: DetectionCandidate[];
  processingTimeMs: number;
  estimatedCost: number;
}

const CONFIDENCE_THRESHOLD = 0.7;
const MIN_DETECTIONS = 1;

/**
 * Run full detection pipeline
 */
export async function detectInventoryItems(
  request: DetectionRequest
): Promise<{ data: DetectionResult | null; error: Error | null }> {
  const startTime = Date.now();

  try {
    // Step 1: Create detection session
    const sessionResult = await detectionSessionService.createSession(
      request.tenantId,
      request.userId,
      request.imageUrl,
      {
        jobId: request.jobId,
        locationId: request.locationId,
        metadata: {
          expectedItems: request.expectedItems,
          context: request.context,
        },
      }
    );

    if (sessionResult.error || !sessionResult.data) {
      return {
        data: null,
        error:
          sessionResult.error || new Error('Failed to create detection session'),
      };
    }

    const session = sessionResult.data;

    // Step 2: Run YOLO detection
    const yoloResult = await yoloInferenceService.detectObjects(
      request.imageSource,
      {
        confidenceThreshold: CONFIDENCE_THRESHOLD,
        maxDetections: 20,
      }
    );

    if (yoloResult.error || !yoloResult.data) {
      return {
        data: null,
        error: yoloResult.error || new Error('YOLO detection failed'),
      };
    }

    // Step 3: Process YOLO detections and generate crops
    const processResult =
      await detectionSessionService.processYoloDetections(
        session.id,
        request.imageSource,
        yoloResult.data.detections
      );

    if (processResult.error || !processResult.data) {
      return {
        data: null,
        error: processResult.error || new Error('Failed to process detections'),
      };
    }

    const { candidates } = processResult.data;

    // Step 4: Match detected labels to inventory items
    const candidatesWithMatches = await Promise.all(
      candidates.map(async (candidate) => {
        const matches = await matchLabelToItems(
          request.tenantId,
          candidate.label || ''
        );

        return {
          id: candidate.id,
          label: candidate.label || 'unknown',
          confidence: candidate.confidence,
          bbox: candidate.bbox,
          cropDataUrl: candidate.crop.dataUrl,
          matchedItems: matches,
        };
      })
    );

    // Step 5: Check if fallback is needed
    const avgConfidence =
      candidates.length > 0
        ? candidates.reduce((sum, c) => sum + c.confidence, 0) / candidates.length
        : 0;

    const needsFallback =
      avgConfidence < CONFIDENCE_THRESHOLD ||
      candidates.length < MIN_DETECTIONS ||
      (request.expectedItems && candidates.length < request.expectedItems.length);

    if (needsFallback && vlmFallbackService.isAvailable()) {
      // Trigger VLM fallback
      return await fallbackToVlm(
        session.id,
        request,
        candidatesWithMatches,
        startTime
      );
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      data: {
        sessionId: session.id,
        method: 'yolo',
        candidates: candidatesWithMatches,
        processingTimeMs,
        estimatedCost: 0,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(`Detection orchestration failed: ${err.message}`),
    };
  }
}

/**
 * Fallback to VLM when YOLO is insufficient
 */
async function fallbackToVlm(
  sessionId: string,
  request: DetectionRequest,
  yoloCandidates: DetectionCandidate[],
  startTime: number
): Promise<{ data: DetectionResult | null; error: Error | null }> {
  try {
    // Mark session as pending VLM
    await detectionSessionService.requestVlmFallback(
      sessionId,
      'Low YOLO confidence or missing expected items'
    );

    // Run VLM detection
    const vlmResult = await vlmFallbackService.detectWithVlm(
      {
        imageData: request.imageSource as File | Blob | string,
        expectedItems: request.expectedItems,
        context: request.context,
      },
      {
        includeBboxes: true,
      }
    );

    if (vlmResult.error || !vlmResult.data) {
      return {
        data: null,
        error: vlmResult.error || new Error('VLM detection failed'),
      };
    }

    // Convert VLM detections to candidates
    const vlmCandidates = await Promise.all(
      vlmResult.data.detections.map(async (detection, idx) => {
        const matches = await matchLabelToItems(
          request.tenantId,
          detection.label
        );

        return {
          id: `vlm-${idx}`,
          label: detection.label,
          confidence: detection.confidence,
          bbox: detection.bbox || { x: 0, y: 0, width: 0, height: 0 },
          cropDataUrl: '', // No crop for VLM detections
          matchedItems: matches,
        };
      })
    );

    // Update session with VLM results
    await detectionSessionService.completeVlmFallback(sessionId, {
      detections: vlmResult.data.detections.map((d) => ({
        label: d.label,
        confidence: d.confidence,
        bbox: d.bbox,
      })),
      totalCost: vlmResult.data.estimatedCost,
    });

    const processingTimeMs = Date.now() - startTime;

    return {
      data: {
        sessionId,
        method: 'vlm',
        candidates: vlmCandidates,
        processingTimeMs,
        estimatedCost: vlmResult.data.estimatedCost,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(`VLM fallback failed: ${err.message}`),
    };
  }
}

/**
 * Match detected label to inventory items
 */
async function matchLabelToItems(
  tenantId: string,
  label: string
): Promise<InventoryItem[]> {
  if (!label || label === 'unknown') {
    return [];
  }

  // Search by name or category
  const result = await inventoryItemsRepo.findAll({
    tenantId,
    search: label,
    limit: 5,
  });

  if (result.error) {
    return [];
  }

  return result.data;
}

/**
 * Confirm user selections and update session
 */
export async function confirmSelections(
  sessionId: string,
  selectedCandidateIds: string[]
): Promise<{ error: Error | null }> {
  return await detectionSessionService.updateSelection(
    sessionId,
    selectedCandidateIds
  );
}