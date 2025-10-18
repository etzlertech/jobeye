/**
 * Unified inventory service for all item operations
 * Replaces separate equipment, inventory, materials, and tools services
 */
import { ItemRepository } from '../repositories/item.repository';
import { ItemTransactionRepository, TransactionCreate } from '../repositories/item-transaction.repository';
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

  constructor() {
    const supabase = createSupabaseClient();
    this.itemRepo = new ItemRepository(supabase);
    this.transactionRepo = new ItemTransactionRepository(supabase);
  }

  // ========== Item CRUD Operations ==========

  async createItem(data: ItemCreate): Promise<Item> {
    return await this.itemRepo.create(data, { tenantId: data.tenantId });
  }

  async updateItem(id: string, data: ItemUpdate, tenantId: string): Promise<Item> {
    return await this.itemRepo.update(id, data, { tenantId });
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
    await this.itemRepo.retire(id, { tenantId });
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
          fromLocationId: item.currentLocationId ?? undefined,
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

        const updatedItem = await this.itemRepo.update(itemId, updates, { tenantId });
        items.push(updatedItem);

        // Container assignments removed (container table unavailable).
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
          fromLocationId: (fromLocationId ?? item.currentLocationId) ?? undefined,
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

        const updatedItem = await this.itemRepo.update(itemId, updates, { tenantId });
        items.push(updatedItem);

        // Container assignment closure removed.
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
          { tenantId }
        );
        items.push(updatedItem);

        // Container assignment updates removed.
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
