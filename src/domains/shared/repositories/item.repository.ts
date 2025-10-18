/**
 * Unified item repository for all trackable items
 * Consolidates equipment, materials, tools, and consumables
 */
import type { SupabaseClient } from '@supabase/supabase-js';
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
import type { Database } from '@/types/database';

type ItemRow = Database['public']['Tables']['items']['Row'];
type ItemRowInsert = Database['public']['Tables']['items']['Insert'];
type ItemRowUpdate = Database['public']['Tables']['items']['Update'];

export class ItemRepository extends BaseRepository<'items', Item, ItemCreate, ItemUpdate> {
  constructor(supabaseClient: SupabaseClient<Database>) {
    super('items', supabaseClient);
  }

  /**
   * Typed query builder for the items table. Supabase's generics do not play nicely
   * with our class abstraction, so we centralise the cast in one place.
   */
  private itemsTable() {
    return this.supabase.from('items') as any;
  }

  /**
   * Find item by ID
   */
  async findById(id: string, options: { tenantId?: string } = {}): Promise<Item | null> {
    try {
      let query = this.itemsTable()
        .select('*')
        .eq('id', id);

      if (options.tenantId) {
        query = query.eq('tenant_id', options.tenantId);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      if (!data) {
        return null;
      }

      return this.mapFromDb(data as ItemRow);
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
      let query = this.itemsTable()
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

      const rows = (data ?? []) as ItemRow[];
      return {
        data: rows.map(row => this.mapFromDb(row)),
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
      const { data, error } = await this.itemsTable()
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`barcode.eq.${identifier},serial_number.eq.${identifier}`)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      if (!data) {
        return null;
      }

      return this.mapFromDb(data as ItemRow);
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
  async create(
    data: ItemCreate,
    options: { tenantId?: string } = {}
  ): Promise<Item> {
    try {
      // Validate input
      const tenantId = options.tenantId ?? data.tenantId;
      if (!tenantId) {
        throw createAppError({
          code: 'ITEM_TENANT_REQUIRED',
          message: 'Tenant ID is required to create an item',
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.VALIDATION,
        });
      }

      const validated = ItemCreateSchema.parse({
        ...data,
        tenantId,
      });

      // Check for duplicate identifiers
      if (validated.barcode || validated.serialNumber || validated.sku) {
        const existing = await this.checkDuplicateIdentifiers(
          tenantId,
          validated.barcode ?? undefined,
          validated.serialNumber ?? undefined,
          validated.sku ?? undefined
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

      const dbInsert = this.mapToDb(validated) as ItemRowInsert;

      const { data: created, error } = await this.itemsTable()
        .insert(dbInsert)
        .select()
        .single();

      if (error) throw error;

      if (!created) {
        throw createAppError({
          code: 'ITEM_CREATE_FAILED',
          message: 'Supabase did not return created item',
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.DATABASE,
        });
      }

      return this.mapFromDb(created as ItemRow);
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
  async update(
    id: string,
    data: ItemUpdate,
    options: { tenantId?: string } = {}
  ): Promise<Item> {
    try {
      // Validate input
      const tenantId = options.tenantId ?? data.tenantId;
      if (!tenantId) {
        throw createAppError({
          code: 'ITEM_TENANT_REQUIRED',
          message: 'Tenant ID is required to update an item',
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.VALIDATION,
        });
      }

      const validated = ItemUpdateSchema.parse({
        ...data,
        tenantId,
      });

      const dbUpdate = {
        ...this.mapToDb(validated),
        updated_at: new Date().toISOString(),
      } as ItemRowUpdate;

      const { data: updated, error } = await this.itemsTable()
        .update(dbUpdate)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      if (!updated) {
        throw createAppError({
          code: 'ITEM_UPDATE_FAILED',
          message: 'Supabase did not return updated item',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.DATABASE,
        });
      }

      return this.mapFromDb(updated as ItemRow);
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
  async retire(id: string, options: { tenantId?: string } = {}): Promise<void> {
    try {
      const tenantId = options.tenantId;
      if (!tenantId) {
        throw createAppError({
          code: 'ITEM_TENANT_REQUIRED',
          message: 'Tenant ID is required to retire an item',
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.VALIDATION,
        });
      }

      const dbUpdate: ItemRowUpdate = {
        status: 'retired',
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.itemsTable()
        .update(dbUpdate)
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
          category: ErrorCategory.BUSINESS_LOGIC,
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
        { tenantId }
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
      const { data, error } = await this.itemsTable()
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .in('tracking_mode', ['quantity', 'batch'])
        .not('reorder_point', 'is', null)
        .filter('current_quantity', 'lte', 'reorder_point');

      if (error) throw error;

      const rows = (data ?? []) as ItemRow[];
      return rows.map(row => this.mapFromDb(row));
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
      
      const { data, error } = await this.itemsTable()
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .not('next_maintenance_date', 'is', null)
        .lte('next_maintenance_date', today);

      if (error) throw error;

      const rows = (data ?? []) as ItemRow[];
      return rows.map(row => this.mapFromDb(row));
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

    const { data, error } = await this.itemsTable()
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
  private mapFromDb(data: ItemRow): Item {
    return ItemSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      itemType: data.item_type,
      category: data.category,
      trackingMode: data.tracking_mode,
      name: data.name,
      description: data.description || null,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      serialNumber: data.serial_number || null,
      sku: data.sku || null,
      barcode: data.barcode || null,
      currentQuantity: data.current_quantity ?? 0,
      unitOfMeasure: data.unit_of_measure || 'each',
      minQuantity: data.min_quantity || null,
      maxQuantity: data.max_quantity || null,
      reorderPoint: data.reorder_point || null,
      currentLocationId: data.current_location_id || null,
      homeLocationId: data.home_location_id || null,
      assignedToUserId: data.assigned_to_user_id || null,
      assignedToJobId: data.assigned_to_job_id || null,
      status: data.status || 'active',
      condition: data.condition || null,
      lastMaintenanceDate: data.last_maintenance_date || null,
      nextMaintenanceDate: data.next_maintenance_date || null,
      purchaseDate: data.purchase_date || null,
      purchasePrice: data.purchase_price || null,
      currentValue: data.current_value || null,
      depreciationMethod: data.depreciation_method || null,
      attributes: data.attributes || {},
      tags: data.tags || [],
      customFields: data.custom_fields || {},
      primaryImageUrl: data.primary_image_url || null,
      thumbnailUrl: data.thumbnail_url || null,
      mediumUrl: data.medium_url || null,
      imageUrls: data.image_urls || [],
      createdAt: data.created_at,
      createdBy: data.created_by || null,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by || null,
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
    if (data.thumbnailUrl !== undefined) mapped.thumbnail_url = data.thumbnailUrl;
    if (data.mediumUrl !== undefined) mapped.medium_url = data.mediumUrl;
    if (data.imageUrls !== undefined) mapped.image_urls = data.imageUrls;
    if (data.createdBy !== undefined) mapped.created_by = data.createdBy;
    if (data.updatedBy !== undefined) mapped.updated_by = data.updatedBy;

    return mapped;
  }
}

// Export for convenience
export type { Item, ItemCreate, ItemUpdate, ItemFilters } from '@/domains/shared/types/item-types';
