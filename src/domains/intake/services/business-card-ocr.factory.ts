/**
 * @file src/domains/intake/services/business-card-ocr.factory.ts
 * @phase 3
 * @domain intake
 * @purpose Factory helpers for BusinessCardOcrService with default dependencies.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T074
 * @complexity_budget 150 LoC
 * @dependencies
 *   internal:
 *     - @/domains/intake/repositories/intake-extraction.repository
 *     - ./business-card-ocr.service
 *     - ./business-card-ocr.types
 *     - ./business-card-ocr.tesseract
 *     - ./business-card-ocr.vision
 * @exports
 *   - createBusinessCardOcrService
 *   - createDefaultBusinessCardDependencies
 * @voice_considerations
 *   - Factory logs communicate when fallbacks are disabled so voice workflows can alert technicians.
 * END AGENT DIRECTIVE BLOCK
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { PSM } from 'tesseract.js';
import { voiceLogger } from '@/core/logger/voice-logger';
import { IntakeExtractionRepository } from '@/domains/intake/repositories/intake-extraction.repository';
import {
  BusinessCardOcrService,
  BusinessCardOcrDependencies,
} from './business-card-ocr.service';
import { createTesseractBusinessCardClient } from './business-card-ocr.tesseract';
import { createVisionBusinessCardClient } from './business-card-ocr.vision';
import type { BusinessCardExtractionRepository } from './business-card-ocr.types';

export interface BusinessCardOcrFactoryOptions {
  supabaseClient?: SupabaseClient;
  confidenceThreshold?: number;
  temperature?: number;
  tesseract?: {
    language?: string;
    psm?: PSM;
    oem?: number;
  };
  vision?: {
    model?: string;
    apiKey?: string;
  };
  logger?: BusinessCardOcrDependencies['logger'];
  now?: BusinessCardOcrDependencies['now'];
}

export function createBusinessCardOcrService(
  options: BusinessCardOcrFactoryOptions = {}
): BusinessCardOcrService {
  const deps = createDefaultBusinessCardDependencies(options);
  return new BusinessCardOcrService(deps);
}

export function createDefaultBusinessCardDependencies(
  options: BusinessCardOcrFactoryOptions = {}
): BusinessCardOcrDependencies {
  const tesseractClient = createTesseractBusinessCardClient({
    defaults: options.tesseract,
  });

  const visionClient = createVisionBusinessCardClient({
    ...options.vision,
    temperature: options.temperature,
  });

  const extractionRepository = createExtractionRepositoryAdapter(options.supabaseClient);

  if (!options.supabaseClient) {
    voiceLogger.warn('BusinessCardOcrService factory: extraction repository disabled (missing Supabase client)');
  }

  return {
    tesseractClient,
    visionClient,
    extractionRepository,
    confidenceThreshold: options.confidenceThreshold,
    logger: options.logger,
    now: options.now,
  } satisfies BusinessCardOcrDependencies;
}

function createExtractionRepositoryAdapter(
  supabaseClient?: SupabaseClient
): BusinessCardExtractionRepository | undefined {
  if (!supabaseClient) return undefined;

  const intakeRepo = new IntakeExtractionRepository(supabaseClient);

  return {
    async create(extraction) {
      return intakeRepo.create({
        tenant_id: extraction.tenant_id,
        session_id: extraction.session_id,
        extraction_type: extraction.extraction_type,
        raw_text: extraction.raw_text ?? undefined,
        structured_data: extraction.structured_data,
        confidence_score: extraction.confidence_score,
        provider: extraction.provider,
        processing_time_ms: extraction.processing_time_ms ?? undefined,
        cost: extraction.cost ?? undefined,
        duplicate_of_id: extraction.duplicate_of_id ?? undefined,
        duplicate_confidence: extraction.duplicate_confidence ?? undefined,
        status: extraction.status,
        reviewed_by: extraction.reviewed_by ?? undefined,
        reviewed_at: extraction.reviewed_at ?? undefined,
      });
    },
  };
}
