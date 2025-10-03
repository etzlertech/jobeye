/**
 * @file /src/domains/inventory/services/transfer.service.ts
 * @phase 3.6
 * @domain Inventory
 * @purpose Item transfer between locations/containers
 * @complexity_budget 200
 * @feature 004-voice-vision-inventory
 *
 * Transfer workflow:
 * 1. Move items between storage locations
 * 2. Transfer between trucks/containers
 * 3. Warehouse to truck, truck to job site, etc.
 * 4. Track location history
 */

import * as inventoryItemsRepo from '../repositories/inventory-items.repository';
import * as inventoryTransactionsRepo from '../repositories/inventory-transactions.repository';
import { ContainerRepository } from '@/domains/equipment/repositories/container-repository-enhanced';
import { createSupabaseClient } from '@/lib/supabase/client';
import type {
  InventoryItem,
  InventoryTransaction,
} from '../types/inventory-types';
import type { ContainerAssignment } from '@/domains/equipment/repositories/container-repository-enhanced';
import { getOfflineInventoryQueue } from './offline-queue.service';

export interface TransferRequest {
  tenantId: string;
  userId: string;
  itemIds: string[];
  fromLocationId: string;
  toLocationId: string;
  quantities?: Record<string, number>; // For materials
  jobId?: string;
  notes?: string;
  voiceSessionId?: string;
}

export interface TransferResult {
  success: boolean;
  transactions: InventoryTransaction[];
  updatedItems: InventoryItem[];
  containerAssignments: ContainerAssignment[];
  error?: Error;
}

/**
 * Transfer items between locations
 */
export async function transfer(
  request: TransferRequest
): Promise<TransferResult> {
  const {
    tenantId,
    userId,
    itemIds,
    fromLocationId,
    toLocationId,
    quantities,
    jobId,
    notes,
    voiceSessionId,
  } = request;

  // Validate locations
  if (fromLocationId === toLocationId) {
    return {
      success: false,
      transactions: [],
      updatedItems: [],
      containerAssignments: [],
      error: new Error('Source and destination locations cannot be the same'),
    };
  }

  // Check if offline - queue operation
  const offlineQueue = getOfflineInventoryQueue();
  if (!offlineQueue.getIsOnline()) {
    await offlineQueue.enqueue({
      tenantId,
      userId,
      type: 'transfer',
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

  // Initialize container repository
  const supabase = createSupabaseClient();
  const containerRepo = new ContainerRepository(supabase);

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

      // Step 2: Validate item is at source location
      if (item.current_location_id !== fromLocationId) {
        errors.push(
          new Error(
            `Item ${item.name} is not at source location (current: ${item.current_location_id}, expected: ${fromLocationId})`
          )
        );
        continue;
      }

      // Step 3: Determine quantity for transfer
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

      // Step 5: Create transfer transaction
      const transactionResult = await inventoryTransactionsRepo.create({
        tenant_id: tenantId,
        item_id: itemId,
        type: 'transfer',
        quantity,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        user_id: userId,
        job_id: jobId,
        notes,
        voice_session_id: voiceSessionId,
        metadata: {
          previousLocation: item.current_location_id,
        },
      });

      if (transactionResult.error || !transactionResult.data) {
        errors.push(
          transactionResult.error ||
            new Error(`Failed to create transfer transaction for ${item.name}`)
        );
        continue;
      }

      transactions.push(transactionResult.data);

      // Step 6: Update item location
      const updateResult = await inventoryItemsRepo.update(itemId, {
        current_location_id: toLocationId,
        updated_at: new Date().toISOString(),
      });

      if (updateResult.error || !updateResult.data) {
        errors.push(
          updateResult.error ||
            new Error(`Failed to update location for ${item.name}`)
        );
        continue;
      }

      updatedItems.push(updateResult.data);

      // Step 7: Create new container assignment if transferring to a container
      if (item.tracking_mode === 'individual') {
        try {
          const assignment = await containerRepo.createAssignment({
            tenant_id: tenantId,
            container_id: toLocationId,
            item_id: itemId,
            item_type: 'tool', // Assuming tools for inventory items
            assigned_by: userId,
          });

          containerAssignments.push(assignment);
        } catch (assignmentError) {
          // Log assignment error but don't fail the entire transfer
          console.error('Failed to create container assignment:', assignmentError);
        }
      }
    } catch (err: any) {
      errors.push(new Error(`Transfer failed for item ${itemId}: ${err.message}`));
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
 * Batch transfer with validation
 */
export async function batchTransfer(
  requests: TransferRequest[]
): Promise<TransferResult[]> {
  const results: TransferResult[] = [];

  for (const request of requests) {
    const result = await transfer(request);
    results.push(result);
  }

  return results;
}

/**
 * Get transfer history between locations
 */
export async function getTransferHistory(
  tenantId: string,
  locationId?: string
): Promise<{ data: InventoryTransaction[]; error: Error | null }> {
  const result = await inventoryTransactionsRepo.findByCompany(
    tenantId,
    'transfer'
  );

  if (result.error) {
    return result;
  }

  // Filter by location if specified
  if (locationId) {
    const filtered = result.data.filter(
      (t) =>
        t.from_location_id === locationId || t.to_location_id === locationId
    );
    return { data: filtered, error: null };
  }

  return result;
}