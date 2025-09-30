/**
 * @file /src/domains/vision/services/ocr-tesseract.service.ts
 * @phase 3.5
 * @domain Vision
 * @purpose Tesseract.js OCR wrapper for offline receipt processing
 * @complexity_budget 200
 * @feature 004-voice-vision-inventory
 *
 * Offline-first OCR using Tesseract.js WASM
 * Performance: 3-8s on mobile
 * Accuracy: 85-90%
 * Cost: $0 (fully offline)
 */

import Tesseract from 'tesseract.js';

export interface TesseractOcrResult {
  text: string;
  confidence: number;
  blocks: Array<{
    text: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  processingTimeMs: number;
}

export interface TesseractOcrOptions {
  language?: string;
  psm?: number; // Page segmentation mode
  oem?: number; // OCR engine mode
}

/**
 * Extract text from image using Tesseract.js
 */
export async function extractText(
  imageData: File | Blob | string,
  options: TesseractOcrOptions = {}
): Promise<{ data: TesseractOcrResult | null; error: Error | null }> {
  const startTime = Date.now();

  try {
    const {
      language = 'eng',
      psm = 3, // Auto page segmentation
      oem = 3, // Default OCR engine
    } = options;

    // Initialize worker
    const worker = await Tesseract.createWorker(language, oem, {
      logger: (m) => {
        // Optional: log progress for UI feedback
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Set page segmentation mode
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
    });

    // Perform recognition
    const result = await worker.recognize(imageData);

    // Cleanup
    await worker.terminate();

    const processingTimeMs = Date.now() - startTime;

    // Extract blocks with bounding boxes
    const blocks = result.data.blocks.map((block) => ({
      text: block.text,
      confidence: block.confidence,
      bbox: {
        x: block.bbox.x0,
        y: block.bbox.y0,
        width: block.bbox.x1 - block.bbox.x0,
        height: block.bbox.y1 - block.bbox.y0,
      },
    }));

    return {
      data: {
        text: result.data.text,
        confidence: result.data.confidence,
        blocks,
        processingTimeMs,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(`Tesseract OCR failed: ${err.message}`),
    };
  }
}

/**
 * Extract structured receipt data from OCR text
 * Uses regex patterns to identify vendor, date, line items, total
 */
export function parseReceiptText(
  text: string
): {
  vendor?: string;
  date?: string;
  lineItems: Array<{ description: string; quantity?: number; price?: number; total?: number }>;
  total?: number;
  confidence: number;
} {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Extract vendor (usually first few lines, look for common store names)
  let vendor: string | undefined;
  const vendorPatterns = [
    /home depot|lowes|lowe's|ace hardware|tractor supply|harbor freight/i,
    /^[A-Z\s&]{5,30}$/,  // Uppercase company names
  ];

  for (const line of lines.slice(0, 5)) {
    for (const pattern of vendorPatterns) {
      if (pattern.test(line)) {
        vendor = line;
        break;
      }
    }
    if (vendor) break;
  }

  // Extract date
  let date: string | undefined;
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
  for (const line of lines) {
    const match = line.match(datePattern);
    if (match) {
      date = match[0];
      break;
    }
  }

  // Extract line items
  const lineItems: Array<{ description: string; quantity?: number; price?: number; total?: number }> = [];
  const pricePattern = /\$?\s*(\d+\.\d{2})/g;
  const quantityPattern = /^\s*(\d+)\s+/;

  for (const line of lines) {
    // Skip header lines
    if (/^(ITEM|QTY|PRICE|TOTAL|TAX|SUBTOTAL)/i.test(line)) continue;

    // Look for lines with prices
    const prices = Array.from(line.matchAll(pricePattern)).map((m) => parseFloat(m[1]));
    if (prices.length === 0) continue;

    // Extract quantity if present
    const qtyMatch = line.match(quantityPattern);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : undefined;

    // Extract description (everything before first price)
    const firstPriceIndex = line.search(pricePattern);
    const description = firstPriceIndex > 0 ? line.substring(0, firstPriceIndex).trim() : line;

    if (description.length > 3) {  // Filter noise
      lineItems.push({
        description,
        quantity,
        price: prices.length > 1 ? prices[0] : undefined,
        total: prices[prices.length - 1],  // Last price is usually the total
      });
    }
  }

  // Extract total
  let total: number | undefined;
  const totalPattern = /total[\s:]*\$?\s*(\d+\.\d{2})/i;
  for (const line of lines) {
    const match = line.match(totalPattern);
    if (match) {
      total = parseFloat(match[1]);
      break;
    }
  }

  // Calculate confidence score
  let confidenceScore = 0;
  if (vendor) confidenceScore += 30;
  if (date) confidenceScore += 20;
  if (lineItems.length > 0) confidenceScore += 30;
  if (total) confidenceScore += 20;

  return {
    vendor,
    date,
    lineItems,
    total,
    confidence: confidenceScore,
  };
}

/**
 * Complete offline receipt processing pipeline
 */
export async function processReceipt(
  imageData: File | Blob | string
): Promise<{
  data: {
    ocrResult: TesseractOcrResult;
    parsedReceipt: ReturnType<typeof parseReceiptText>;
  } | null;
  error: Error | null;
}> {
  // Step 1: OCR extraction
  const ocrResult = await extractText(imageData, {
    psm: 6,  // Assume uniform block of text (receipts)
  });

  if (ocrResult.error || !ocrResult.data) {
    return {
      data: null,
      error: ocrResult.error || new Error('OCR extraction failed'),
    };
  }

  // Step 2: Parse structured data
  const parsedReceipt = parseReceiptText(ocrResult.data.text);

  return {
    data: {
      ocrResult: ocrResult.data,
      parsedReceipt,
    },
    error: null,
  };
}