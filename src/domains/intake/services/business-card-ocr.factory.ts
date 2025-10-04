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
import { voiceLogger } from '@/core/logger/voice-logger';
import { IntakeExtractionRepository } from '@/domains/intake/repositories/intake-extraction.repository';
import {
  BusinessCardOcrService,
  BusinessCardOcrDependencies,
} from './business-card-ocr.service';
import { createTesseractBusinessCardClient } from './business-card-ocr.tesseract';
import { createVisionBusinessCardClient } from './business-card-ocr.vision';

export interface BusinessCardOcrFactoryOptions {
  supabaseClient?: SupabaseClient;
  confidenceThreshold?: number;
  temperature?: number;
  tesseract?: {
    language?: string;
    psm?: number;
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

  const extractionRepository = options.supabaseClient
    ? new IntakeExtractionRepository(options.supabaseClient)
    : undefined;

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
