/**
 * @file src/domains/intake/services/business-card-ocr.service.ts
 * @phase 3
 * @domain intake
 * @purpose Extract structured contact information from business card images using Tesseract + VLM fallback.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T074
 * @complexity_budget 300 LoC
 * @dependencies
 *   internal:
 *     - @/core/logger/voice-logger
 *     - ./business-card-ocr.types
 *     - ./business-card-ocr.helpers
 *   external:
 *     - Tesseract client (dependency injected)
 *     - Vision LLM client (dependency injected)
 * @exports
 *   - BusinessCardOcrService
 *   - BusinessCardOcrError
 *   - BusinessCardOcrDependencies
 *   - BusinessCardContact
 * @voice_considerations
 *   - Provide confidence feedback so voice agents can confirm extraction accuracy with users.
 *   - Offer fallback messaging for manual confirmation when confidence is low.
 * @test_requirements
 *   unit: src/__tests__/intake/business-card-ocr.service.test.ts
 *   integration: src/__tests__/intake/integration/business-card-ocr.integration.test.ts
 * END AGENT DIRECTIVE BLOCK
 */

import { voiceLogger } from '@/core/logger/voice-logger';

import {
  BusinessCardContact,
  BusinessCardContactParser,
  BusinessCardOcrContext,
  BusinessCardOcrDependencies,
  BusinessCardOcrPersistencePayload,
} from './business-card-ocr.types';
import {
  defaultContactParser,
  normalizeParsedContact,
  normalizeVisionResult,
  computeConfidence,
  clampConfidence,
  roundConfidence,
  hasMeaningfulContact,
} from './business-card-ocr.helpers';

export type {
  BusinessCardContact,
  BusinessCardOcrDependencies,
  BusinessCardOcrContext,
  BusinessCardOcrPersistencePayload,
} from './business-card-ocr.types';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

export class BusinessCardOcrError extends Error {
  constructor(message: string, public readonly meta?: Record<string, unknown>) {
    super(message);
    this.name = 'BusinessCardOcrError';
  }
}

export class BusinessCardOcrService {
  private readonly tesseractClient = this.deps.tesseractClient;
  private readonly visionClient = this.deps.visionClient;
  private readonly parser: BusinessCardContactParser =
    this.deps.contactParser ?? defaultContactParser;
  private readonly logger = this.deps.logger ?? voiceLogger;
  private readonly now: () => Date = this.deps.now ?? (() => new Date());
  private readonly threshold =
    this.deps.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  private readonly customPersist = this.deps.persistResult;
  private readonly extractionRepository = this.deps.extractionRepository;

  constructor(private readonly deps: BusinessCardOcrDependencies) {
    if (!deps?.tesseractClient?.extractText) {
      throw new BusinessCardOcrError(
        'BusinessCardOcrService requires a tesseractClient with extractText()'
      );
    }

    if (!deps?.visionClient?.analyzeBusinessCard) {
      throw new BusinessCardOcrError(
        'BusinessCardOcrService requires a visionClient with analyzeBusinessCard()'
      );
    }
  }

  /**
   * Extract contact details from an image of a business card.
   */
  async extractContact(
    imageBlob: Blob,
    context?: BusinessCardOcrContext
  ): Promise<BusinessCardContact> {
    if (!imageBlob) {
      throw new BusinessCardOcrError('Business card image blob is required');
    }

    const startedAt = this.now().toISOString();
    this.logger.info('Starting business card OCR extraction', {
      startedAt,
      threshold: this.threshold,
    });

    const ocrResult = await this.tesseractClient.extractText(imageBlob, {
      enhanceContrast: true,
      trimWhitespace: true,
    });

    const parsedResult = this.parser.parse(ocrResult.text ?? '');
    const normalized = normalizeParsedContact(parsedResult);
    const baseConfidence = computeConfidence(
      clampConfidence(ocrResult.confidence ?? 0),
      normalized.fieldsPresent
    );

    if (baseConfidence >= this.threshold && hasMeaningfulContact(normalized.data)) {
      const result = await this.finalizeResult(
        normalized.data,
        baseConfidence,
        'tesseract',
        parsedResult.rawText,
        startedAt,
        false,
        context
      );
      this.logger.info('Business card OCR succeeded with Tesseract-only extraction', {
        confidence: result.confidence,
      });
      return result;
    }

    this.logger.warn('Business card OCR falling back to vision analysis', {
      baseConfidence,
      fieldsPresent: normalized.fieldsPresent,
    });

    const visionResult = await this.visionClient.analyzeBusinessCard(imageBlob, {
      reason: 'low-confidence-ocr',
      startedAt,
    });

    const visionNormalized = normalizeVisionResult(visionResult);

    if (!visionNormalized.hasMeaningfulData) {
      this.logger.error('Vision fallback failed to extract meaningful contact info', {
        fallbackConfidence: visionNormalized.confidence,
      });
      throw new BusinessCardOcrError(
        'Unable to extract contact information with sufficient confidence',
        {
          tesseractConfidence: baseConfidence,
          visionConfidence: visionNormalized.confidence,
        }
      );
    }

    const result = await this.finalizeResult(
      visionNormalized.data,
      Math.max(this.threshold, visionNormalized.confidence),
      'vision',
      visionResult?.rawText ?? parsedResult.rawText,
      startedAt,
      true,
      context
    );

    this.logger.info('Business card OCR succeeded via vision fallback', {
      confidence: result.confidence,
    });

    return result;
  }

  private async finalizeResult(
    data: ReturnType<typeof normalizeParsedContact>['data'],
    confidence: number,
    source: BusinessCardContact['source'],
    rawText: string | undefined,
    analyzedAt: string,
    fallbackUsed: boolean,
    context?: BusinessCardOcrContext
  ): Promise<BusinessCardContact> {
    const result: BusinessCardContact = {
      ...data,
      confidence: roundConfidence(confidence),
      source,
      fallbackUsed,
      rawText,
      analyzedAt,
    };

    await this.persist({
      result,
      source,
      rawText,
      analyzedAt,
      fallbackUsed,
      context,
    });

    return result;
  }

  private async persist(payload: BusinessCardOcrPersistencePayload): Promise<void> {
    if (this.customPersist) {
      await this.customPersist(payload);
      return;
    }

    const repository = this.extractionRepository;
    const { context, result, source } = payload;

    if (
      repository &&
      context?.tenantId &&
      context.sessionId
    ) {
      try {
        const structuredData: Record<string, unknown> = { ...result };

        await repository.create({
          tenant_id: context.tenantId,
          session_id: context.sessionId,
          extraction_type: 'contact',
          raw_text: payload.rawText ?? null,
          structured_data: structuredData,
          confidence_score: result.confidence,
          provider: source === 'tesseract' ? 'tesseract' : 'gpt-4o-mini',
          processing_time_ms: context.processingTimeMs ?? undefined,
          cost: context.costUsd ?? undefined,
          duplicate_of_id: context.duplicateOfId ?? undefined,
          duplicate_confidence: context.duplicateConfidence ?? undefined,
          status: context.status ?? 'pending_review',
          reviewed_by: context.reviewedBy ?? undefined,
          reviewed_at: context.reviewedAt ?? undefined,
        });
        return;
      } catch (error) {
        this.logger.error('Failed to persist business card OCR result via repository', {
          error,
        });
      }
    }

    defaultPersistResult(payload);
  }
}

function defaultPersistResult(payload: BusinessCardOcrPersistencePayload): void {
  voiceLogger.info('Persisting business card OCR result (stub)', {
    source: payload.source,
    hasEmail: Boolean(payload.result.email),
    hasPhone: Boolean(payload.result.phone),
  });
}
