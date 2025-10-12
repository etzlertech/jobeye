/**
 * Unified item repository for all trackable items
 * Consolidates equipment, materials, tools, and consumables
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import {
  Item,
  ItemCreate,
  ItemUpdate,
  ItemFilters,
  ItemSchema,
  ItemCreateSchema,
  ItemUpdateSchema,
  ItemType,
  TrackingMode,
} from '@/domains/shared/types/item-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

export class ItemRepository extends BaseRepository<Item> {
  constructor(supabaseClient: SupabaseClient) {
    super('items', supabaseClient);
  }

  /**
   * Find item by ID
   */
  async findById(id: string): Promise<Item | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapFromDb(data);
    } catch (error) {
      throw createAppError({
        code: 'ITEM_FIND_FAILED',
        message: `Failed to find item: ${id}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find items with filters
   */
  async findAll(options: {
    tenantId: string;
    filters?: ItemFilters;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Item[]; count: number }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId);

      // Apply filters
      if (options.filters) {
        const { filters } = options;
        
        if (filters.itemType) {
          query = query.eq('item_type', filters.itemType);
        }
        if (filters.category) {
          query = query.eq('category', filters.category);
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.trackingMode) {
          query = query.eq('tracking_mode', filters.trackingMode);
        }
        if (filters.assignedToJobId) {
          query = query.eq('assigned_to_job_id', filters.assignedToJobId);
        }
        if (filters.assignedToUserId) {
          query = query.eq('assigned_to_user_id', filters.assignedToUserId);
        }
        if (filters.currentLocationId) {
          query = query.eq('current_location_id', filters.currentLocationId);
        }
        if (filters.searchTerm) {
          query = query.or(
            `name.ilike.%${filters.searchTerm}%,` +
            `description.ilike.%${filters.searchTerm}%,` +
            `sku.ilike.%${filters.searchTerm}%,` +
            `barcode.ilike.%${filters.searchTerm}%`
          );
        }
        if (filters.tags && filters.tags.length > 0) {
          query = query.contains('tags', filters.tags);
        }
      }

      // Apply pagination
      if (options.offset !== undefined && options.limit) {
        query = query.range(options.offset, options.offset + options.limit - 1);
      } else if (options.limit) {
        query = query.limit(options.limit);
      }

      // Order by updated_at desc
      query = query.order('updated_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []).map(item => this.mapFromDb(item)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'ITEM_LIST_FAILED',
        message: 'Failed to list items',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Type-specific query methods
   */
  async findEquipment(tenantId: string, filters?: Omit<ItemFilters, 'itemType'>) {
    return this.findAll({
      tenantId,
      filters: { ...filters, itemType: 'equipment' }
    });
  }

  async findMaterials(tenantId: string, filters?: Omit<ItemFilters, 'itemType'>) {
    return this.findAll({
      tenantId,
      filters: { ...filters, itemType: 'material' }
    });
  }

  async findTools(tenantId: string, filters?: Omit<ItemFilters, 'itemType'>) {
    return this.findAll({
      tenantId,
      filters: { ...filters, itemType: 'tool' }
    });
  }

  async findConsumables(tenantId: string, filters?: Omit<ItemFilters, 'itemType'>) {
    return this.findAll({
      tenantId,
      filters: { ...filters, itemType: 'consumable' }
    });
  }

  /**
   * Find items by barcode or serial number
   */
  async findByIdentifier(identifier: string, tenantId: string): Promise<Item | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`barcode.eq.${identifier},serial_number.eq.${identifier}`)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapFromDb(data);
    } catch (error) {
      throw createAppError({
        code: 'ITEM_IDENTIFIER_FIND_FAILED',
        message: `Failed to find item by identifier: ${identifier}`,
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Create new item with validation
   */
  async create(data: ItemCreate): Promise<Item> {
    try {
      // Validate input
      const validated = ItemCreateSchema.parse(data);

      // Check for duplicate identifiers
      if (validated.barcode || validated.serialNumber || validated.sku) {
        const existing = await this.checkDuplicateIdentifiers(
          validated.tenantId,
          validated.barcode,
          validated.serialNumber,
          validated.sku
        );
        
        if (existing) {
          throw createAppError({
            code: 'ITEM_DUPLICATE_IDENTIFIER',
            message: `Item with identical identifier already exists`,
            severity: ErrorSeverity.LOW,
            category: ErrorCategory.VALIDATION,
          });
        }
      }

      const { data: created, error } = await this.supabase
        .from(this.tableName)
        .insert(this.mapToDb(validated))
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(created);
    } catch (error) {
      throw createAppError({
        code: 'ITEM_CREATE_FAILED',
        message: 'Failed to create item',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update item with validation
   */
  async update(id: string, data: ItemUpdate, tenantId: string): Promise<Item> {
    try {
      // Validate input
      const validated = ItemUpdateSchema.parse(data);

      const { data: updated, error } = await this.supabase
        .from(this.tableName)
        .update({
          ...this.mapToDb(validated),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(updated);
    } catch (error) {
      throw createAppError({
        code: 'ITEM_UPDATE_FAILED',
        message: 'Failed to update item',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Soft delete item
   */
  async delete(id: string, tenantId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .update({ 
          status: 'retired',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    } catch (error) {
      throw createAppError({
        code: 'ITEM_DELETE_FAILED',
        message: 'Failed to delete item',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Adjust quantity for quantity-tracked items
   */
  async adjustQuantity(
    itemId: string,
    adjustment: number,
    tenantId: string,
    reason?: string
  ): Promise<Item> {
    try {
      // Get current item
      const current = await this.findById(itemId);
      if (!current) {
        throw createAppError({
          code: 'ITEM_NOT_FOUND',
          message: 'Item not found',
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.NOT_FOUND,
        });
      }

      // Verify it's quantity tracked
      if (current.trackingMode !== 'quantity' && current.trackingMode !== 'batch') {
        throw createAppError({
          code: 'ITEM_NOT_QUANTITY_TRACKED',
          message: 'Item is not quantity tracked',
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.VALIDATION,
        });
      }

      // Calculate new quantity
      const newQuantity = current.currentQuantity + adjustment;
      if (newQuantity < 0) {
        throw createAppError({
          code: 'INSUFFICIENT_QUANTITY',
          message: `Insufficient quantity. Available: ${current.currentQuantity}, Requested: ${Math.abs(adjustment)}`,
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Update quantity
      return await this.update(
        itemId,
        { currentQuantity: newQuantity },
        tenantId
      );
    } catch (error) {
      throw createAppError({
        code: 'QUANTITY_ADJUST_FAILED',
        message: 'Failed to adjust item quantity',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get items needing reorder
   */
  async getItemsNeedingReorder(tenantId: string): Promise<Item[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .in('tracking_mode', ['quantity', 'batch'])
        .not('reorder_point', 'is', null)
        .filter('current_quantity', 'lte', 'reorder_point');

      if (error) throw error;

      return (data || []).map(item => this.mapFromDb(item));
    } catch (error) {
      throw createAppError({
        code: 'REORDER_CHECK_FAILED',
        message: 'Failed to check items needing reorder',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get items due for maintenance
   */
  async getItemsDueForMaintenance(tenantId: string): Promise<Item[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .not('next_maintenance_date', 'is', null)
        .lte('next_maintenance_date', today);

      if (error) throw error;

      return (data || []).map(item => this.mapFromDb(item));
    } catch (error) {
      throw createAppError({
        code: 'MAINTENANCE_CHECK_FAILED',
        message: 'Failed to check items due for maintenance',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  // Private helper methods

  private async checkDuplicateIdentifiers(
    tenantId: string,
    barcode?: string,
    serialNumber?: string,
    sku?: string
  ): Promise<boolean> {
    const conditions: string[] = [];
    
    if (barcode) conditions.push(`barcode.eq.${barcode}`);
    if (serialNumber) conditions.push(`serial_number.eq.${serialNumber}`);
    if (sku) conditions.push(`sku.eq.${sku}`);

    if (conditions.length === 0) return false;

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('id')
      .eq('tenant_id', tenantId)
      .or(conditions.join(','))
      .limit(1);

    if (error) throw error;

    return (data?.length ?? 0) > 0;
  }

  /**
   * Map from database format to domain model
   */
  private mapFromDb(data: any): Item {
    return ItemSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      itemType: data.item_type,
      category: data.category,
      trackingMode: data.tracking_mode,
      name: data.name,
      description: data.description,
      manufacturer: data.manufacturer,
      model: data.model,
      serialNumber: data.serial_number,
      sku: data.sku,
      barcode: data.barcode,
      currentQuantity: data.current_quantity,
      unitOfMeasure: data.unit_of_measure,
      minQuantity: data.min_quantity,
      maxQuantity: data.max_quantity,
      reorderPoint: data.reorder_point,
      currentLocationId: data.current_location_id,
      homeLocationId: data.home_location_id,
      assignedToUserId: data.assigned_to_user_id,
      assignedToJobId: data.assigned_to_job_id,
      status: data.status,
      condition: data.condition,
      lastMaintenanceDate: data.last_maintenance_date,
      nextMaintenanceDate: data.next_maintenance_date,
      purchaseDate: data.purchase_date,
      purchasePrice: data.purchase_price,
      currentValue: data.current_value,
      depreciationMethod: data.depreciation_method,
      attributes: data.attributes,
      tags: data.tags,
      customFields: data.custom_fields,
      primaryImageUrl: data.primary_image_url,
      imageUrls: data.image_urls,
      createdAt: data.created_at,
      createdBy: data.created_by,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    });
  }

  /**
   * Map from domain model to database format
   */
  private mapToDb(data: Partial<Item>): any {
    const mapped: any = {};
    
    if (data.id !== undefined) mapped.id = data.id;
    if (data.tenantId !== undefined) mapped.tenant_id = data.tenantId;
    if (data.itemType !== undefined) mapped.item_type = data.itemType;
    if (data.category !== undefined) mapped.category = data.category;
    if (data.trackingMode !== undefined) mapped.tracking_mode = data.trackingMode;
    if (data.name !== undefined) mapped.name = data.name;
    if (data.description !== undefined) mapped.description = data.description;
    if (data.manufacturer !== undefined) mapped.manufacturer = data.manufacturer;
    if (data.model !== undefined) mapped.model = data.model;
    if (data.serialNumber !== undefined) mapped.serial_number = data.serialNumber;
    if (data.sku !== undefined) mapped.sku = data.sku;
    if (data.barcode !== undefined) mapped.barcode = data.barcode;
    if (data.currentQuantity !== undefined) mapped.current_quantity = data.currentQuantity;
    if (data.unitOfMeasure !== undefined) mapped.unit_of_measure = data.unitOfMeasure;
    if (data.minQuantity !== undefined) mapped.min_quantity = data.minQuantity;
    if (data.maxQuantity !== undefined) mapped.max_quantity = data.maxQuantity;
    if (data.reorderPoint !== undefined) mapped.reorder_point = data.reorderPoint;
    if (data.currentLocationId !== undefined) mapped.current_location_id = data.currentLocationId;
    if (data.homeLocationId !== undefined) mapped.home_location_id = data.homeLocationId;
    if (data.assignedToUserId !== undefined) mapped.assigned_to_user_id = data.assignedToUserId;
    if (data.assignedToJobId !== undefined) mapped.assigned_to_job_id = data.assignedToJobId;
    if (data.status !== undefined) mapped.status = data.status;
    if (data.condition !== undefined) mapped.condition = data.condition;
    if (data.lastMaintenanceDate !== undefined) mapped.last_maintenance_date = data.lastMaintenanceDate;
    if (data.nextMaintenanceDate !== undefined) mapped.next_maintenance_date = data.nextMaintenanceDate;
    if (data.purchaseDate !== undefined) mapped.purchase_date = data.purchaseDate;
    if (data.purchasePrice !== undefined) mapped.purchase_price = data.purchasePrice;
    if (data.currentValue !== undefined) mapped.current_value = data.currentValue;
    if (data.depreciationMethod !== undefined) mapped.depreciation_method = data.depreciationMethod;
    if (data.attributes !== undefined) mapped.attributes = data.attributes;
    if (data.tags !== undefined) mapped.tags = data.tags;
    if (data.customFields !== undefined) mapped.custom_fields = data.customFields;
    if (data.primaryImageUrl !== undefined) mapped.primary_image_url = data.primaryImageUrl;
    if (data.imageUrls !== undefined) mapped.image_urls = data.imageUrls;
    if (data.createdBy !== undefined) mapped.created_by = data.createdBy;
    if (data.updatedBy !== undefined) mapped.updated_by = data.updatedBy;

    return mapped;
  }
}

// Export for convenience
export { Item, ItemCreate, ItemUpdate, ItemFilters } from '@/domains/shared/types/item-types';