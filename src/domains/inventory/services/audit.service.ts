/**
 * @file /src/domains/inventory/services/audit.service.ts
 * @phase 3.6
 * @domain Inventory
 * @purpose Physical inventory audit/reconciliation service
 * @complexity_budget 250
 * @feature 004-voice-vision-inventory
 *
 * Audit workflow:
 * 1. Start audit session (location-based)
 * 2. Scan/count items via vision detection
 * 3. Compare to expected inventory
 * 4. Record discrepancies
 * 5. Update quantities and create adjustment transactions
 */

import * as inventoryItemsRepo from '../repositories/inventory-items.repository';
import * as inventoryTransactionsRepo from '../repositories/inventory-transactions.repository';
import type {
  InventoryItem,
  InventoryTransaction,
} from '../types/inventory-types';
import { getOfflineInventoryQueue } from './offline-queue.service';

export interface AuditSession {
  id: string;
  tenantId: string;
  userId: string;
  locationId?: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'cancelled';
}

export interface AuditItemRecord {
  itemId: string;
  expectedQuantity: number;
  actualQuantity: number;
  discrepancy: number;
  notes?: string;
}

export interface AuditRequest {
  tenantId: string;
  userId: string;
  locationId?: string;
  auditRecords: AuditItemRecord[];
  notes?: string;
  voiceSessionId?: string;
  detectionSessionId?: string;
}

export interface AuditResult {
  success: boolean;
  adjustmentTransactions: InventoryTransaction[];
  updatedItems: InventoryItem[];
  totalDiscrepancies: number;
  error?: Error;
}

/**
 * Perform inventory audit and create adjustments
 */
export async function performAudit(
  request: AuditRequest
): Promise<AuditResult> {
  const {
    tenantId,
    userId,
    locationId,
    auditRecords,
    notes,
    voiceSessionId,
    detectionSessionId,
  } = request;

  // Check if offline - queue operation
  const offlineQueue = getOfflineInventoryQueue();
  if (!offlineQueue.getIsOnline()) {
    await offlineQueue.enqueue({
      tenantId,
      userId,
      type: 'audit',
      payload: request,
      voiceSessionId,
    });

    return {
      success: true,
      adjustmentTransactions: [],
      updatedItems: [],
      totalDiscrepancies: 0,
      error: new Error('Operation queued for sync when online'),
    };
  }

  const adjustmentTransactions: InventoryTransaction[] = [];
  const updatedItems: InventoryItem[] = [];
  const errors: Error[] = [];
  let totalDiscrepancies = 0;

  for (const record of auditRecords) {
    try {
      // Skip if no discrepancy
      if (record.discrepancy === 0) {
        continue;
      }

      totalDiscrepancies++;

      // Step 1: Get item details
      const itemResult = await inventoryItemsRepo.findById(record.itemId);
      if (itemResult.error || !itemResult.data) {
        errors.push(
          itemResult.error || new Error(`Item ${record.itemId} not found`)
        );
        continue;
      }

      const item = itemResult.data;

      // Step 2: Validate item is quantity-tracked
      if (item.tracking_mode !== 'quantity') {
        errors.push(
          new Error(
            `Item ${item.name} is not quantity-tracked (mode: ${item.tracking_mode})`
          )
        );
        continue;
      }

      // Step 3: Validate location if specified
      if (locationId && item.current_location_id !== locationId) {
        errors.push(
          new Error(
            `Item ${item.name} is not at audit location (current: ${item.current_location_id}, expected: ${locationId})`
          )
        );
        continue;
      }

      // Step 4: Determine adjustment type
      const adjustmentType = record.discrepancy > 0 ? 'adjustment_in' : 'adjustment_out';
      const adjustmentQty = Math.abs(record.discrepancy);

      // Step 5: Create adjustment transaction
      const transactionResult = await inventoryTransactionsRepo.create({
        tenant_id: tenantId,
        item_id: record.itemId,
        type: adjustmentType,
        quantity: adjustmentQty,
        from_location_id: adjustmentType === 'adjustment_out' ? item.current_location_id : null,
        to_location_id: adjustmentType === 'adjustment_in' ? item.current_location_id : null,
        user_id: userId,
        notes: `Audit adjustment: ${notes || ''} | ${record.notes || ''}`.trim(),
        voice_session_id: voiceSessionId,
        detection_session_id: detectionSessionId,
        metadata: {
          auditType: 'physical_count',
          expectedQuantity: record.expectedQuantity,
          actualQuantity: record.actualQuantity,
          discrepancy: record.discrepancy,
        },
      });

      if (transactionResult.error || !transactionResult.data) {
        errors.push(
          transactionResult.error ||
            new Error(`Failed to create adjustment transaction for ${item.name}`)
        );
        continue;
      }

      adjustmentTransactions.push(transactionResult.data);

      // Step 6: Update item quantity to actual count
      const updateResult = await inventoryItemsRepo.update(record.itemId, {
        current_quantity: record.actualQuantity,
        updated_at: new Date().toISOString(),
      });

      if (updateResult.error || !updateResult.data) {
        errors.push(
          updateResult.error ||
            new Error(`Failed to update quantity for ${item.name}`)
        );
        continue;
      }

      updatedItems.push(updateResult.data);
    } catch (err: any) {
      errors.push(
        new Error(`Audit failed for item ${record.itemId}: ${err.message}`)
      );
    }
  }

  return {
    success: errors.length === 0,
    adjustmentTransactions,
    updatedItems,
    totalDiscrepancies,
    error: errors.length > 0 ? new Error(errors.map((e) => e.message).join('; ')) : undefined,
  };
}

/**
 * Get items for audit at a location
 */
export async function getItemsForAudit(
  tenantId: string,
  locationId?: string
): Promise<{ data: InventoryItem[]; error: Error | null }> {
  const result = await inventoryItemsRepo.findAll({
    tenantId,
    locationId,
    trackingMode: 'quantity', // Only quantity-tracked items need auditing
  });

  return result;
}

/**
 * Get audit history
 */
export async function getAuditHistory(
  tenantId: string,
  locationId?: string
): Promise<{ data: InventoryTransaction[]; error: Error | null }> {
  const adjustmentInResult = await inventoryTransactionsRepo.findByCompany(
    tenantId,
    'adjustment_in'
  );
  const adjustmentOutResult = await inventoryTransactionsRepo.findByCompany(
    tenantId,
    'adjustment_out'
  );

  if (adjustmentInResult.error || adjustmentOutResult.error) {
    return {
      data: [],
      error: adjustmentInResult.error || adjustmentOutResult.error,
    };
  }

  const allAdjustments = [
    ...adjustmentInResult.data,
    ...adjustmentOutResult.data,
  ];

  // Filter by location if specified
  if (locationId) {
    const filtered = allAdjustments.filter(
      (t) =>
        t.from_location_id === locationId || t.to_location_id === locationId
    );
    return { data: filtered, error: null };
  }

  return { data: allAdjustments, error: null };
}