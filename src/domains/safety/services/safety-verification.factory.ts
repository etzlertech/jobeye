/**
 * @file src/domains/safety/services/safety-verification.factory.ts
 * @phase 3
 * @domain safety
 * @purpose Factory helpers for constructing SafetyVerificationService with default YOLO/VLM clients.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T064
 * @complexity_budget 150 LoC
 * @dependencies
 *   internal:
 *     - @/domains/vision/services/yolo-inference.service
 *     - @/domains/intake/services/business-card-ocr.vision
 *     - ./safety-verification.service
 * @exports
 *   - createSafetyVerificationService
 *   - createDefaultSafetyVerificationDependencies
 * @voice_considerations
 *   - Warns when fallbacks are unavailable so technicians can be notified.
 * END AGENT DIRECTIVE BLOCK
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { detectObjects } from '@/domains/vision/services/yolo-inference.service';
import { createVisionBusinessCardClient } from '@/domains/intake/services/business-card-ocr.vision';
import type {
  SafetyVerificationDependencies,
  SafetyChecklistItem,
  SafetyVlmClientResponse,
  SafetyVerificationContext,
} from './safety-verification.types';
import { SafetyVerificationService } from './safety-verification.service';
import { voiceLogger } from '@/core/logger/voice-logger';
import { SafetyVerificationRepository } from '@/domains/safety/repositories/safety-verification.repository';

export interface SafetyVerificationFactoryOptions {
  supabaseClient?: SupabaseClient;
  repository?: SafetyVerificationRepository;
  confidenceThreshold?: number;
  fallbackConfidenceThreshold?: number;
  vision?: {
    model?: string;
    apiKey?: string;
  };
  logger?: SafetyVerificationDependencies['logger'];
  now?: SafetyVerificationDependencies['now'];
}

export function createSafetyVerificationService(
  options: SafetyVerificationFactoryOptions = {}
): SafetyVerificationService {
  const deps = createDefaultSafetyVerificationDependencies(options);
  return new SafetyVerificationService(deps);
}

export function createDefaultSafetyVerificationDependencies(
  options: SafetyVerificationFactoryOptions = {}
): SafetyVerificationDependencies {
  const yoloClient = {
    async detect(image: Blob, detectOptions?: { confidenceThreshold?: number }) {
      const { data, error } = await detectObjects(image, {
        confidenceThreshold: detectOptions?.confidenceThreshold,
      });
      if (error || !data) {
        throw error ?? new Error('YOLO detection failed');
      }

      return {
        detections: data.detections.map((detection) => ({
          label: detection.label,
          confidence: detection.confidence,
          bbox: detection.bbox,
        })),
        processingTimeMs: data.processingTimeMs,
        modelVersion: data.modelVersion,
      };
    },
  } satisfies SafetyVerificationDependencies['yoloClient'];

  const visionFallbackClient = createVisionBusinessCardClient({
    model: options.vision?.model,
    apiKey: options.vision?.apiKey,
  });

  const vlmClient = {
    async evaluate(image: Blob, checklist: SafetyChecklistItem) {
      const response = await visionFallbackClient.analyzeBusinessCard(image);
      if (!response) {
        return null;
      }

      const matchedLabels = response.name
        ? [response.name.toLowerCase()]
        : response.rawText
        ? checklist.requiredLabels.filter((label) =>
            response.rawText?.toLowerCase().includes(label.toLowerCase())
          )
        : [];

      const missingLabels = checklist.requiredLabels.filter((label) =>
        !matchedLabels.includes(label.toLowerCase())
      );

      const result: SafetyVlmClientResponse = {
        verified: missingLabels.length === 0,
        confidence: response.confidence ?? 0.75,
        matchedLabels,
        missingLabels,
        explanation: response.rawText,
      };

      return result;
    },
  } satisfies SafetyVerificationDependencies['vlmClient'];

  const repository =
    options.repository ??
    (options.supabaseClient
      ? new SafetyVerificationRepository(options.supabaseClient)
      : undefined);

  return {
    yoloClient,
    vlmClient,
    confidenceThreshold: options.confidenceThreshold,
    fallbackConfidenceThreshold: options.fallbackConfidenceThreshold,
    logger: options.logger ?? voiceLogger,
    now: options.now,
    persistResult: repository
      ? async (payload) => {
          await repository.record(payload);
        }
      : undefined,
  } satisfies SafetyVerificationDependencies;
}
