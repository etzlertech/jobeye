/**
 * @file /src/domains/inventory/services/check-in.service.ts
 * @phase 3.6
 * @domain Inventory
 * @purpose Equipment check-in service with condition tracking
 * @complexity_budget 250
 * @feature 004-voice-vision-inventory
 *
 * Check-in workflow:
 * 1. User scans/selects returned items
 * 2. Record condition and quantity
 * 3. Update item status
 * 4. Close container assignments
 * 5. Create transaction records
 */

import * as inventoryItemsRepo from '../repositories/inventory-items.repository';
import * as inventoryTransactionsRepo from '../repositories/inventory-transactions.repository';
import type {
  InventoryItem,
  InventoryTransaction,
  ItemStatus,
} from '../types/inventory-types';
import { getOfflineInventoryQueue } from './offline-queue.service';

export interface CheckInRequest {
  tenantId: string;
  userId: string;
  itemIds: string[];
  fromLocationId?: string; // Where items came from (truck, job site)
  toLocationId?: string; // Where items go (warehouse, storage)
  jobId?: string;
  quantities?: Record<string, number>; // For materials
  conditions?: Record<string, ItemStatus>; // New status per item
  notes?: string;
  voiceSessionId?: string;
  detectionSessionId?: string;
}

export interface CheckInResult {
  success: boolean;
  transactions: InventoryTransaction[];
  updatedItems: InventoryItem[];
  closedAssignments: string[]; // Assignment IDs that were closed
  error?: Error;
}

/**
 * Check in equipment/materials from a job
 */
export async function checkIn(
  request: CheckInRequest
): Promise<CheckInResult> {
  const {
    tenantId,
    userId,
    itemIds,
    fromLocationId,
    toLocationId,
    jobId,
    quantities,
    conditions,
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
      type: 'check_in',
      payload: request,
      jobId,
      voiceSessionId,
    });

    return {
      success: true,
      transactions: [],
      updatedItems: [],
      closedAssignments: [],
      error: new Error('Operation queued for sync when online'),
    };
  }

  // Initialize container repository
  const transactions: InventoryTransaction[] = [];
  const updatedItems: InventoryItem[] = [];
  const closedAssignments: string[] = [];
  const errors: Error[] = [];

  for (const itemId of itemIds) {
    try {
      // Step 1: Get item details
      const itemResult = await inventoryItemsRepo.findById(itemId);
      if (itemResult.error || !itemResult.data) {
        errors.push(
          itemResult.error || new Error(`Item ${itemId} not found`)
        );
        continue;
      }

      const item = itemResult.data;

      // Step 2: Determine quantity for check-in
      const quantity =
        item.tracking_mode === 'quantity'
          ? quantities?.[itemId] || 1
          : 1;

      // Step 3: Determine new status/condition
      const newStatus = conditions?.[itemId] || 'active';

      // Step 4: Create transaction record
      const transactionResult = await inventoryTransactionsRepo.create({
        tenant_id: tenantId,
        transaction_type: 'check_in',
        item_id: itemId,
        quantity,
        from_location_id: fromLocationId ?? item.current_location_id,
        to_location_id: toLocationId ?? null,
        from_user_id: userId,
        to_user_id: null,
        job_id: jobId ?? null,
        notes: notes ?? null,
        voice_session_id: voiceSessionId ?? null,
        detection_session_id: detectionSessionId ?? null,
        metadata: {
          previousStatus: item.status,
          newStatus,
        },
        created_by: userId,
      });

      if (transactionResult.error || !transactionResult.data) {
        errors.push(
          transactionResult.error ||
            new Error(`Failed to create transaction for ${item.name}`)
        );
        continue;
      }

      transactions.push(transactionResult.data);

      // Step 5: Update item location, quantity, and status
      const updates: Partial<InventoryItem> = {
        current_location_id: toLocationId || null,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (item.tracking_mode === 'quantity') {
        updates.current_quantity = (item.current_quantity || 0) + quantity;
      }

      const updateResult = await inventoryItemsRepo.update(itemId, updates);

      if (updateResult.error || !updateResult.data) {
        errors.push(
          updateResult.error ||
            new Error(`Failed to update item ${item.name}`)
        );
        continue;
      }

      updatedItems.push(updateResult.data);

      // Container assignment closure removed (container table unavailable).
    } catch (err: any) {
      errors.push(new Error(`Check-in failed for item ${itemId}: ${err.message}`));
    }
  }

  return {
    success: errors.length === 0,
    transactions,
    updatedItems,
    closedAssignments,
    error: errors.length > 0 ? new Error(errors.map((e) => e.message).join('; ')) : undefined,
  };
}

/**
 * Batch check-in with validation
 */
export async function batchCheckIn(
  requests: CheckInRequest[]
): Promise<CheckInResult[]> {
  const results: CheckInResult[] = [];

  for (const request of requests) {
    const result = await checkIn(request);
    results.push(result);
  }

  return results;
}

/**
 * Get check-in history for a job
 */
export async function getCheckInHistory(
  tenantId: string,
  jobId: string
): Promise<{ data: InventoryTransaction[]; error: Error | null }> {
  return await inventoryTransactionsRepo.findByCompany(tenantId, 'check_in');
}
