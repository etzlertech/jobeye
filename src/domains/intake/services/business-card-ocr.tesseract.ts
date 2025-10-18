/**
 * @file src/domains/intake/services/business-card-ocr.tesseract.ts
 * @phase 3
 * @domain intake
 * @purpose Thin wrapper around vision Tesseract service for business card OCR.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T072
 * @complexity_budget 150 LoC
 * @dependencies
 *   internal:
 *     - @/domains/vision/services/ocr-tesseract.service
 *     - ./business-card-ocr.types
 * @exports
 *   - createTesseractBusinessCardClient
 * @voice_considerations
 *   - Surface extraction timings so voice flows can keep technicians informed.
 * END AGENT DIRECTIVE BLOCK
 */

import { PSM } from 'tesseract.js';
import { extractText as extractTextWithTesseract } from '@/domains/vision/services/ocr-tesseract.service';
import type { OcrTextExtraction } from './business-card-ocr.types';

export interface TesseractBusinessCardOptions {
  language?: string;
  psm?: PSM;
  oem?: number;
}

export interface TesseractBusinessCardClientConfig {
  defaults?: TesseractBusinessCardOptions;
}

export interface TesseractBusinessCardClient {
  extractText(image: Blob, options?: TesseractBusinessCardOptions): Promise<OcrTextExtraction>;
}

export function createTesseractBusinessCardClient(
  config: TesseractBusinessCardClientConfig = {}
): TesseractBusinessCardClient {
  return {
    async extractText(image, options) {
      const merged: TesseractBusinessCardOptions = {
        language: 'eng',
        psm: PSM.AUTO,
        oem: 3,
        ...config.defaults,
        ...options,
      };

      const { data, error } = await extractTextWithTesseract(image, merged);

      if (error || !data) {
        throw new Error(error?.message ?? 'Tesseract OCR failed');
      }

      const confidence = clampToUnit(data.confidence / 100);

      return {
        text: data.text,
        confidence,
      };
    },
  };
}

function clampToUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
