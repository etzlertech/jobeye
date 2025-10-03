/**
 * Unified inventory service for all item operations
 * Replaces separate equipment, inventory, materials, and tools services
 */
import { ItemRepository } from '../repositories/item.repository';
import { ItemTransactionRepository, TransactionCreate } from '../repositories/item-transaction.repository';
import { ContainerRepository } from '@/domains/equipment/repositories/container-repository-enhanced';
import { createSupabaseClient } from '@/lib/supabase/client';
import type {
  Item,
  ItemCreate,
  ItemUpdate,
  ItemFilters,
  ItemTransaction,
  TransactionType,
} from '../types/item-types';

export interface CheckOutRequest {
  tenantId: string;
  userId: string;
  itemIds: string[];
  jobId?: string;
  locationId?: string;
  quantities?: Record<string, number>;
  notes?: string;
  voiceSessionId?: string;
  detectionSessionId?: string;
}

export interface CheckInRequest {
  tenantId: string;
  userId: string;
  itemIds: string[];
  fromLocationId?: string;
  toLocationId?: string;
  jobId?: string;
  quantities?: Record<string, number>;
  conditions?: Record<string, string>;
  notes?: string;
  voiceSessionId?: string;
  detectionSessionId?: string;
}

export interface TransferRequest {
  tenantId: string;
  userId: string;
  itemIds: string[];
  fromLocationId: string;
  toLocationId: string;
  quantities?: Record<string, number>;
  notes?: string;
  voiceSessionId?: string;
}

export class UnifiedInventoryService {
  private itemRepo: ItemRepository;
  private transactionRepo: ItemTransactionRepository;
  private containerRepo: ContainerRepository;

  constructor() {
    const supabase = createSupabaseClient();
    this.itemRepo = new ItemRepository(supabase);
    this.transactionRepo = new ItemTransactionRepository(supabase);
    this.containerRepo = new ContainerRepository(supabase);
  }

  // ========== Item CRUD Operations ==========

  async createItem(data: ItemCreate): Promise<Item> {
    return await this.itemRepo.create(data);
  }

  async updateItem(id: string, data: ItemUpdate, tenantId: string): Promise<Item> {
    return await this.itemRepo.update(id, data, tenantId);
  }

  async getItem(id: string): Promise<Item | null> {
    return await this.itemRepo.findById(id);
  }

  async getItems(tenantId: string, filters?: ItemFilters, limit?: number, offset?: number) {
    return await this.itemRepo.findAll({ tenantId, filters, limit, offset });
  }

  async getItemByIdentifier(identifier: string, tenantId: string): Promise<Item | null> {
    return await this.itemRepo.findByIdentifier(identifier, tenantId);
  }

  async retireItem(id: string, tenantId: string): Promise<void> {
    await this.itemRepo.delete(id, tenantId);
  }

  // ========== Check Out Operations ==========

  async checkOut(request: CheckOutRequest): Promise<{
    success: boolean;
    items: Item[];
    transactions: ItemTransaction[];
    errors?: string[];
  }> {
    const { tenantId, userId, itemIds, jobId, locationId, quantities, notes, voiceSessionId, detectionSessionId } = request;
    const items: Item[] = [];
    const transactions: ItemTransaction[] = [];
    const errors: string[] = [];

    for (const itemId of itemIds) {
      try {
        // Get item
        const item = await this.itemRepo.findById(itemId);
        if (!item) {
          errors.push(`Item ${itemId} not found`);
          continue;
        }

        // Validate availability
        if (item.status !== 'active') {
          errors.push(`Item ${item.name} is not available (status: ${item.status})`);
          continue;
        }

        // Determine quantity
        const quantity = item.trackingMode === 'quantity' ? (quantities?.[itemId] || 1) : 1;

        // For quantity tracked items, check availability
        if (item.trackingMode === 'quantity' && item.currentQuantity < quantity) {
          errors.push(`Insufficient quantity for ${item.name} (available: ${item.currentQuantity})`);
          continue;
        }

        // Create transaction
        const transactionData: TransactionCreate = {
          tenantId,
          transactionType: 'check_out',
          itemId,
          quantity,
          fromLocationId: item.currentLocationId,
          toLocationId: locationId,
          fromUserId: undefined,
          toUserId: userId,
          jobId,
          notes,
          voiceSessionId,
          detectionSessionId,
          createdBy: userId,
        };

        const transaction = await this.transactionRepo.create(transactionData);
        transactions.push(transaction);

        // Update item
        const updates: ItemUpdate = {
          currentLocationId: locationId,
          assignedToJobId: jobId,
          assignedToUserId: userId,
        };

        if (item.trackingMode === 'quantity') {
          updates.currentQuantity = item.currentQuantity - quantity;
        }

        const updatedItem = await this.itemRepo.update(itemId, updates, tenantId);
        items.push(updatedItem);

        // Create container assignment if needed
        if (locationId && item.trackingMode === 'individual') {
          try {
            await this.containerRepo.createAssignment({
              tenant_id: tenantId,
              container_id: locationId,
              item_id: itemId,
              item_type: item.itemType === 'equipment' ? 'equipment' : 'tool',
              assigned_by: userId,
            });
          } catch (err) {
            console.error('Failed to create container assignment:', err);
          }
        }
      } catch (err: any) {
        errors.push(`Failed to check out item ${itemId}: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      items,
      transactions,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ========== Check In Operations ==========

  async checkIn(request: CheckInRequest): Promise<{
    success: boolean;
    items: Item[];
    transactions: ItemTransaction[];
    errors?: string[];
  }> {
    const { 
      tenantId, userId, itemIds, fromLocationId, toLocationId, 
      jobId, quantities, conditions, notes, voiceSessionId, detectionSessionId 
    } = request;
    const items: Item[] = [];
    const transactions: ItemTransaction[] = [];
    const errors: string[] = [];

    for (const itemId of itemIds) {
      try {
        // Get item
        const item = await this.itemRepo.findById(itemId);
        if (!item) {
          errors.push(`Item ${itemId} not found`);
          continue;
        }

        // Determine quantity
        const quantity = item.trackingMode === 'quantity' ? (quantities?.[itemId] || 1) : 1;

        // Create transaction
        const transactionData: TransactionCreate = {
          tenantId,
          transactionType: 'check_in',
          itemId,
          quantity,
          fromLocationId: fromLocationId || item.currentLocationId,
          toLocationId,
          fromUserId: userId,
          toUserId: undefined,
          jobId,
          notes,
          voiceSessionId,
          detectionSessionId,
          metadata: {
            previousStatus: item.status,
            newCondition: conditions?.[itemId],
          },
          createdBy: userId,
        };

        const transaction = await this.transactionRepo.create(transactionData);
        transactions.push(transaction);

        // Update item
        const updates: ItemUpdate = {
          currentLocationId: toLocationId,
          assignedToJobId: undefined,
          assignedToUserId: undefined,
        };

        if (conditions?.[itemId]) {
          updates.condition = conditions[itemId] as any;
        }

        if (item.trackingMode === 'quantity') {
          updates.currentQuantity = item.currentQuantity + quantity;
        }

        const updatedItem = await this.itemRepo.update(itemId, updates, tenantId);
        items.push(updatedItem);

        // Close container assignment if exists
        if (item.trackingMode === 'individual') {
          const assignment = await this.containerRepo.findActiveAssignment(itemId, tenantId);
          if (assignment) {
            try {
              await this.containerRepo.checkOutAssignment(
                assignment.id,
                userId,
                tenantId
              );
            } catch (err) {
              console.error('Failed to close container assignment:', err);
            }
          }
        }
      } catch (err: any) {
        errors.push(`Failed to check in item ${itemId}: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      items,
      transactions,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ========== Transfer Operations ==========

  async transfer(request: TransferRequest): Promise<{
    success: boolean;
    items: Item[];
    transactions: ItemTransaction[];
    errors?: string[];
  }> {
    const { tenantId, userId, itemIds, fromLocationId, toLocationId, quantities, notes, voiceSessionId } = request;
    
    if (fromLocationId === toLocationId) {
      return {
        success: false,
        items: [],
        transactions: [],
        errors: ['Source and destination locations cannot be the same'],
      };
    }

    const items: Item[] = [];
    const transactions: ItemTransaction[] = [];
    const errors: string[] = [];

    for (const itemId of itemIds) {
      try {
        // Get item
        const item = await this.itemRepo.findById(itemId);
        if (!item) {
          errors.push(`Item ${itemId} not found`);
          continue;
        }

        // Validate item is at source location
        if (item.currentLocationId !== fromLocationId) {
          errors.push(`Item ${item.name} is not at source location`);
          continue;
        }

        // Determine quantity
        const quantity = item.trackingMode === 'quantity' ? (quantities?.[itemId] || 1) : 1;

        // For quantity tracked items, check availability
        if (item.trackingMode === 'quantity' && item.currentQuantity < quantity) {
          errors.push(`Insufficient quantity for ${item.name}`);
          continue;
        }

        // Create transaction
        const transactionData: TransactionCreate = {
          tenantId,
          transactionType: 'transfer',
          itemId,
          quantity,
          fromLocationId,
          toLocationId,
          fromUserId: userId,
          toUserId: userId,
          notes,
          voiceSessionId,
          createdBy: userId,
        };

        const transaction = await this.transactionRepo.create(transactionData);
        transactions.push(transaction);

        // Update item location
        const updatedItem = await this.itemRepo.update(
          itemId,
          { currentLocationId: toLocationId },
          tenantId
        );
        items.push(updatedItem);

        // Update container assignments if needed
        if (item.trackingMode === 'individual') {
          // Close old assignment
          const oldAssignment = await this.containerRepo.findActiveAssignment(itemId, tenantId);
          if (oldAssignment) {
            await this.containerRepo.checkOutAssignment(oldAssignment.id, userId, tenantId);
          }

          // Create new assignment
          try {
            await this.containerRepo.createAssignment({
              tenant_id: tenantId,
              container_id: toLocationId,
              item_id: itemId,
              item_type: item.itemType === 'equipment' ? 'equipment' : 'tool',
              assigned_by: userId,
            });
          } catch (err) {
            console.error('Failed to create new container assignment:', err);
          }
        }
      } catch (err: any) {
        errors.push(`Failed to transfer item ${itemId}: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      items,
      transactions,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ========== Quantity Management ==========

  async adjustQuantity(
    itemId: string,
    adjustment: number,
    tenantId: string,
    userId: string,
    reason?: string
  ): Promise<Item> {
    // Update item quantity
    const item = await this.itemRepo.adjustQuantity(itemId, adjustment, tenantId, reason);

    // Record transaction
    await this.transactionRepo.create({
      tenantId,
      transactionType: 'adjustment',
      itemId,
      quantity: adjustment,
      reason,
      notes: `Quantity adjustment: ${adjustment > 0 ? '+' : ''}${adjustment}`,
      createdBy: userId,
    });

    return item;
  }

  // ========== Utility Methods ==========

  async getItemsNeedingReorder(tenantId: string): Promise<Item[]> {
    return await this.itemRepo.getItemsNeedingReorder(tenantId);
  }

  async getItemsDueForMaintenance(tenantId: string): Promise<Item[]> {
    return await this.itemRepo.getItemsDueForMaintenance(tenantId);
  }

  async getItemHistory(itemId: string, tenantId: string): Promise<ItemTransaction[]> {
    return await this.transactionRepo.getItemHistory(itemId, tenantId);
  }

  async getJobItems(jobId: string, tenantId: string): Promise<Item[]> {
    const { data } = await this.itemRepo.findAll({
      tenantId,
      filters: { assignedToJobId: jobId }
    });
    return data;
  }

  async getLocationItems(locationId: string, tenantId: string): Promise<Item[]> {
    const { data } = await this.itemRepo.findAll({
      tenantId,
      filters: { currentLocationId: locationId }
    });
    return data;
  }
}