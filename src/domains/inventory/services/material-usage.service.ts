/**
 * @file /src/domains/inventory/services/material-usage.service.ts
 * @phase 3.6
 * @domain Inventory
 * @purpose Material consumption tracking for jobs
 * @complexity_budget 200
 * @feature 004-voice-vision-inventory
 *
 * Material usage workflow:
 * 1. Record material consumption at job site
 * 2. Deduct from inventory quantities
 * 3. Link to job for cost tracking
 * 4. Support voice-based reporting
 */

import * as inventoryItemsRepo from '../repositories/inventory-items.repository';
import * as inventoryTransactionsRepo from '../repositories/inventory-transactions.repository';
import type {
  InventoryItem,
  InventoryTransaction,
} from '../types/inventory-types';
import { getOfflineInventoryQueue } from './offline-queue.service';

export interface MaterialUsageRequest {
  tenantId: string;
  userId: string;
  materialId: string;
  quantity: number;
  jobId: string;
  locationId?: string;
  notes?: string;
  voiceSessionId?: string;
}

export interface MaterialUsageResult {
  success: boolean;
  transaction: InventoryTransaction | null;
  updatedItem: InventoryItem | null;
  error?: Error;
}

/**
 * Record material usage/consumption
 */
export async function recordUsage(
  request: MaterialUsageRequest
): Promise<MaterialUsageResult> {
  const {
    tenantId,
    userId,
    materialId,
    quantity,
    jobId,
    locationId,
    notes,
    voiceSessionId,
  } = request;

  // Validate quantity
  if (quantity <= 0) {
    return {
      success: false,
      transaction: null,
      updatedItem: null,
      error: new Error('Quantity must be greater than 0'),
    };
  }

  // Check if offline - queue operation
  const offlineQueue = getOfflineInventoryQueue();
  if (!offlineQueue.getIsOnline()) {
    await offlineQueue.enqueue({
      tenantId,
      userId,
      type: 'material_usage',
      payload: request,
      jobId,
      voiceSessionId,
    });

    return {
      success: true,
      transaction: null,
      updatedItem: null,
      error: new Error('Operation queued for sync when online'),
    };
  }

  try {
    // Step 1: Get material details
    const itemResult = await inventoryItemsRepo.findById(materialId);
    if (itemResult.error || !itemResult.data) {
      return {
        success: false,
        transaction: null,
        updatedItem: null,
        error: itemResult.error || new Error('Material not found'),
      };
    }

    const item = itemResult.data;

    // Step 2: Validate item is a material
    if (item.item_type !== 'material') {
      return {
        success: false,
        transaction: null,
        updatedItem: null,
        error: new Error(`Item ${item.name} is not a material (type: ${item.item_type})`),
      };
    }

    // Step 3: Validate tracking mode
    if (item.tracking_mode !== 'quantity') {
      return {
        success: false,
        transaction: null,
        updatedItem: null,
        error: new Error(`Material ${item.name} is not quantity-tracked`),
      };
    }

    // Step 4: Check available quantity
    const currentQty = item.current_quantity || 0;
    if (currentQty < quantity) {
      return {
        success: false,
        transaction: null,
        updatedItem: null,
        error: new Error(
          `Insufficient quantity for ${item.name} (available: ${currentQty}, requested: ${quantity})`
        ),
      };
    }

    // Step 5: Create usage transaction
    const transactionResult = await inventoryTransactionsRepo.create({
      tenant_id: tenantId,
      transaction_type: 'usage',
      item_id: materialId,
      quantity,
      from_location_id: item.current_location_id ?? locationId ?? null,
      to_location_id: null,
      from_user_id: userId,
      to_user_id: null,
      job_id: jobId,
      notes: notes ?? null,
      voice_session_id: voiceSessionId ?? null,
      metadata: {
        previousQuantity: currentQty,
      },
      created_by: userId,
    });

    if (transactionResult.error || !transactionResult.data) {
      return {
        success: false,
        transaction: null,
        updatedItem: null,
        error:
          transactionResult.error ||
          new Error('Failed to create usage transaction'),
      };
    }

    // Step 6: Update material quantity
    const newQuantity = currentQty - quantity;
    const updateResult = await inventoryItemsRepo.update(materialId, {
      current_quantity: newQuantity,
      updated_at: new Date().toISOString(),
    });

    if (updateResult.error || !updateResult.data) {
      return {
        success: false,
        transaction: transactionResult.data,
        updatedItem: null,
        error:
          updateResult.error || new Error('Failed to update material quantity'),
      };
    }

    return {
      success: true,
      transaction: transactionResult.data,
      updatedItem: updateResult.data,
    };
  } catch (err: any) {
    return {
      success: false,
      transaction: null,
      updatedItem: null,
      error: new Error(`Material usage recording failed: ${err.message}`),
    };
  }
}

/**
 * Batch record material usage
 */
export async function batchRecordUsage(
  requests: MaterialUsageRequest[]
): Promise<MaterialUsageResult[]> {
  const results: MaterialUsageResult[] = [];

  for (const request of requests) {
    const result = await recordUsage(request);
    results.push(result);
  }

  return results;
}

/**
 * Get material usage history for a job
 */
export async function getUsageHistory(
  tenantId: string,
  jobId: string
): Promise<{ data: InventoryTransaction[]; error: Error | null }> {
  return await inventoryTransactionsRepo.findByCompany(tenantId, 'usage');
}

/**
 * Calculate total material cost for a job
 */
export async function calculateJobMaterialCost(
  tenantId: string,
  jobId: string
): Promise<{ data: { totalCost: number; breakdown: Array<{ materialId: string; quantity: number; cost: number }> } | null; error: Error | null }> {
  try {
    const usageResult = await inventoryTransactionsRepo.findByCompany(
      tenantId,
      'usage'
    );

    if (usageResult.error) {
      return { data: null, error: usageResult.error };
    }

    const jobUsage = usageResult.data.filter((t) => t.job_id === jobId);
    const breakdown: Array<{ materialId: string; quantity: number; cost: number }> = [];
    let totalCost = 0;

    // Group by material
    const materialMap = new Map<string, number>();
    for (const transaction of jobUsage) {
      const current = materialMap.get(transaction.item_id) || 0;
      materialMap.set(transaction.item_id, current + transaction.quantity);
    }

    // Calculate costs (TODO: fetch actual unit costs from items)
    for (const [materialId, quantity] of materialMap.entries()) {
      const itemResult = await inventoryItemsRepo.findById(materialId);
      if (itemResult.data) {
        const unitCost = (itemResult.data.attributes as any)?.unit_cost || 0;
        const cost = unitCost * quantity;
        breakdown.push({ materialId, quantity, cost });
        totalCost += cost;
      }
    }

    return {
      data: { totalCost, breakdown },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(`Cost calculation failed: ${err.message}`),
    };
  }
}
