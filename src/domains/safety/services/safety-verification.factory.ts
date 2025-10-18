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
import { detectWithRemoteYolo, isRemoteYoloConfigured, RemoteYoloConfig } from '@/domains/vision/services/yolo-remote-client';
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
  yolo?: {
    endpoint?: string;
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
    maxDetections?: number;
  };
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
  const logger = options.logger ?? voiceLogger;

  const remoteYoloConfig = resolveRemoteYoloConfig(options);

  const yoloClient = remoteYoloConfig
    ? {
        async detect(image: Blob, detectOptions?: { confidenceThreshold?: number }) {
          const result = await detectWithRemoteYolo(image, remoteYoloConfig, {
            confidenceThreshold: detectOptions?.confidenceThreshold,
            maxDetections: remoteYoloConfig.maxDetections,
          });

          return {
            detections: result.detections.map((detection) => ({
              label: detection.itemType,
              confidence: detection.confidence,
              bbox: detection.boundingBox
                ? {
                    x: detection.boundingBox.x,
                    y: detection.boundingBox.y,
                    width: detection.boundingBox.width,
                    height: detection.boundingBox.height,
                  }
                : undefined,
            })),
            processingTimeMs: result.processingTimeMs ?? 0,
            modelVersion: result.modelVersion ?? remoteYoloConfig.model ?? 'remote-yolo',
          };
        },
      }
    : {
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
              bbox: detection.bbox
                ? {
                    x: detection.bbox.x,
                    y: detection.bbox.y,
                    width: detection.bbox.width,
                    height: detection.bbox.height,
                  }
                : undefined,
            })),
            processingTimeMs: data.processingTimeMs,
            modelVersion: data.modelVersion,
          };
        },
      } satisfies SafetyVerificationDependencies['yoloClient'];

  if (!isRemoteYoloConfigured(remoteYoloConfig)) {
    logger.warn('Safety verification using fallback YOLO stub. Configure SAFETY_YOLO_ENDPOINT for production-grade detection.');
  }

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
        explanation: response.rawText ?? undefined,
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
    logger,
    now: options.now,
    persistResult: repository
      ? async (payload) => {
          await repository.record(payload);
        }
      : undefined,
  } satisfies SafetyVerificationDependencies;
}

function resolveRemoteYoloConfig(
  options: SafetyVerificationFactoryOptions
): RemoteYoloConfig | undefined {
  const endpoint =
    options.yolo?.endpoint ??
    process.env.SAFETY_YOLO_ENDPOINT ??
    process.env.VISION_YOLO_ENDPOINT;

  if (!endpoint) {
    return undefined;
  }

  const parsedTimeout = parseInt(
    options.yolo?.timeoutMs?.toString() ??
      process.env.SAFETY_YOLO_TIMEOUT_MS ??
      process.env.VISION_YOLO_TIMEOUT_MS ??
      '',
    10
  );

  return {
    endpoint,
    apiKey:
      options.yolo?.apiKey ??
      process.env.SAFETY_YOLO_API_KEY ??
      process.env.VISION_YOLO_API_KEY,
    model:
      options.yolo?.model ??
      process.env.SAFETY_YOLO_MODEL ??
      process.env.VISION_YOLO_MODEL,
    maxDetections: options.yolo?.maxDetections,
    timeoutMs: Number.isNaN(parsedTimeout) ? undefined : parsedTimeout,
  } satisfies RemoteYoloConfig;
}
