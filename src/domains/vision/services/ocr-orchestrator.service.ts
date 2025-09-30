/**
 * @file /src/domains/vision/services/ocr-orchestrator.service.ts
 * @phase 3.5
 * @domain Vision
 * @purpose Orchestrates Tesseract + GPT-4 Vision fallback strategy
 * @complexity_budget 100
 * @feature 004-voice-vision-inventory
 *
 * Hybrid OCR orchestration:
 * - 70% Tesseract (offline, free, 3-8s)
 * - 30% GPT-4 fallback (online, $0.02/receipt, 2-4s)
 * - Avg cost: ~$0.006 per receipt
 */

import { extractText as extractTextTesseract, parseReceiptText, processReceipt as processReceiptTesseract } from './ocr-tesseract.service';
import { extractReceiptData as extractReceiptGpt4, isAvailable as isGpt4Available } from './ocr-gpt4.service';

export interface OcrResult {
  text: string;
  confidence: number;
  structuredData: {
    vendor?: string;
    date?: string;
    lineItems: Array<{
      description: string;
      quantity?: number;
      price?: number;
      total?: number;
    }>;
    subtotal?: number;
    tax?: number;
    total?: number;
  };
  processingTimeMs: number;
  method: 'tesseract' | 'gpt4-vision';
  estimatedCost: number;
}

const CONFIDENCE_THRESHOLD = 70;
const MIN_LINE_ITEMS = 1;

/**
 * Process receipt with automatic fallback strategy
 * 1. Try Tesseract (offline, free)
 * 2. If confidence <70% or no line items, fallback to GPT-4 Vision
 */
export async function processReceiptHybrid(
  imageData: File | Blob | string
): Promise<{ data: OcrResult | null; error: Error | null }> {
  const startTime = Date.now();

  // Step 1: Try Tesseract first
  const tesseractResult = await processReceiptTesseract(imageData);

  if (tesseractResult.error) {
    // If Tesseract fails completely, try GPT-4 immediately
    if (isGpt4Available()) {
      return await fallbackToGpt4(imageData, startTime);
    }

    return {
      data: null,
      error: tesseractResult.error,
    };
  }

  const { ocrResult, parsedReceipt } = tesseractResult.data!;

  // Check if Tesseract result is acceptable
  const isAcceptable =
    ocrResult.confidence >= CONFIDENCE_THRESHOLD &&
    parsedReceipt.lineItems.length >= MIN_LINE_ITEMS &&
    parsedReceipt.confidence >= CONFIDENCE_THRESHOLD;

  if (isAcceptable) {
    // Tesseract result is good enough
    const processingTimeMs = Date.now() - startTime;

    return {
      data: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        structuredData: {
          vendor: parsedReceipt.vendor,
          date: parsedReceipt.date,
          lineItems: parsedReceipt.lineItems,
          total: parsedReceipt.total,
        },
        processingTimeMs,
        method: 'tesseract',
        estimatedCost: 0,
      },
      error: null,
    };
  }

  // Step 2: Fallback to GPT-4 Vision
  if (isGpt4Available()) {
    return await fallbackToGpt4(imageData, startTime);
  }

  // No fallback available, return Tesseract result with warning
  const processingTimeMs = Date.now() - startTime;

  return {
    data: {
      text: ocrResult.text,
      confidence: ocrResult.confidence,
      structuredData: {
        vendor: parsedReceipt.vendor,
        date: parsedReceipt.date,
        lineItems: parsedReceipt.lineItems,
        total: parsedReceipt.total,
      },
      processingTimeMs,
      method: 'tesseract',
      estimatedCost: 0,
    },
    error: new Error('Low confidence result, GPT-4 fallback unavailable'),
  };
}

async function fallbackToGpt4(
  imageData: File | Blob | string,
  startTime: number
): Promise<{ data: OcrResult | null; error: Error | null }> {
  const gpt4Result = await extractReceiptGpt4(imageData);

  if (gpt4Result.error || !gpt4Result.data) {
    return {
      data: null,
      error: gpt4Result.error || new Error('GPT-4 Vision fallback failed'),
    };
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    data: {
      text: gpt4Result.data.text,
      confidence: gpt4Result.data.confidence,
      structuredData: gpt4Result.data.structuredData,
      processingTimeMs,
      method: 'gpt4-vision',
      estimatedCost: gpt4Result.data.estimatedCost,
    },
    error: null,
  };
}