/**
 * @file /src/domains/inventory/services/receipt-processing.service.ts
 * @phase 3.6
 * @domain Inventory
 * @purpose Receipt OCR and purchase record creation
 * @complexity_budget 250
 * @feature 004-voice-vision-inventory
 *
 * Receipt processing flow:
 * 1. User uploads receipt image
 * 2. Run hybrid OCR (Tesseract → GPT-4 fallback)
 * 3. Extract structured data
 * 4. Create purchase receipt record
 * 5. Optionally create/update inventory items
 */

import * as ocrOrchestratorService from '../../vision/services/ocr-orchestrator.service';
import { PurchaseReceiptRepository } from '../repositories/purchase-receipt.repository.class';
import { InventoryItemRepository } from '../repositories/inventory-item.repository.class';
import { createSupabaseClient } from '@/lib/supabase/client';
import type {
  PurchaseReceipt,
  InventoryItem,
  InventoryTransaction,
} from '../types/inventory-types';

export interface ReceiptProcessingRequest {
  tenantId: string;
  userId: string;
  imageData: File | Blob | string;
  jobId?: string;
  locationId?: string;
  autoCreateItems?: boolean; // Auto-create missing inventory items
}

export interface ReceiptLineItem {
  description: string;
  quantity?: number;
  price?: number;
  total?: number;
  matchedItemId?: string;
}

export interface ReceiptProcessingResult {
  success: boolean;
  receipt: PurchaseReceipt | null;
  lineItems: ReceiptLineItem[];
  createdItems: InventoryItem[];
  transactions: InventoryTransaction[];
  ocrMethod: 'tesseract' | 'gpt4-vision';
  ocrConfidence: number;
  processingTimeMs: number;
  estimatedCost: number;
  error?: Error;
}

// Initialize repositories
const supabase = createSupabaseClient();
const purchaseReceiptsRepo = new PurchaseReceiptRepository(supabase);
const inventoryItemsRepo = new InventoryItemRepository(supabase);

/**
 * Process receipt image and create purchase record
 */
export async function processReceipt(
  request: ReceiptProcessingRequest
): Promise<ReceiptProcessingResult> {
  const startTime = Date.now();

  try {
    // Step 1: Run hybrid OCR
    const ocrResult = await ocrOrchestratorService.processReceiptHybrid(
      request.imageData
    );

    if (ocrResult.error || !ocrResult.data) {
      return {
        success: false,
        receipt: null,
        lineItems: [],
        createdItems: [],
        transactions: [],
        ocrMethod: 'tesseract',
        ocrConfidence: 0,
        processingTimeMs: Date.now() - startTime,
        estimatedCost: 0,
        error: ocrResult.error || new Error('OCR processing failed'),
      };
    }

    const ocr = ocrResult.data;

    // Step 2: Create purchase receipt record
    const receiptData = {
      tenantId: request.tenantId,
      vendor: ocr.structuredData.vendor,
      purchaseDate: ocr.structuredData.date || new Date().toISOString().split('T')[0],
      totalAmount: ocr.structuredData.total || ocr.structuredData.subtotal,
      taxAmount: ocr.structuredData.tax,
      subtotalAmount: ocr.structuredData.subtotal,
      ocrText: ocr.text,
      ocrConfidence: ocr.confidence,
      ocrMethod: ocr.method,
      lineItems: ocr.structuredData.lineItems,
      jobId: request.jobId,
      createdBy: request.userId,
    };

    let receipt: PurchaseReceipt | null = null;
    try {
      receipt = await purchaseReceiptsRepo.create(receiptData);
    } catch (error: any) {
      return {
        success: false,
        receipt: null,
        lineItems: ocr.structuredData.lineItems,
        createdItems: [],
        transactions: [],
        ocrMethod: ocr.method,
        ocrConfidence: ocr.confidence,
        processingTimeMs: Date.now() - startTime,
        estimatedCost: ocr.estimatedCost,
        error: error || new Error('Failed to create receipt record'),
      };
    }

    // Step 3: Match line items to existing inventory
    const lineItemsWithMatches = await matchLineItemsToInventory(
      request.tenantId,
      ocr.structuredData.lineItems
    );

    // Step 4: Optionally create new inventory items
    const createdItems: InventoryItem[] = [];
    const transactions: InventoryTransaction[] = [];

    if (request.autoCreateItems) {
      for (const lineItem of lineItemsWithMatches) {
        // Skip if already matched
        if (lineItem.matchedItemId) {
          continue;
        }

        // Create new material item
        try {
          const item = await inventoryItemsRepo.create({
            tenantId: request.tenantId,
            type: 'material',
            name: lineItem.description,
            status: 'active',
            trackingMode: 'quantity',
            currentQuantity: lineItem.quantity || 0,
            currentLocationId: request.locationId,
            attributes: {
              unitCost: lineItem.price,
              lastPurchasePrice: lineItem.total,
            },
            createdBy: request.userId,
          });

          createdItems.push(item);
          lineItem.matchedItemId = item.id;

          // Create purchase transaction  
          if (lineItem.quantity && lineItem.quantity > 0) {
            const transaction: InventoryTransaction = {
              id: crypto.randomUUID(),
              tenantId: request.tenantId,
              itemId: item.id,
              type: 'purchase',
              quantity: lineItem.quantity,
              toLocationId: request.locationId,
              userId: request.userId,
              jobId: request.jobId,
              notes: `Purchased from ${ocr.structuredData.vendor || 'unknown vendor'}`,
              metadata: {
                receiptId: receipt!.id,
                unitCost: lineItem.price,
                totalCost: lineItem.total,
              },
              createdAt: new Date().toISOString()
            };
            transactions.push(transaction);
          }
        } catch (error) {
          // Log error but continue processing other items
          console.error('Failed to create inventory item:', error);
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      success: true,
      receipt: receipt,
      lineItems: lineItemsWithMatches,
      createdItems,
      transactions,
      ocrMethod: ocr.method,
      ocrConfidence: ocr.confidence,
      processingTimeMs,
      estimatedCost: ocr.estimatedCost,
    };
  } catch (err: any) {
    return {
      success: false,
      receipt: null,
      lineItems: [],
      createdItems: [],
      transactions: [],
      ocrMethod: 'tesseract',
      ocrConfidence: 0,
      processingTimeMs: Date.now() - startTime,
      estimatedCost: 0,
      error: new Error(`Receipt processing failed: ${err.message}`),
    };
  }
}

/**
 * Match receipt line items to existing inventory items
 */
async function matchLineItemsToInventory(
  tenantId: string,
  lineItems: Array<{
    description: string;
    quantity?: number;
    price?: number;
    total?: number;
  }>
): Promise<ReceiptLineItem[]> {
  const matched: ReceiptLineItem[] = [];

  for (const lineItem of lineItems) {
    // Search for matching items by description
    try {
      const items = await inventoryItemsRepo.findAll(
        { tenantId, type: 'material' },
        1
      );
      
      // Simple text match - in production would use better search
      const matchedItem = items.find((item: any) => 
        item.name.toLowerCase().includes(lineItem.description.toLowerCase())
      );

    matched.push({
        ...lineItem,
        matchedItemId: matchedItem?.id,
      });
    } catch (error) {
      // If search fails, still add the line item without match
      matched.push({
        ...lineItem,
        matchedItemId: undefined,
      });
    }
  }

  return matched;
}

/**
 * Get receipt by ID with line items
 */
export async function getReceipt(
  receiptId: string
): Promise<{ data: PurchaseReceipt | null; error: Error | null }> {
  try {
    const data = await purchaseReceiptsRepo.findById(receiptId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Get receipts for company
 */
export async function getReceipts(
  tenantId: string,
  limit?: number
): Promise<{ data: PurchaseReceipt[]; error: Error | null }> {
  try {
    const data = await purchaseReceiptsRepo.findAll({ tenantId }, limit);
    return { data, error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}