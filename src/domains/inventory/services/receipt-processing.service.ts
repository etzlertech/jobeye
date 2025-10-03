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
import * as purchaseReceiptsRepo from '../repositories/purchase-receipts.repository';
import * as inventoryItemsRepo from '../repositories/inventory-items.repository';
import * as inventoryTransactionsRepo from '../repositories/inventory-transactions.repository';
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
      tenant_id: request.tenantId,
      vendor: ocr.structuredData.vendor,
      purchase_date: ocr.structuredData.date || new Date().toISOString().split('T')[0],
      total_amount: ocr.structuredData.total || ocr.structuredData.subtotal,
      tax_amount: ocr.structuredData.tax,
      subtotal_amount: ocr.structuredData.subtotal,
      ocr_text: ocr.text,
      ocr_confidence: ocr.confidence,
      ocr_method: ocr.method,
      line_items: ocr.structuredData.lineItems,
      job_id: request.jobId,
      created_by: request.userId,
    };

    const receiptResult = await purchaseReceiptsRepo.create(receiptData);

    if (receiptResult.error || !receiptResult.data) {
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
        error: receiptResult.error || new Error('Failed to create receipt record'),
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
        const itemResult = await inventoryItemsRepo.create({
          tenant_id: request.tenantId,
          type: 'material',
          name: lineItem.description,
          status: 'active',
          tracking_mode: 'quantity',
          current_quantity: lineItem.quantity || 0,
          current_location_id: request.locationId,
          attributes: {
            unit_cost: lineItem.price,
            last_purchase_price: lineItem.total,
          },
          created_by: request.userId,
        });

        if (itemResult.data) {
          createdItems.push(itemResult.data);
          lineItem.matchedItemId = itemResult.data.id;

          // Create purchase transaction
          if (lineItem.quantity && lineItem.quantity > 0) {
            const transactionResult =
              await inventoryTransactionsRepo.create({
                tenant_id: request.tenantId,
                item_id: itemResult.data.id,
                type: 'purchase',
                quantity: lineItem.quantity,
                to_location_id: request.locationId,
                user_id: request.userId,
                job_id: request.jobId,
                notes: `Purchased from ${ocr.structuredData.vendor || 'unknown vendor'}`,
                metadata: {
                  receiptId: receiptResult.data.id,
                  unitCost: lineItem.price,
                  totalCost: lineItem.total,
                },
              });

            if (transactionResult.data) {
              transactions.push(transactionResult.data);
            }
          }
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      success: true,
      receipt: receiptResult.data,
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
    const searchResult = await inventoryItemsRepo.findAll({
      tenantId,
      search: lineItem.description,
      type: 'material',
      limit: 1,
    });

    const matchedItem = searchResult.data[0];

    matched.push({
      ...lineItem,
      matchedItemId: matchedItem?.id,
    });
  }

  return matched;
}

/**
 * Get receipt by ID with line items
 */
export async function getReceipt(
  receiptId: string
): Promise<{ data: PurchaseReceipt | null; error: Error | null }> {
  return await purchaseReceiptsRepo.findById(receiptId);
}

/**
 * Get receipts for company
 */
export async function getReceipts(
  tenantId: string,
  limit?: number
): Promise<{ data: PurchaseReceipt[]; error: Error | null }> {
  return await purchaseReceiptsRepo.findByCompany(tenantId, limit);
}