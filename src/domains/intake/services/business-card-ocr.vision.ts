/**
 * @file src/domains/intake/services/business-card-ocr.vision.ts
 * @phase 3
 * @domain intake
 * @purpose Vision fallback client for business card OCR using Google Generative AI.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T074
 * @complexity_budget 200 LoC
 * @dependencies
 *   internal:
 *     - ./business-card-ocr.types
 *   external:
 *     - @google/generative-ai
 * @exports
 *   - createVisionBusinessCardClient
 * @voice_considerations
 *   - Logs include fallback usage so voice agent can inform technicians.
 * END AGENT DIRECTIVE BLOCK
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { voiceLogger } from '@/core/logger/voice-logger';
import type { VisionBusinessCardExtraction } from './business-card-ocr.types';

export interface VisionBusinessCardClientOptions {
  model?: string;
  apiKey?: string;
  temperature?: number;
}

export interface VisionBusinessCardClient {
  analyzeBusinessCard(image: Blob, options?: { abortSignal?: AbortSignal }): Promise<VisionBusinessCardExtraction | null>;
}

const DEFAULT_MODEL = 'gemini-1.5-flash-latest';

export function createVisionBusinessCardClient(
  options: VisionBusinessCardClientOptions = {}
): VisionBusinessCardClient {
  const apiKey = options.apiKey ?? process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    voiceLogger.warn('Vision fallback disabled: missing GOOGLE_API_KEY');
    return {
      async analyzeBusinessCard() {
        return null;
      },
    };
  }

  const modelName = options.model ?? process.env.GOOGLE_VISION_MODEL ?? DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  return {
    async analyzeBusinessCard(image, { abortSignal } = {}) {
      try {
        const inlineData = await blobToInlineData(image);

        const prompt = 'You are an assistant that extracts information from a business card image. Return a compact JSON object with the following fields: name, company, phone, email, address, confidence (0-1). Use null when a field is missing. Respond with JSON only.';

        const response = await model.generateContent(
          [
            { text: prompt },
            {
              inlineData,
            },
          ],
          { abortSignal }
        );

        const text = response.response.text();
        const json = safeParseJson(text);

        if (!json) {
          voiceLogger.warn('Vision fallback returned unparseable response', { text });
          return null;
        }

        return {
          name: json.name ?? null,
          company: json.company ?? null,
          phone: json.phone ?? null,
          email: json.email ?? null,
          address: json.address ?? null,
          confidence: clampToUnit(json.confidence ?? 0.75),
          rawText: text,
        };
      } catch (error: any) {
        voiceLogger.error('Vision fallback failed', { error: error?.message ?? error });
        return null;
      }
    },
  };
}

async function blobToInlineData(blob: Blob): Promise<{ data: string; mimeType: string }> {
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return {
    data: base64,
    mimeType: blob.type || 'image/png',
  };
}

function safeParseJson(input: string) {
  if (!input) return null;
  const start = input.indexOf('{');
  const end = input.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const raw = input.slice(start, end + 1);

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function clampToUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
