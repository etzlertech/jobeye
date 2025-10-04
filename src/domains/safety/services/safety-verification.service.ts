/**
 * @file src/domains/safety/services/safety-verification.service.ts
 * @phase 3
 * @domain safety
 * @purpose Vision-driven safety checklist photo verification with YOLO primary and VLM fallback.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T064
 * @complexity_budget 300 LoC
 * @dependencies
 *   internal:
 *     - @/core/logger/voice-logger
 *     - ./safety-verification.types
 *     - ./safety-verification.helpers
 *   external: none (dependencies injected)
 * @exports
 *   - SafetyVerificationService
 *   - SafetyVerificationResult
 *   - SafetyVerificationDependencies
 * @voice_considerations
 *   - Service emits structured logs so voice agent can confirm verification status and confidence.
 * @test_requirements
 *   unit: src/__tests__/safety/safety-verification.service.test.ts
 *   integration: src/__tests__/safety/integration/safety-verification.integration.test.ts
 * END AGENT DIRECTIVE BLOCK
 */

import { voiceLogger } from '@/core/logger/voice-logger';
import {
  SafetyChecklistItem,
  SafetyVerificationDependencies,
  SafetyVerificationResult,
  SafetyVerificationContext,
  SafetyVerificationPersistencePayload,
} from './safety-verification.types';
import {
  clampConfidence,
  matchDetectionsToChecklist,
  summarizeDetections,
} from './safety-verification.helpers';

export { SafetyVerificationResult, SafetyVerificationDependencies } from './safety-verification.types';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;
const DEFAULT_FALLBACK_THRESHOLD = 0.75;

export class SafetyVerificationService {
  private readonly yoloClient = this.deps.yoloClient;
  private readonly vlmClient = this.deps.vlmClient;
  private readonly persist = this.deps.persistResult ?? defaultPersistResult;
  private readonly logger = this.deps.logger ?? voiceLogger;
  private readonly now: () => Date = this.deps.now ?? (() => new Date());
  private readonly yoloThreshold =
    this.deps.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  private readonly fallbackThreshold =
    this.deps.fallbackConfidenceThreshold ?? DEFAULT_FALLBACK_THRESHOLD;

  constructor(private readonly deps: SafetyVerificationDependencies) {
    if (!deps?.yoloClient?.detect) {
      throw new Error('SafetyVerificationService requires yoloClient.detect');
    }

    if (!deps?.vlmClient?.evaluate) {
      throw new Error('SafetyVerificationService requires vlmClient.evaluate');
    }
  }

  async verifyPhoto(
    photo: Blob,
    checklistItem: SafetyChecklistItem,
    context?: SafetyVerificationContext
  ): Promise<SafetyVerificationResult> {
    const startedAt = this.now().toISOString();
    this.logger.info('Safety verification started', {
      checklistItemId: checklistItem.id,
      labels: checklistItem.requiredLabels,
      startedAt,
    });

    const yoloResult = await this.yoloClient.detect(photo, {
      confidenceThreshold: this.yoloThreshold,
    });

    const matching = matchDetectionsToChecklist(
      yoloResult.detections,
      checklistItem,
      this.yoloThreshold
    );

    const yoloVerified =
      matching.missing.length === 0 && matching.bestConfidence >= this.yoloThreshold;

    let finalResult: SafetyVerificationResult;
    let fallbackUsed = false;

    if (yoloVerified) {
      finalResult = {
        verified: true,
        confidence: clampConfidence(matching.bestConfidence),
        matchedLabels: matching.matched.map((d) => d.label),
        missingLabels: [],
        fallbackUsed,
        explanation: 'YOLO detection satisfied all checklist requirements.',
        detectedSamples: matching.matched,
        analyzedAt: startedAt,
      };
    } else {
      this.logger.warn('YOLO detection insufficient, evaluating VLM fallback', {
        checklistItemId: checklistItem.id,
        missingLabels: matching.missing,
        detected: summarizeDetections(yoloResult.detections),
      });

      const vlmResponse = await this.vlmClient.evaluate(photo, checklistItem);
      fallbackUsed = true;

      if (vlmResponse && vlmResponse.verified && vlmResponse.confidence >= this.fallbackThreshold) {
        finalResult = {
          verified: true,
          confidence: clampConfidence(vlmResponse.confidence),
          matchedLabels: vlmResponse.matchedLabels,
          missingLabels: vlmResponse.missingLabels,
          fallbackUsed,
          explanation: vlmResponse.explanation ?? 'VLM confirmed checklist compliance.',
          detectedSamples: matching.matched,
          analyzedAt: startedAt,
        };
      } else {
        finalResult = {
          verified: false,
          confidence: clampConfidence(
            vlmResponse?.confidence ?? matching.bestConfidence
          ),
          matchedLabels: matching.matched.map((d) => d.label),
          missingLabels: vlmResponse?.missingLabels ?? matching.missing,
          fallbackUsed,
          explanation:
            vlmResponse?.explanation ??
            'Unable to confirm checklist compliance with available detections.',
          detectedSamples: matching.matched.length ? matching.matched : yoloResult.detections,
          analyzedAt: startedAt,
        };
      }
    }

    await this.persist({
      result: finalResult,
      context,
      checklist: checklistItem,
      rawDetections: yoloResult.detections,
    });

    this.logger.info('Safety verification completed', {
      checklistItemId: checklistItem.id,
      verified: finalResult.verified,
      confidence: finalResult.confidence,
      fallbackUsed,
    });

    return finalResult;
  }
}

async function defaultPersistResult(
  payload: SafetyVerificationPersistencePayload
): Promise<void> {
  voiceLogger.info('Safety verification persisted via stub', {
    checklistItemId: payload.checklist.id,
    verified: payload.result.verified,
    confidence: payload.result.confidence,
  });
}
