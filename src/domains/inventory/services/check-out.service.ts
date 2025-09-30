/**
 * @file /src/domains/inventory/services/check-out.service.ts
 * @phase 3.6
 * @domain Inventory
 * @purpose Equipment check-out service with vision detection
 * @complexity_budget 300
 * @feature 004-voice-vision-inventory
 *
 * Check-out workflow:
 * 1. User scans/selects items via vision detection
 * 2. Confirm selections
 * 3. Create transaction records
 * 4. Update item locations
 * 5. Link to job if applicable
 */

import * as inventoryItemsRepo from '../repositories/inventory-items.repository';
import * as inventoryTransactionsRepo from '../repositories/inventory-transactions.repository';
import * as containerAssignmentsRepo from '../repositories/container-assignments.repository';
import type {
  InventoryItem,
  InventoryTransaction,
  ContainerAssignment,
} from '../types/inventory-types';
import { getOfflineInventoryQueue } from './offline-queue.service';

export interface CheckOutRequest {
  companyId: string;
  userId: string;
  itemIds: string[];
  jobId?: string;
  locationId?: string; // Where items are being taken (truck, job site)
  quantities?: Record<string, number>; // For materials with quantity tracking
  notes?: string;
  voiceSessionId?: string;
  detectionSessionId?: string;
}

export interface CheckOutResult {
  success: boolean;
  transactions: InventoryTransaction[];
  updatedItems: InventoryItem[];
  containerAssignments: ContainerAssignment[];
  error?: Error;
}

/**
 * Check out equipment/materials for a job
 */
export async function checkOut(
  request: CheckOutRequest
): Promise<CheckOutResult> {
  const {
    companyId,
    userId,
    itemIds,
    jobId,
    locationId,
    quantities,
    notes,
    voiceSessionId,
    detectionSessionId,
  } = request;

  // Check if offline - queue operation
  const offlineQueue = getOfflineInventoryQueue();
  if (!offlineQueue.getIsOnline()) {
    await offlineQueue.enqueue({
      companyId,
      userId,
      type: 'check_out',
      payload: request,
      jobId,
      voiceSessionId,
    });

    return {
      success: true,
      transactions: [],
      updatedItems: [],
      containerAssignments: [],
      error: new Error('Operation queued for sync when online'),
    };
  }

  const transactions: InventoryTransaction[] = [];
  const updatedItems: InventoryItem[] = [];
  const containerAssignments: ContainerAssignment[] = [];
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

      // Step 2: Validate item is available
      if (item.status !== 'active') {
        errors.push(
          new Error(`Item ${item.name} is not available (status: ${item.status})`)
        );
        continue;
      }

      // Step 3: Determine quantity for check-out
      const quantity =
        item.tracking_mode === 'quantity'
          ? quantities?.[itemId] || 1
          : 1;

      // Step 4: Validate quantity for materials
      if (item.tracking_mode === 'quantity') {
        const currentQty = item.current_quantity || 0;
        if (currentQty < quantity) {
          errors.push(
            new Error(
              `Insufficient quantity for ${item.name} (available: ${currentQty}, requested: ${quantity})`
            )
          );
          continue;
        }
      }

      // Step 5: Create transaction record
      const transactionResult = await inventoryTransactionsRepo.create({
        company_id: companyId,
        item_id: itemId,
        type: 'check_out',
        quantity,
        from_location_id: item.current_location_id,
        to_location_id: locationId,
        user_id: userId,
        job_id: jobId,
        notes,
        voice_session_id: voiceSessionId,
        detection_session_id: detectionSessionId,
        metadata: {
          previousStatus: item.status,
        },
      });

      if (transactionResult.error || !transactionResult.data) {
        errors.push(
          transactionResult.error ||
            new Error(`Failed to create transaction for ${item.name}`)
        );
        continue;
      }

      transactions.push(transactionResult.data);

      // Step 6: Update item location and quantity
      const updates: Partial<InventoryItem> = {
        current_location_id: locationId || null,
        updated_at: new Date().toISOString(),
      };

      if (item.tracking_mode === 'quantity') {
        updates.current_quantity = (item.current_quantity || 0) - quantity;
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

      // Step 7: Create container assignment if going to a container/truck
      if (locationId && item.tracking_mode === 'individual') {
        const assignmentResult = await containerAssignmentsRepo.create({
          company_id: companyId,
          container_id: locationId,
          item_id: itemId,
          assigned_by: userId,
          job_id: jobId,
          status: 'active',
        });

        if (assignmentResult.data) {
          containerAssignments.push(assignmentResult.data);
        }
      }
    } catch (err: any) {
      errors.push(new Error(`Check-out failed for item ${itemId}: ${err.message}`));
    }
  }

  return {
    success: errors.length === 0,
    transactions,
    updatedItems,
    containerAssignments,
    error: errors.length > 0 ? new Error(errors.map((e) => e.message).join('; ')) : undefined,
  };
}

/**
 * Batch check-out with validation
 */
export async function batchCheckOut(
  requests: CheckOutRequest[]
): Promise<CheckOutResult[]> {
  const results: CheckOutResult[] = [];

  for (const request of requests) {
    const result = await checkOut(request);
    results.push(result);
  }

  return results;
}

/**
 * Get check-out history for a job
 */
export async function getCheckOutHistory(
  companyId: string,
  jobId: string
): Promise<{ data: InventoryTransaction[]; error: Error | null }> {
  return await inventoryTransactionsRepo.findByCompany(companyId, 'check_out');
}