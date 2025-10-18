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
//     - /src/domains/material/types/material-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - MaterialRepository: class - Material data access
//   - createMaterialRepository: function - Factory helper
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
//   1. Persist materials in the shared items table
//   2. Implement CRUD with tenant isolation
//   3. Add inventory tracking helpers
//   4. Support search and SKU lookup
//   5. Handle soft-delete lifecycle
// --- END DIRECTIVE BLOCK ---

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  Material,
  MaterialCreate,
  MaterialUpdate,
  MaterialType,
  MaterialCategory,
  MaterialUnit,
  InventoryRecord,
  MaterialSupplier,
  MaterialPricing,
  MaterialSafety,
  MaterialUsage,
  materialCreateSchema,
  materialUpdateSchema,
} from '../types/material-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

type ItemsTable = Database['public']['Tables']['items'];
type ItemRow = ItemsTable['Row'];
type ItemInsert = ItemsTable['Insert'];
type ItemUpdatePayload = ItemsTable['Update'];

interface StoredPricing extends Omit<MaterialPricing, 'lastUpdated'> {
  lastUpdated: string;
}

interface StoredInventoryRecord {
  locationId: string;
  locationName: string;
  currentStock: number;
  unit: MaterialUnit;
  reservedStock: number;
  reorderLevel: number;
  maxStock: number;
  averageUsagePerWeek?: number;
  batchNumber?: string;
  lastUpdated: string;
  lastCountDate?: string | null;
  expirationDate?: string | null;
}

interface StoredUsage extends Omit<MaterialUsage, 'lastUsedDate'> {
  lastUsedDate?: string | null;
}

interface StoredMaterialAttributes {
  materialNumber: string;
  materialType: MaterialType;
  brand?: string | null;
  packaging?: string | null;
  pricing: StoredPricing[];
  inventory: StoredInventoryRecord[];
  usage: StoredUsage;
  safety?: MaterialSafety | null;
  suppliers: MaterialSupplier[];
  documents?: string[];
  applicationNotes?: string | null;
  seasonalAvailability?: string | null;
  alternativeMaterials?: string[];
  version: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  voiceMetadata?: unknown;
  customFields?: Record<string, unknown> | null;
}

const MATERIAL_ITEM_TYPE = 'material';
const ACTIVE_STATUS = 'active';
const INACTIVE_STATUS = 'inactive';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const coerceMaterialType = (value: unknown): MaterialType =>
  Object.values(MaterialType).includes(value as MaterialType) ? (value as MaterialType) : MaterialType.OTHER;

const coerceMaterialCategory = (value: unknown): MaterialCategory =>
  Object.values(MaterialCategory).includes(value as MaterialCategory)
    ? (value as MaterialCategory)
    : MaterialCategory.CONSUMABLES;

const coerceMaterialUnit = (value: unknown): MaterialUnit =>
  Object.values(MaterialUnit).includes(value as MaterialUnit) ? (value as MaterialUnit) : MaterialUnit.EACH;

export class MaterialRepository {
  constructor(private readonly supabaseClient: SupabaseClient<Database>) {}

  private get client(): SupabaseClient<any> {
    return this.supabaseClient as unknown as SupabaseClient<any>;
  }

  /**
   * Create a new material stored inside the shared items table.
   */
  async createMaterial(data: MaterialCreate, tenantId: string): Promise<Material> {
    try {
      const validated = materialCreateSchema.parse(data);
      const createdAtIso = new Date().toISOString();
      const materialNumber = await this.generateMaterialNumber(tenantId);

      const storedPricing: StoredPricing[] = (validated.pricing ?? []).map(pricing => ({
        unitCost: pricing.unitCost,
        unit: pricing.unit,
        supplier: pricing.supplier,
        bulkPricing: (pricing.bulkPricing ?? []).map(tier => ({
          minQuantity: tier.minQuantity,
          unitCost: tier.unitCost,
          unit: tier.unit,
        })),
        lastUpdated: createdAtIso,
      }));

      const suppliers: MaterialSupplier[] = (validated.suppliers ?? []).map(supplier => ({
        id: supplier.id,
        name: supplier.name,
        contactPhone: supplier.contactPhone,
        contactEmail: supplier.contactEmail,
        website: supplier.website,
        accountNumber: supplier.accountNumber,
        deliveryAvailable: supplier.deliveryAvailable ?? false,
        preferredSupplier: supplier.preferredSupplier ?? false,
      }));

      const safety: MaterialSafety | null = validated.safety
        ? {
            requiresPPE: validated.safety.requiresPPE,
            hazardous: validated.safety.hazardous,
            ppeRequired: validated.safety.ppeRequired,
            storageRequirements: validated.safety.storageRequirements,
            mixingInstructions: validated.safety.mixingInstructions,
            applicationRate: validated.safety.applicationRate,
            msdsUrl: validated.safety.msdsUrl,
            expirationWarningDays: validated.safety.expirationWarningDays,
          }
        : null;

      const storedInventory: StoredInventoryRecord[] = (validated.initialInventory ?? []).map(record => ({
        locationId: record.locationId,
        locationName: record.locationName,
        currentStock: record.currentStock,
        unit: validated.unit,
        reservedStock: 0,
        reorderLevel: record.reorderLevel,
        maxStock: record.maxStock,
        lastUpdated: createdAtIso,
        averageUsagePerWeek: 0,
      }));

      const attributes: StoredMaterialAttributes = {
        materialNumber,
        materialType: validated.type,
        brand: validated.brand ?? null,
        packaging: validated.packaging ?? null,
        pricing: storedPricing,
        inventory: storedInventory,
        usage: {
          totalUsed: 0,
          unit: validated.unit,
          averagePerJob: 0,
        },
        safety,
        suppliers,
        documents: [],
        applicationNotes: validated.applicationNotes ?? null,
        seasonalAvailability: validated.seasonalAvailability ?? null,
        alternativeMaterials: [],
        version: 1,
        createdBy: null,
        updatedBy: null,
        voiceMetadata: data.voiceMetadata ?? null,
        customFields: validated.customFields ?? {},
      };

      const insertPayload: ItemInsert = {
        tenant_id: tenantId,
        item_type: MATERIAL_ITEM_TYPE,
        category: validated.category,
        tracking_mode: 'quantity',
        name: validated.name,
        description: validated.description ?? null,
        manufacturer: validated.manufacturer ?? null,
        sku: validated.sku ?? null,
        barcode: validated.barcode ?? null,
        unit_of_measure: validated.unit,
        status: ACTIVE_STATUS,
        attributes: attributes as unknown as ItemInsert['attributes'],
        tags: validated.tags && validated.tags.length > 0 ? validated.tags : null,
        custom_fields: validated.customFields ?? null,
      };

      const { data: inserted, error } = await this.client
        .from('items')
        .insert(insertPayload as any)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return this.mapToMaterial(inserted);
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
   * Update an existing material.
   */
  async updateMaterial(materialId: string, updates: MaterialUpdate, tenantId: string): Promise<Material | null> {
    try {
      const validated = materialUpdateSchema.parse(updates);
      const existingRow = await this.fetchMaterialRow(materialId, tenantId);
      if (!existingRow) {
        return null;
      }

      const attributes = this.ensureAttributes(existingRow);
      const mergedSafety = (() => {
        if (!validated.safety) {
          return attributes.safety ?? null;
        }

        const base: MaterialSafety = attributes.safety ?? {
          requiresPPE: validated.safety.requiresPPE ?? false,
          hazardous: validated.safety.hazardous ?? false,
        };

        return {
          ...base,
          ...validated.safety,
          requiresPPE: validated.safety.requiresPPE ?? base.requiresPPE,
          hazardous: validated.safety.hazardous ?? base.hazardous,
        };
      })();

      const updatedAttributes: StoredMaterialAttributes = {
        ...attributes,
        brand: validated.brand ?? attributes.brand ?? null,
        packaging: validated.packaging ?? attributes.packaging ?? null,
        applicationNotes: validated.applicationNotes ?? attributes.applicationNotes ?? null,
        seasonalAvailability: validated.seasonalAvailability ?? attributes.seasonalAvailability ?? null,
        alternativeMaterials: validated.alternativeMaterials ?? attributes.alternativeMaterials ?? [],
        customFields:
          validated.customFields !== undefined ? validated.customFields : attributes.customFields ?? {},
        materialType: validated.type ?? attributes.materialType,
        safety: mergedSafety,
        version: attributes.version + 1,
        updatedBy: attributes.updatedBy ?? null,
      };

      const updatePayload: ItemUpdatePayload = {
        updated_at: new Date().toISOString(),
        attributes: updatedAttributes as unknown as ItemUpdatePayload['attributes'],
      };

      if (validated.name !== undefined) updatePayload.name = validated.name;
      if (validated.description !== undefined) updatePayload.description = validated.description ?? null;
      if (validated.category !== undefined) updatePayload.category = validated.category;
      if (validated.manufacturer !== undefined) updatePayload.manufacturer = validated.manufacturer ?? null;
      if (validated.sku !== undefined) updatePayload.sku = validated.sku ?? null;
      if (validated.barcode !== undefined) updatePayload.barcode = validated.barcode ?? null;
      if (validated.unit !== undefined) updatePayload.unit_of_measure = validated.unit;
      if (validated.tags !== undefined) updatePayload.tags = validated.tags ?? null;
      if (validated.customFields !== undefined) updatePayload.custom_fields = validated.customFields ?? null;
      if (validated.is_active !== undefined) {
        updatePayload.status = validated.is_active ? ACTIVE_STATUS : INACTIVE_STATUS;
      }

      const { data: updated, error } = await this.client
        .from('items')
        .update(updatePayload as any)
        .eq('id', materialId)
        .eq('tenant_id', tenantId)
        .eq('item_type', MATERIAL_ITEM_TYPE)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
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
   * Fetch a single material by ID.
   */
  async findById(materialId: string, tenantId: string): Promise<Material | null> {
    try {
      const { data, error } = await this.client
        .from('items')
        .select('*')
        .eq('id', materialId)
        .eq('tenant_id', tenantId)
        .eq('item_type', MATERIAL_ITEM_TYPE)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
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
   * List materials with optional filtering and pagination.
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
      let query = this.client
        .from('items')
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId)
        .eq('item_type', MATERIAL_ITEM_TYPE)
        .order('name', { ascending: true });

      if (options.filters?.category) {
        query = query.eq('category', options.filters.category);
      }

      if (options.filters?.is_active !== undefined) {
        query = query.eq('status', options.filters.is_active ? ACTIVE_STATUS : INACTIVE_STATUS);
      }

      if (options.limit !== undefined) {
        query = query.limit(options.limit);
      }

      if (options.offset !== undefined) {
        const rangeEnd = options.offset + (options.limit ?? 50) - 1;
        query = query.range(options.offset, rangeEnd);
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      let materials = (data ?? []).map(row => this.mapToMaterial(row));

      if (options.filters?.type) {
        materials = materials.filter(material => material.type === options.filters?.type);
      }

      if (options.filters?.brand) {
        const brandFilter = options.filters.brand.toLowerCase();
        materials = materials.filter(material => material.brand?.toLowerCase().includes(brandFilter));
      }

      if (options.filters?.lowStock) {
        materials = materials.filter(material =>
          material.inventory.some(inv => inv.currentStock <= inv.reorderLevel)
        );
      }

      return {
        data: materials,
        count: options.filters?.type || options.filters?.brand || options.filters?.lowStock ? materials.length : count ?? materials.length,
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
   * Find materials by type.
   */
  async findMaterialsByType(type: MaterialType, tenantId: string): Promise<Material[]> {
    const result = await this.findAll({
      tenantId,
      filters: { type, is_active: true },
    });

    return result.data;
  }

  /**
   * Locate a material by SKU or barcode.
   */
  async findBySku(sku: string, tenantId: string): Promise<Material | null> {
    try {
      const { data, error } = await this.client
        .from('items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('item_type', MATERIAL_ITEM_TYPE)
        .or(`sku.eq.${sku},barcode.eq.${sku}`)
        .eq('status', ACTIVE_STATUS)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? this.mapToMaterial(data) : null;
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
   * Free text search across material name, brand, and description.
   */
  async searchMaterials(searchTerm: string, tenantId: string, limit: number = 20): Promise<Material[]> {
    try {
      const { data, error } = await this.client
        .from('items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('item_type', MATERIAL_ITEM_TYPE)
        .eq('status', ACTIVE_STATUS)
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,manufacturer.ilike.%${searchTerm}%`)
        .limit(limit)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => this.mapToMaterial(row));
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
   * Update inventory information for a specific location.
   */
  async updateInventory(
    materialId: string,
    locationId: string,
    inventoryUpdate: Partial<InventoryRecord>,
    tenantId: string
  ): Promise<Material | null> {
    try {
      const existingRow = await this.fetchMaterialRow(materialId, tenantId);
      if (!existingRow) {
        return null;
      }

      const attributes = this.ensureAttributes(existingRow);
      const nowIso = new Date().toISOString();
      const inventory = [...attributes.inventory];
      const index = inventory.findIndex(item => item.locationId === locationId);

      if (index >= 0) {
        const current = inventory[index];
        inventory[index] = {
          ...current,
          locationName: inventoryUpdate.locationName ?? current.locationName,
          currentStock: inventoryUpdate.currentStock ?? current.currentStock,
          reservedStock: inventoryUpdate.reservedStock ?? current.reservedStock ?? 0,
          reorderLevel: inventoryUpdate.reorderLevel ?? current.reorderLevel,
          maxStock: inventoryUpdate.maxStock ?? current.maxStock,
          unit: inventoryUpdate.unit ?? current.unit ?? attributes.usage.unit,
          lastUpdated: nowIso,
          averageUsagePerWeek: inventoryUpdate.averageUsagePerWeek ?? current.averageUsagePerWeek ?? 0,
          lastCountDate: inventoryUpdate.lastCountDate
            ? inventoryUpdate.lastCountDate.toISOString()
            : current.lastCountDate ?? null,
          expirationDate: inventoryUpdate.expirationDate
            ? inventoryUpdate.expirationDate.toISOString()
            : current.expirationDate ?? null,
          batchNumber: inventoryUpdate.batchNumber ?? current.batchNumber,
        };
      } else if (inventoryUpdate.locationName && inventoryUpdate.currentStock !== undefined) {
        inventory.push({
          locationId,
          locationName: inventoryUpdate.locationName,
          currentStock: inventoryUpdate.currentStock,
          reservedStock: inventoryUpdate.reservedStock ?? 0,
          reorderLevel: inventoryUpdate.reorderLevel ?? 0,
          maxStock: inventoryUpdate.maxStock ?? 1000,
          unit: inventoryUpdate.unit ?? attributes.usage.unit,
          lastUpdated: nowIso,
          averageUsagePerWeek: inventoryUpdate.averageUsagePerWeek ?? 0,
          lastCountDate: inventoryUpdate.lastCountDate ? inventoryUpdate.lastCountDate.toISOString() : null,
          expirationDate: inventoryUpdate.expirationDate ? inventoryUpdate.expirationDate.toISOString() : null,
          batchNumber: inventoryUpdate.batchNumber,
        });
      }

      const updatePayload: ItemUpdatePayload = {
        attributes: {
          ...attributes,
          inventory,
        } as unknown as ItemUpdatePayload['attributes'],
        updated_at: nowIso,
      };

      const { data, error } = await this.client
        .from('items')
        .update(updatePayload as any)
        .eq('id', materialId)
        .eq('tenant_id', tenantId)
        .eq('item_type', MATERIAL_ITEM_TYPE)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return this.mapToMaterial(data);
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
   * Convenience helper to fetch materials with low stock.
   */
  async findLowStock(tenantId: string): Promise<Material[]> {
    const result = await this.findAll({
      tenantId,
      filters: { lowStock: true, is_active: true },
    });

    return result.data;
  }

  /**
   * Soft delete a material by marking it inactive.
   */
  async delete(materialId: string, tenantId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('items')
        .update({
          status: INACTIVE_STATUS,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', materialId)
        .eq('tenant_id', tenantId)
        .eq('item_type', MATERIAL_ITEM_TYPE);

      if (error) {
        throw error;
      }

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
   * Map a stored row to the Material domain model.
   */
  private mapToMaterial(row: ItemRow): Material {
    const attributes = this.ensureAttributes(row);
    const pricing: MaterialPricing[] = attributes.pricing.map(pricing => ({
      ...pricing,
      lastUpdated: new Date(pricing.lastUpdated),
    }));

    const inventory: InventoryRecord[] = attributes.inventory.map(record => ({
      ...record,
      lastUpdated: new Date(record.lastUpdated),
      lastCountDate: record.lastCountDate ? new Date(record.lastCountDate) : undefined,
      expirationDate: record.expirationDate ? new Date(record.expirationDate) : undefined,
    }));

    const usage: MaterialUsage = {
      totalUsed: attributes.usage.totalUsed ?? 0,
      unit: attributes.usage.unit ?? coerceMaterialUnit(row.unit_of_measure),
      averagePerJob: attributes.usage.averagePerJob ?? 0,
      peakUsageMonth: attributes.usage.peakUsageMonth,
      costPerJob: attributes.usage.costPerJob,
      lastUsedDate: attributes.usage.lastUsedDate ? new Date(attributes.usage.lastUsedDate) : undefined,
    };

    const createdAt = row.created_at ? new Date(row.created_at) : new Date();
    const updatedAt = row.updated_at ? new Date(row.updated_at) : createdAt;
    const rawCustomFields = isRecord(row.custom_fields) ? row.custom_fields : attributes.customFields ?? {};

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      material_number: attributes.materialNumber,
      name: row.name,
      description: row.description ?? undefined,
      type: attributes.materialType,
      category: coerceMaterialCategory(row.category),
      brand: attributes.brand ?? undefined,
      manufacturer: row.manufacturer ?? undefined,
      sku: row.sku ?? undefined,
      barcode: row.barcode ?? undefined,
      unit: coerceMaterialUnit(row.unit_of_measure),
      packaging: attributes.packaging ?? undefined,
      pricing,
      inventory,
      usage,
      safety: attributes.safety ?? undefined,
      suppliers: attributes.suppliers ?? [],
      photos: Array.isArray(row.image_urls) ? row.image_urls : [],
      documents: attributes.documents ?? [],
      applicationNotes: attributes.applicationNotes ?? undefined,
      seasonalAvailability: attributes.seasonalAvailability ?? undefined,
      alternativeMaterials: attributes.alternativeMaterials ?? [],
      tags: Array.isArray(row.tags) ? row.tags : [],
      customFields: rawCustomFields as Record<string, any>,
      is_active: row.status !== INACTIVE_STATUS,
      version: attributes.version,
      createdAt,
      updatedAt,
      createdBy: attributes.createdBy ?? row.created_by ?? 'system',
      updatedBy: attributes.updatedBy ?? row.updated_by ?? 'system',
    };
  }

  /**
   * Fetch and ensure we receive a single material row.
   */
  private async fetchMaterialRow(materialId: string, tenantId: string): Promise<ItemRow | null> {
    const { data, error } = await this.client
      .from('items')
      .select('*')
      .eq('id', materialId)
      .eq('tenant_id', tenantId)
      .eq('item_type', MATERIAL_ITEM_TYPE)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ?? null;
  }

  /**
   * Ensure attributes object exists with sane defaults.
   */
  private ensureAttributes(row: ItemRow): StoredMaterialAttributes {
    const nowIso = new Date().toISOString();
    const rawAttributes = isRecord(row.attributes) ? row.attributes : {};

    const rawPricing = Array.isArray(rawAttributes.pricing) ? rawAttributes.pricing : [];
    const pricing: StoredPricing[] = rawPricing.map((entry: any) => ({
      unitCost: Number(entry.unitCost ?? 0),
      unit: coerceMaterialUnit(entry.unit ?? row.unit_of_measure),
      supplier: typeof entry.supplier === 'string' ? entry.supplier : 'Unknown',
      bulkPricing: Array.isArray(entry.bulkPricing) ? entry.bulkPricing : undefined,
      lastUpdated: typeof entry.lastUpdated === 'string' ? entry.lastUpdated : nowIso,
    }));

    const rawInventory = Array.isArray(rawAttributes.inventory) ? rawAttributes.inventory : [];
    const inventory: StoredInventoryRecord[] = rawInventory.map((record: any) => ({
      locationId: record.locationId ?? record.location_id ?? 'unknown',
      locationName: record.locationName ?? record.location_name ?? 'Unknown',
      currentStock: Number(record.currentStock ?? record.current_stock ?? 0),
      reservedStock: Number(record.reservedStock ?? record.reserved_stock ?? 0),
      reorderLevel: Number(record.reorderLevel ?? record.reorder_level ?? 0),
      maxStock: Number(record.maxStock ?? record.max_stock ?? 0),
      unit: coerceMaterialUnit(record.unit ?? row.unit_of_measure),
      lastUpdated: typeof record.lastUpdated === 'string' ? record.lastUpdated : nowIso,
      averageUsagePerWeek: Number(record.averageUsagePerWeek ?? 0),
      lastCountDate: typeof record.lastCountDate === 'string' ? record.lastCountDate : null,
      expirationDate: typeof record.expirationDate === 'string' ? record.expirationDate : null,
      batchNumber: typeof record.batchNumber === 'string' ? record.batchNumber : undefined,
    }));

    const usageRaw = isRecord(rawAttributes.usage) ? rawAttributes.usage : {};
    const usage: StoredUsage = {
      totalUsed: Number(usageRaw.totalUsed ?? 0),
      unit: coerceMaterialUnit(usageRaw.unit ?? row.unit_of_measure),
      averagePerJob: Number(usageRaw.averagePerJob ?? 0),
      peakUsageMonth: typeof usageRaw.peakUsageMonth === 'string' ? usageRaw.peakUsageMonth : undefined,
      costPerJob: usageRaw.costPerJob !== undefined ? Number(usageRaw.costPerJob) : undefined,
      lastUsedDate: typeof usageRaw.lastUsedDate === 'string' ? usageRaw.lastUsedDate : undefined,
    };

    return {
      materialNumber:
        typeof rawAttributes.materialNumber === 'string'
          ? rawAttributes.materialNumber
          : `MAT-${row.id}`,
      materialType: coerceMaterialType(rawAttributes.materialType ?? MaterialType.OTHER),
      brand: typeof rawAttributes.brand === 'string' ? rawAttributes.brand : null,
      packaging: typeof rawAttributes.packaging === 'string' ? rawAttributes.packaging : null,
      pricing,
      inventory,
      usage,
      safety: isRecord(rawAttributes.safety)
        ? (rawAttributes.safety as unknown as MaterialSafety)
        : undefined,
      suppliers: Array.isArray(rawAttributes.suppliers)
        ? (rawAttributes.suppliers as unknown as MaterialSupplier[])
        : [],
      documents: Array.isArray(rawAttributes.documents) ? (rawAttributes.documents as string[]) : [],
      applicationNotes:
        typeof rawAttributes.applicationNotes === 'string' ? rawAttributes.applicationNotes : null,
      seasonalAvailability:
        typeof rawAttributes.seasonalAvailability === 'string'
          ? rawAttributes.seasonalAvailability
          : null,
      alternativeMaterials: Array.isArray(rawAttributes.alternativeMaterials)
        ? (rawAttributes.alternativeMaterials as string[])
        : [],
      version: typeof rawAttributes.version === 'number' ? rawAttributes.version : 1,
      createdBy:
        typeof rawAttributes.createdBy === 'string' ? rawAttributes.createdBy : row.created_by ?? null,
      updatedBy:
        typeof rawAttributes.updatedBy === 'string' ? rawAttributes.updatedBy : row.updated_by ?? null,
      voiceMetadata: rawAttributes.voiceMetadata ?? null,
      customFields: isRecord(rawAttributes.customFields) ? rawAttributes.customFields : null,
    };
  }

  /**
   * Generate a sequential material number per tenant.
   */
  private async generateMaterialNumber(tenantId: string): Promise<string> {
    const { count, error } = await this.client
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('item_type', MATERIAL_ITEM_TYPE);

    if (error) {
      throw error;
    }

    const next = (count ?? 0) + 1;
    return `MAT-${next.toString().padStart(5, '0')}`;
  }
}

export const createMaterialRepository = (supabase: SupabaseClient): MaterialRepository => {
  return new MaterialRepository(supabase as SupabaseClient<Database>);
};
