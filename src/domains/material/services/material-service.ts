// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/material/services/material-service.ts
// phase: 2
// domain: material-catalog
// purpose: Material business logic orchestration with inventory management
// spec_ref: phase2/material-catalog#service
// version: 2025-08-1
// complexity_budget: 500 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/material/repositories/material-repository
//     - /src/domains/material/types/material-types
//     - /src/core/events/event-bus
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - MaterialService: class - Material business logic
//   - createMaterial: function - Create material with validation
//   - updateMaterial: function - Update material details
//   - updateInventory: function - Track inventory changes
//   - recordUsage: function - Record material usage
//   - checkReorderLevels: function - Check materials needing reorder
//   - deleteMaterial: function - Soft delete material
//   - bulkImportMaterials: function - Bulk material import
//
// voice_considerations: |
//   Support voice-driven inventory updates.
//   Enable natural language material searches.
//   Voice-confirm material usage and counts.
//   Generate voice alerts for low inventory.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/material/services/material-service.test.ts
//
// tasks:
//   1. Implement material creation with validation
//   2. Add inventory management methods
//   3. Create usage tracking
//   4. Implement reorder level monitoring
//   5. Add bulk import functionality
//   6. Integrate event publishing
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { MaterialRepository } from '../repositories/material-repository';
import {
  Material,
  MaterialCreate,
  MaterialUpdate,
  MaterialType,
  MaterialCategory,
  MaterialUnit,
  InventoryRecord,
  InventoryTransaction,
  MaterialVoiceCommand,
  MaterialSearchResult,
} from '../types/material-types';
import { EventBus } from '@/core/events/event-bus';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

/**
 * Material service configuration
 */
interface MaterialServiceConfig {
  enableInventoryTracking?: boolean;
  enableReorderAlerts?: boolean;
  defaultReorderDays?: number;
  enableVoiceCommands?: boolean;
  requireCostTracking?: boolean;
}

/**
 * Material business events
 */
export enum MaterialEventType {
  MATERIAL_CREATED = 'material.created',
  MATERIAL_UPDATED = 'material.updated',
  INVENTORY_UPDATED = 'material.inventory_updated',
  MATERIAL_USED = 'material.used',
  LOW_STOCK_ALERT = 'material.low_stock_alert',
  REORDER_REQUIRED = 'material.reorder_required',
  MATERIAL_RECEIVED = 'material.received',
  MATERIAL_DELETED = 'material.deleted',
}

/**
 * Material service for business logic orchestration
 */
export class MaterialService {
  private repository: MaterialRepository;
  private eventBus: EventBus;
  private config: Required<MaterialServiceConfig>;

  constructor(
    supabaseClient: SupabaseClient,
    eventBus?: EventBus,
    config?: MaterialServiceConfig
  ) {
    this.repository = new MaterialRepository(supabaseClient);
    this.eventBus = eventBus || EventBus.getInstance();
    this.config = {
      enableInventoryTracking: config?.enableInventoryTracking ?? true,
      enableReorderAlerts: config?.enableReorderAlerts ?? true,
      defaultReorderDays: config?.defaultReorderDays ?? 30,
      enableVoiceCommands: config?.enableVoiceCommands ?? true,
      requireCostTracking: config?.requireCostTracking ?? false,
    };
  }

  /**
   * Create new material with validation
   */
  async createMaterial(
    data: MaterialCreate,
    tenantId: string,
    userId: string
  ): Promise<Material> {
    try {
      // Check for duplicate SKU if provided
      if (data.sku) {
        const existingMaterial = await this.repository.findBySku(data.sku, tenantId);
        if (existingMaterial) {
          throw createAppError({
            code: 'DUPLICATE_SKU',
            message: 'Material with this SKU already exists',
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.VALIDATION,
            metadata: { materialId: existingMaterial.id },
          });
        }
      }

      // Create material
      const material = await this.repository.createMaterial(data, tenantId);

      // Publish event
      this.publishEvent({
        type: MaterialEventType.MATERIAL_CREATED,
        aggregateId: material.id,
        tenantId,
        userId,
        payload: {
          materialId: material.id,
          name: material.name,
          type: material.type,
          category: material.category,
          initialInventoryLocations: material.inventory.length,
        },
        metadata: {
          voiceCreated: !!data.voiceMetadata,
        },
      });

      return material;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'MATERIAL_CREATE_FAILED',
        message: 'Failed to create material',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update material with validation
   */
  async updateMaterial(
    materialId: string,
    updates: MaterialUpdate,
    tenantId: string,
    userId: string
  ): Promise<Material> {
    try {
      // Get current material
      const currentMaterial = await this.repository.findById(materialId, tenantId);
      if (!currentMaterial) {
        throw createAppError({
          code: 'MATERIAL_NOT_FOUND',
          message: 'Material not found',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Update material
      const updatedMaterial = await this.repository.updateMaterial(
        materialId,
        updates,
        tenantId
      );

      if (!updatedMaterial) {
        throw new Error('Update failed');
      }

      // Publish event
      this.publishEvent({
        type: MaterialEventType.MATERIAL_UPDATED,
        aggregateId: materialId,
        tenantId,
        userId,
        payload: {
          materialId,
          updates,
        },
      });

      return updatedMaterial;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'MATERIAL_UPDATE_FAILED',
        message: 'Failed to update material',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update inventory for a material at specific location
   */
  async updateInventory(
    materialId: string,
    locationId: string,
    inventoryUpdate: {
      currentStock?: number;
      adjustment?: number;
      reorderLevel?: number;
      maxStock?: number;
      expirationDate?: Date;
      batchNumber?: string;
    },
    tenantId: string,
    userId: string,
    notes?: string
  ): Promise<Material> {
    try {
      const currentMaterial = await this.repository.findById(materialId, tenantId);
      if (!currentMaterial) {
        throw createAppError({
          code: 'MATERIAL_NOT_FOUND',
          message: 'Material not found',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Calculate new stock if adjustment provided
      if (inventoryUpdate.adjustment !== undefined) {
        const currentInventory = currentMaterial.inventory.find(inv => inv.locationId === locationId);
        const currentStock = currentInventory?.currentStock || 0;
        inventoryUpdate.currentStock = Math.max(0, currentStock + inventoryUpdate.adjustment);
      }

      const updatedMaterial = await this.repository.updateInventory(
        materialId,
        locationId,
        inventoryUpdate,
        tenantId
      );

      if (!updatedMaterial) {
        throw new Error('Inventory update failed');
      }

      // Check for low stock alerts
      const updatedInventory = updatedMaterial.inventory.find(inv => inv.locationId === locationId);
      if (updatedInventory && updatedInventory.currentStock <= updatedInventory.reorderLevel) {
        this.publishEvent({
          type: MaterialEventType.LOW_STOCK_ALERT,
          aggregateId: materialId,
          tenantId,
          userId,
          payload: {
            materialId,
            materialName: updatedMaterial.name,
            locationId,
            locationName: updatedInventory.locationName,
            currentStock: updatedInventory.currentStock,
            reorderLevel: updatedInventory.reorderLevel,
          },
        });
      }

      // Publish inventory update event
      this.publishEvent({
        type: MaterialEventType.INVENTORY_UPDATED,
        aggregateId: materialId,
        tenantId,
        userId,
        payload: {
          materialId,
          locationId,
          inventoryUpdate,
          notes,
        },
      });

      return updatedMaterial;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'INVENTORY_UPDATE_FAILED',
        message: 'Failed to update inventory',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Record material usage
   */
  async recordUsage(
    materialId: string,
    locationId: string,
    quantity: number,
    unit: MaterialUnit,
    tenantId: string,
    userId: string,
    jobId?: string,
    propertyId?: string,
    notes?: string
  ): Promise<Material> {
    try {
      // Record the usage as negative adjustment
      const updatedMaterial = await this.updateInventory(
        materialId,
        locationId,
        { adjustment: -Math.abs(quantity) },
        tenantId,
        userId,
        notes
      );

      // Publish usage event
      this.publishEvent({
        type: MaterialEventType.MATERIAL_USED,
        aggregateId: materialId,
        tenantId,
        userId,
        payload: {
          materialId,
          locationId,
          quantity,
          unit,
          jobId,
          propertyId,
          notes,
        },
      });

      return updatedMaterial;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'MATERIAL_USAGE_FAILED',
        message: 'Failed to record material usage',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Check materials that need reordering
   */
  async checkReorderLevels(tenantId: string): Promise<Material[]> {
    try {
      if (!this.config.enableReorderAlerts) {
        return [];
      }

      const lowStockMaterials = await this.repository.findLowStock(tenantId);

      // Publish reorder alerts for materials that need attention
      for (const material of lowStockMaterials) {
        const lowStockLocations = material.inventory.filter(
          inv => inv.currentStock <= inv.reorderLevel
        );

        for (const location of lowStockLocations) {
          this.publishEvent({
            type: MaterialEventType.REORDER_REQUIRED,
            aggregateId: material.id,
            tenantId,
            userId: 'system',
            payload: {
              materialId: material.id,
              materialName: material.name,
              locationId: location.locationId,
              locationName: location.locationName,
              currentStock: location.currentStock,
              reorderLevel: location.reorderLevel,
              suggestedOrderQuantity: location.maxStock - location.currentStock,
            },
          });
        }
      }

      return lowStockMaterials;
    } catch (error) {
      throw createAppError({
        code: 'REORDER_CHECK_FAILED',
        message: 'Failed to check reorder levels',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete material (soft delete)
   */
  async deleteMaterial(
    materialId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    try {
      await this.repository.delete(materialId, tenantId);

      // Publish event
      this.publishEvent({
        type: MaterialEventType.MATERIAL_DELETED,
        aggregateId: materialId,
        tenantId,
        userId,
        payload: {
          materialId,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'MATERIAL_DELETE_FAILED',
        message: 'Failed to delete material',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Bulk import materials
   */
  async bulkImportMaterials(
    materialsList: MaterialCreate[],
    tenantId: string,
    userId: string
  ): Promise<{
    success: Material[];
    failed: Array<{ data: MaterialCreate; error: string }>;
  }> {
    const success: Material[] = [];
    const failed: Array<{ data: MaterialCreate; error: string }> = [];

    for (const materialData of materialsList) {
      try {
        const material = await this.createMaterial(materialData, tenantId, userId);
        success.push(material);
      } catch (error) {
        failed.push({
          data: materialData,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { success, failed };
  }

  /**
   * Get material by ID
   */
  async getMaterial(
    materialId: string,
    tenantId: string
  ): Promise<Material | null> {
    try {
      return await this.repository.findById(materialId, tenantId);
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
   * Search materials by various criteria
   */
  async searchMaterials(
    searchTerm: string,
    tenantId: string,
    filters?: {
      type?: MaterialType;
      category?: MaterialCategory;
      brand?: string;
      lowStock?: boolean;
    }
  ): Promise<Material[]> {
    try {
      if (searchTerm) {
        return await this.repository.searchMaterials(searchTerm, tenantId);
      } else {
        const result = await this.repository.findAll({
          tenantId,
          filters,
          limit: 50,
        });
        return result.data;
      }
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
   * Get materials by type
   */
  async getMaterialsByType(
    type: MaterialType,
    tenantId: string
  ): Promise<Material[]> {
    try {
      return await this.repository.findMaterialsByType(type, tenantId);
    } catch (error) {
      throw createAppError({
        code: 'MATERIAL_TYPE_FETCH_FAILED',
        message: 'Failed to fetch materials by type',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get inventory summary across all locations
   */
  async getInventorySummary(tenantId: string): Promise<{
    totalMaterials: number;
    lowStockCount: number;
    totalValue: number;
    locationSummary: Array<{
      locationId: string;
      locationName: string;
      materialCount: number;
      lowStockCount: number;
    }>;
  }> {
    try {
      const result = await this.repository.findAll({
        tenantId,
        filters: { is_active: true },
      });

      const materials = result.data;
      const locationMap = new Map<string, { name: string; materials: Set<string>; lowStock: Set<string> }>();

      let totalValue = 0;
      let lowStockCount = 0;

      materials.forEach(material => {
        // Calculate total value
        const latestPricing = material.pricing[0];
        if (latestPricing) {
          const totalStock = material.inventory.reduce((sum, inv) => sum + inv.currentStock, 0);
          totalValue += totalStock * latestPricing.unitCost;
        }

        // Check inventory by location
        material.inventory.forEach(inv => {
          if (!locationMap.has(inv.locationId)) {
            locationMap.set(inv.locationId, {
              name: inv.locationName,
              materials: new Set(),
              lowStock: new Set(),
            });
          }

          const location = locationMap.get(inv.locationId)!;
          location.materials.add(material.id);

          if (inv.currentStock <= inv.reorderLevel) {
            location.lowStock.add(material.id);
            lowStockCount++;
          }
        });
      });

      const locationSummary = Array.from(locationMap.entries()).map(([locationId, data]) => ({
        locationId,
        locationName: data.name,
        materialCount: data.materials.size,
        lowStockCount: data.lowStock.size,
      }));

      return {
        totalMaterials: materials.length,
        lowStockCount,
        totalValue,
        locationSummary,
      };
    } catch (error) {
      throw createAppError({
        code: 'INVENTORY_SUMMARY_FAILED',
        message: 'Failed to get inventory summary',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Publish domain event
   */
  private publishEvent(event: {
    type: string;
    aggregateId: string;
    tenantId: string;
    userId: string;
    payload: any;
    metadata?: any;
  }): void {
    this.eventBus.emit(event.type, {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    });
  }
}

/**
 * Factory function to create material service
 */
export function createMaterialService(
  supabaseClient: SupabaseClient,
  eventBus?: EventBus,
  config?: MaterialServiceConfig
): MaterialService {
  return new MaterialService(supabaseClient, eventBus, config);
}