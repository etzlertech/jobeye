// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/material/repositories/material-repository.ts
// phase: 2
// domain: material-catalog
// purpose: Material data access with inventory tracking and multi-tenant isolation
// spec_ref: phase2/material-catalog#repository
// version: 2025-08-1
// complexity_budget: 400 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/lib/repositories/base.repository
//     - /src/domains/material/types/material-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - MaterialRepository: class - Material data access
//   - createMaterial: function - Create new material
//   - updateMaterial: function - Update material details
//   - findMaterialsByType: function - Filter by material type
//   - updateInventory: function - Track inventory changes
//   - findLowStock: function - Get materials needing reorder
//
// voice_considerations: |
//   Support voice-friendly material identification.
//   Store voice recordings of inventory counts.
//   Enable natural language material searches.
//   Track voice-confirmed stock levels.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/material/repositories/material-repository.test.ts
//
// tasks:
//   1. Extend BaseRepository for materials
//   2. Implement CRUD with tenant isolation
//   3. Add inventory tracking methods
//   4. Create material search and filtering
//   5. Implement cost tracking
//   6. Add voice metadata handling
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import {
  Material,
  MaterialCreate,
  MaterialUpdate,
  MaterialType,
  MaterialCategory,
  MaterialUnit,
  InventoryRecord,
  InventoryTransaction,
  materialCreateSchema,
  materialUpdateSchema,
} from '../types/material-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

export class MaterialRepository extends BaseRepository<'materials'> {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    super('materials', supabaseClient);
    this.supabaseClient = supabaseClient;
  }

  /**
   * Create new material with tenant isolation
   */
  async createMaterial(
    data: MaterialCreate,
    tenantId: string
  ): Promise<Material> {
    try {
      // Validate input
      const validated = materialCreateSchema.parse(data);

      // Generate material number
      const materialNumber = await this.generateMaterialNumber(tenantId);

      // Prepare initial inventory records
      const inventory = (validated.initialInventory || []).map(inv => ({
        ...inv,
        reservedStock: 0,
        lastUpdated: new Date().toISOString(),
        averageUsagePerWeek: 0,
      }));

      // Prepare pricing records
      const pricing = (validated.pricing || []).map(price => ({
        ...price,
        lastUpdated: new Date().toISOString(),
      }));

      const material = {
        material_number: materialNumber,
        tenant_id: tenantId,
        name: validated.name,
        description: validated.description,
        type: validated.type,
        category: validated.category,
        brand: validated.brand,
        manufacturer: validated.manufacturer,
        sku: validated.sku,
        barcode: validated.barcode,
        unit: validated.unit,
        packaging: validated.packaging,
        pricing,
        inventory,
        usage: {
          totalUsed: 0,
          unit: validated.unit,
          averagePerJob: 0,
        },
        safety: validated.safety || {},
        suppliers: validated.suppliers || [],
        photos: [],
        documents: [],
        application_notes: validated.applicationNotes,
        seasonal_availability: validated.seasonalAvailability,
        alternative_materials: [],
        tags: validated.tags || [],
        custom_fields: validated.customFields || {},
        is_active: true,
        metadata: {
          voiceCreated: !!validated.voiceMetadata,
          voiceMetadata: validated.voiceMetadata,
        },
      };

      const { data: created, error } = await this.supabaseClient
        .from('materials')
        .insert(material)
        .select('*')
        .single();

      if (error) throw error;

      return this.mapToMaterial(created);
    } catch (error) {
      throw createAppError({
        code: 'MATERIAL_CREATE_FAILED',
        message: 'Failed to create material',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update material with version control
   */
  async updateMaterial(
    materialId: string,
    updates: MaterialUpdate,
    tenantId: string
  ): Promise<Material | null> {
    try {
      const validated = materialUpdateSchema.parse(updates);

      const updateData: any = {};

      if (validated.name) updateData.name = validated.name;
      if (validated.description !== undefined) updateData.description = validated.description;
      if (validated.type) updateData.type = validated.type;
      if (validated.category) updateData.category = validated.category;
      if (validated.brand !== undefined) updateData.brand = validated.brand;
      if (validated.manufacturer !== undefined) updateData.manufacturer = validated.manufacturer;
      if (validated.sku !== undefined) updateData.sku = validated.sku;
      if (validated.barcode !== undefined) updateData.barcode = validated.barcode;
      if (validated.unit) updateData.unit = validated.unit;
      if (validated.packaging !== undefined) updateData.packaging = validated.packaging;
      if (validated.safety) updateData.safety = validated.safety;
      if (validated.applicationNotes !== undefined) updateData.application_notes = validated.applicationNotes;
      if (validated.seasonalAvailability !== undefined) updateData.seasonal_availability = validated.seasonalAvailability;
      if (validated.alternativeMaterials) updateData.alternative_materials = validated.alternativeMaterials;
      if (validated.tags) updateData.tags = validated.tags;
      if (validated.customFields) updateData.custom_fields = validated.customFields;
      if (validated.is_active !== undefined) updateData.is_active = validated.is_active;

      const { data: updated, error } = await this.supabaseClient
        .from('materials')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', materialId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapToMaterial(updated);
    } catch (error) {
      throw createAppError({
        code: 'MATERIAL_UPDATE_FAILED',
        message: 'Failed to update material',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find material by ID with tenant isolation
   */
  async findById(materialId: string, tenantId: string): Promise<Material | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('materials')
        .select('*')
        .eq('id', materialId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToMaterial(data);
    } catch (error) {
      throw createAppError({
        code: 'MATERIAL_FETCH_FAILED',
        message: 'Failed to fetch material',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find all materials with filters
   */
  async findAll(options: {
    tenantId: string;
    filters?: {
      type?: MaterialType;
      category?: MaterialCategory;
      brand?: string;
      is_active?: boolean;
      lowStock?: boolean;
    };
    limit?: number;
    offset?: number;
  }): Promise<{ data: Material[]; count: number }> {
    try {
      let query = this.supabaseClient
        .from('materials')
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId);

      if (options.filters) {
        if (options.filters.type) {
          query = query.eq('type', options.filters.type);
        }
        if (options.filters.category) {
          query = query.eq('category', options.filters.category);
        }
        if (options.filters.brand) {
          query = query.ilike('brand', `%${options.filters.brand}%`);
        }
        if (options.filters.is_active !== undefined) {
          query = query.eq('is_active', options.filters.is_active);
        }
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error, count } = await query.order('name');

      if (error) throw error;

      let materials = (data || []).map(row => this.mapToMaterial(row));

      // Filter for low stock if requested
      if (options.filters?.lowStock) {
        materials = materials.filter(material => 
          material.inventory.some(inv => inv.currentStock <= inv.reorderLevel)
        );
      }

      return {
        data: materials,
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'MATERIALS_FETCH_FAILED',
        message: 'Failed to fetch materials list',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find materials by type
   */
  async findMaterialsByType(
    type: MaterialType,
    tenantId: string
  ): Promise<Material[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('materials')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('type', type)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return (data || []).map(row => this.mapToMaterial(row));
    } catch (error) {
      throw createAppError({
        code: 'MATERIAL_TYPE_SEARCH_FAILED',
        message: 'Failed to find materials by type',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find materials by SKU or barcode
   */
  async findBySku(
    sku: string,
    tenantId: string
  ): Promise<Material | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('materials')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`sku.eq.${sku},barcode.eq.${sku}`)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToMaterial(data);
    } catch (error) {
      throw createAppError({
        code: 'MATERIAL_SKU_SEARCH_FAILED',
        message: 'Failed to find material by SKU/barcode',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Search materials by name, brand, or description
   */
  async searchMaterials(
    searchTerm: string,
    tenantId: string,
    limit: number = 20
  ): Promise<Material[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('materials')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .limit(limit)
        .order('name');

      if (error) throw error;

      return (data || []).map(row => this.mapToMaterial(row));
    } catch (error) {
      throw createAppError({
        code: 'MATERIAL_SEARCH_FAILED',
        message: 'Failed to search materials',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update inventory for a specific location
   */
  async updateInventory(
    materialId: string,
    locationId: string,
    inventoryUpdate: Partial<InventoryRecord>,
    tenantId: string
  ): Promise<Material | null> {
    try {
      // Get current material
      const material = await this.findById(materialId, tenantId);
      if (!material) return null;

      // Update the specific location inventory
      const updatedInventory = material.inventory.map(inv => {
        if (inv.locationId === locationId) {
          return {
            ...inv,
            ...inventoryUpdate,
            lastUpdated: new Date(),
          };
        }
        return inv;
      });

      // If location doesn't exist, add it
      if (!material.inventory.find(inv => inv.locationId === locationId)) {
        if (inventoryUpdate.locationName && inventoryUpdate.currentStock !== undefined) {
          updatedInventory.push({
            locationId,
            locationName: inventoryUpdate.locationName,
            currentStock: inventoryUpdate.currentStock,
            reservedStock: 0,
            reorderLevel: inventoryUpdate.reorderLevel || 0,
            maxStock: inventoryUpdate.maxStock || 1000,
            lastUpdated: new Date(),
            averageUsagePerWeek: 0,
            ...inventoryUpdate,
          } as InventoryRecord);
        }
      }

      const { data: updated, error } = await this.supabaseClient
        .from('materials')
        .update({
          inventory: updatedInventory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', materialId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) throw error;

      return this.mapToMaterial(updated);
    } catch (error) {
      throw createAppError({
        code: 'INVENTORY_UPDATE_FAILED',
        message: 'Failed to update material inventory',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find materials with low stock
   */
  async findLowStock(tenantId: string): Promise<Material[]> {
    try {
      const result = await this.findAll({
        tenantId,
        filters: { lowStock: true, is_active: true },
      });

      return result.data;
    } catch (error) {
      throw createAppError({
        code: 'LOW_STOCK_SEARCH_FAILED',
        message: 'Failed to find low stock materials',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete material (soft delete)
   */
  async delete(materialId: string, tenantId: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseClient
        .from('materials')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', materialId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw createAppError({
        code: 'MATERIAL_DELETE_FAILED',
        message: 'Failed to delete material',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Generate unique material number
   */
  private async generateMaterialNumber(tenantId: string): Promise<string> {
    const prefix = 'MAT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Map database row to Material type
   */
  private mapToMaterial(row: any): Material {
    if (!row) throw new Error('Cannot map null row to Material');

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      material_number: row.material_number,
      name: row.name,
      description: row.description,
      type: row.type as MaterialType,
      category: row.category as MaterialCategory,
      brand: row.brand,
      manufacturer: row.manufacturer,
      sku: row.sku,
      barcode: row.barcode,
      unit: row.unit as MaterialUnit,
      packaging: row.packaging,
      pricing: (row.pricing || []).map((p: any) => ({
        ...p,
        lastUpdated: new Date(p.lastUpdated),
      })),
      inventory: (row.inventory || []).map((i: any) => ({
        ...i,
        lastUpdated: new Date(i.lastUpdated),
        lastCountDate: i.lastCountDate ? new Date(i.lastCountDate) : undefined,
      })),
      usage: {
        totalUsed: row.usage?.totalUsed || 0,
        unit: row.usage?.unit || row.unit,
        averagePerJob: row.usage?.averagePerJob || 0,
        peakUsageMonth: row.usage?.peakUsageMonth,
        costPerJob: row.usage?.costPerJob,
        lastUsedDate: row.usage?.lastUsedDate ? new Date(row.usage.lastUsedDate) : undefined,
      },
      safety: row.safety || {},
      suppliers: row.suppliers || [],
      photos: row.photos || [],
      documents: row.documents || [],
      applicationNotes: row.application_notes,
      seasonalAvailability: row.seasonal_availability,
      alternativeMaterials: row.alternative_materials || [],
      tags: row.tags || [],
      customFields: row.custom_fields || {},
      is_active: row.is_active,
      version: row.version || 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }
}

// Convenience export
export const createMaterialRepository = (supabase: SupabaseClient): MaterialRepository => {
  return new MaterialRepository(supabase);
};