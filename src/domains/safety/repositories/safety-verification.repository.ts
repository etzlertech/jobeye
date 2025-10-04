/**
 * @file src/domains/safety/repositories/safety-verification.repository.ts
 * @phase 3
 * @domain safety
 * @purpose Persistence adapter for SafetyVerificationService leveraging vision verification tables.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T064
 * @complexity_budget 200 LoC
 * @dependencies
 *   internal:
 *     - @/domains/vision/repositories/vision-verification.repository.class
 *     - @/domains/vision/repositories/detected-item.repository.class
 *     - @/core/logger/voice-logger
 *   external:
 *     - @supabase/supabase-js
 * @exports
 *   - SafetyVerificationRepository
 * @voice_considerations
 *   - Logs persistence issues so technicians can be informed when verification history is unavailable.
 * END AGENT DIRECTIVE BLOCK
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { voiceLogger } from '@/core/logger/voice-logger';
import {
  VisionVerificationRepository,
} from '@/domains/vision/repositories/vision-verification.repository.class';
import {
  DetectedItemRepository,
} from '@/domains/vision/repositories/detected-item.repository.class';
import type {
  SafetyVerificationPersistencePayload,
  SafetyVerificationResult,
  SafetyChecklistItem,
  SafetyDetection,
} from '@/domains/safety/services/safety-verification.types';

export interface SafetyVerificationRecordOptions {
  tenantId: string;
  jobId: string;
  checklist: SafetyChecklistItem;
  result: SafetyVerificationResult;
  rawDetections: SafetyDetection[];
}

export class SafetyVerificationRepository {
  private readonly visionRepo: VisionVerificationRepository;
  private readonly detectedItemRepo: DetectedItemRepository;

  constructor(private readonly supabaseClient: SupabaseClient) {
    this.visionRepo = new VisionVerificationRepository(supabaseClient);
    this.detectedItemRepo = new DetectedItemRepository(supabaseClient);
  }

  async record(payload: SafetyVerificationPersistencePayload): Promise<void> {
    const tenantId = payload.context?.tenantId;
    const jobId = payload.context?.jobId;

    if (!tenantId || !jobId) {
      voiceLogger.warn('Safety verification persistence skipped: tenantId or jobId missing', {
        tenantId,
        jobId,
      });
      return;
    }

    try {
      const verification = await this.visionRepo.create({
        tenantId,
        kitId: payload.checklist.id,
        jobId,
        verificationResult: payload.result.verified ? 'complete' : 'failed',
        processingMethod: payload.result.fallbackUsed ? 'cloud_vlm' : 'local_yolo',
        confidenceScore: payload.result.confidence,
        detectionCount: payload.result.detectedSamples.length,
        expectedCount: payload.checklist.requiredLabels.length,
        processingTimeMs: 0,
        costUsd: 0,
        metadata: this.buildMetadata(payload),
        verifiedAt: payload.result.analyzedAt,
      });

      await this.persistDetections(verification.id, payload);
    } catch (error: any) {
      voiceLogger.error('Failed to persist safety verification record', {
        error: error?.message ?? error,
      });
    }
  }

  private buildMetadata(payload: SafetyVerificationPersistencePayload) {
    return {
      matchedLabels: payload.result.matchedLabels,
      missingLabels: payload.result.missingLabels,
      fallbackUsed: payload.result.fallbackUsed,
      explanation: payload.result.explanation,
    };
  }

  private async persistDetections(
    verificationId: string,
    payload: SafetyVerificationPersistencePayload
  ): Promise<void> {
    const matchedSet = new Set(
      payload.result.matchedLabels.map((label) => label.toLowerCase())
    );

    const createPromises = payload.rawDetections.map((detection) =>
      this.detectedItemRepo.create({
        verificationId,
        itemType: detection.label,
        itemName: detection.label,
        confidenceScore: detection.confidence,
        matchStatus: matchedSet.has(detection.label.toLowerCase())
          ? 'matched'
          : 'unmatched',
        boundingBox: detection.bbox
          ? {
              x: detection.bbox.x,
              y: detection.bbox.y,
              width: detection.bbox.width,
              height: detection.bbox.height,
            }
          : undefined,
        metadata: {},
      })
    );

    await Promise.allSettled(createPromises);

    // Record any expected but missing labels as unmatched entries for traceability
    const missing = payload.result.missingLabels || [];
    const missingPromises = missing.map((label) =>
      this.detectedItemRepo.create({
        verificationId,
        itemType: label,
        confidenceScore: 0,
        matchStatus: 'unmatched',
        metadata: { synthetic: true },
      })
    );

    await Promise.allSettled(missingPromises);
  }
}
