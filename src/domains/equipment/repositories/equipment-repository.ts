// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/equipment/repositories/equipment-repository.ts
// phase: 2
// domain: equipment-tracking
// purpose: Equipment data access with multi-tenant isolation and usage tracking
// spec_ref: phase2/equipment-tracking#repository
// version: 2025-08-1
// complexity_budget: 400 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/lib/repositories/base.repository
//     - /src/domains/equipment/types/equipment-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - EquipmentRepository: class - Equipment data access
//   - createEquipment: function - Create new equipment
//   - updateEquipment: function - Update equipment details
//   - findEquipmentByType: function - Filter by equipment type
//   - findEquipmentByLocation: function - Location-based queries
//   - updateEquipmentLocation: function - Track equipment moves
//
// voice_considerations: |
//   Support voice-friendly equipment identification.
//   Store voice recordings of equipment issues.
//   Enable natural language equipment searches.
//   Track voice-confirmed equipment locations.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/equipment/repositories/equipment-repository.test.ts
//
// tasks:
//   1. Extend BaseRepository for equipment
//   2. Implement CRUD with tenant isolation
//   3. Add equipment type and location filtering
//   4. Create maintenance record management
//   5. Implement usage tracking methods
//   6. Add voice metadata handling
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import {
  Equipment,
  EquipmentCreate,
  EquipmentUpdate,
  EquipmentType,
  EquipmentState,
  EquipmentCategory,
  MaintenanceRecord,
  EquipmentLocation,
  equipmentCreateSchema,
  equipmentUpdateSchema,
} from '../types/equipment-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

export class EquipmentRepository extends BaseRepository<'equipment'> {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    super('equipment', supabaseClient);
    this.supabaseClient = supabaseClient;
  }

  /**
   * Create new equipment with tenant isolation
   */
  async createEquipment(
    data: EquipmentCreate,
    tenantId: string
  ): Promise<Equipment> {
    try {
      // Validate input
      const validated = equipmentCreateSchema.parse(data);

      // Generate equipment number
      const equipmentNumber = await this.generateEquipmentNumber(tenantId);

      const equipment = {
        equipment_number: equipmentNumber,
        tenant_id: tenantId,
        name: validated.name,
        type: validated.type,
        category: validated.category,
        manufacturer: validated.manufacturer,
        serial_number: validated.serialNumber,
        purchase_date: validated.purchaseDate?.toISOString(),
        purchase_price: validated.purchasePrice,
        warranty_expiration: validated.warrantyExpiration?.toISOString(),
        specs: validated.specs || {},
        state: EquipmentState.ACTIVE,
        location: {
          ...validated.location,
          lastUpdated: new Date().toISOString(),
        },
        usage: {
          hoursUsed: 0,
          milesUsed: 0,
          cyclesCompleted: 0,
          averageUsagePerWeek: 0,
        },
        qr_code: null, // Will be generated separately
        photos: [],
        manuals: [],
        notes: validated.notes,
        tags: validated.tags || [],
        custom_fields: validated.customFields || {},
        is_active: true,
        metadata: {
          voiceCreated: !!validated.voiceMetadata,
          voiceMetadata: validated.voiceMetadata,
        },
      };

      const { data: created, error } = await this.supabaseClient
        .from('equipment')
        .insert(equipment)
        .select('*')
        .single();

      if (error) throw error;

      return this.mapToEquipment(created);
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_CREATE_FAILED',
        message: 'Failed to create equipment',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update equipment with version control
   */
  async updateEquipment(
    equipmentId: string,
    updates: EquipmentUpdate,
    tenantId: string
  ): Promise<Equipment | null> {
    try {
      const validated = equipmentUpdateSchema.parse(updates);

      const updateData: any = {};

      if (validated.name) updateData.name = validated.name;
      if (validated.type) updateData.type = validated.type;
      if (validated.category) updateData.category = validated.category;
      if (validated.manufacturer) updateData.manufacturer = validated.manufacturer;
      if (validated.serialNumber !== undefined) updateData.serial_number = validated.serialNumber;
      if (validated.warrantyExpiration !== undefined) {
        updateData.warranty_expiration = validated.warrantyExpiration?.toISOString();
      }
      if (validated.specs) updateData.specs = validated.specs;
      if (validated.state) updateData.state = validated.state;
      if (validated.location) {
        updateData.location = {
          ...validated.location,
          lastUpdated: new Date().toISOString(),
        };
      }
      if (validated.usage) updateData.usage = validated.usage;
      if (validated.notes !== undefined) updateData.notes = validated.notes;
      if (validated.tags) updateData.tags = validated.tags;
      if (validated.customFields) updateData.custom_fields = validated.customFields;
      if (validated.is_active !== undefined) updateData.is_active = validated.is_active;

      const { data: updated, error } = await this.supabaseClient
        .from('equipment')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', equipmentId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapToEquipment(updated);
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_UPDATE_FAILED',
        message: 'Failed to update equipment',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find equipment by ID with tenant isolation
   */
  async findById(equipmentId: string, tenantId: string): Promise<Equipment | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('equipment')
        .select('*')
        .eq('id', equipmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToEquipment(data);
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_FETCH_FAILED',
        message: 'Failed to fetch equipment',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find all equipment with filters
   */
  async findAll(options: {
    tenantId: string;
    filters?: {
      type?: EquipmentType;
      category?: EquipmentCategory;
      state?: EquipmentState;
      location?: string;
      is_active?: boolean;
    };
    limit?: number;
    offset?: number;
  }): Promise<{ data: Equipment[]; count: number }> {
    try {
      let query = this.supabaseClient
        .from('equipment')
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId);

      if (options.filters) {
        if (options.filters.type) {
          query = query.eq('type', options.filters.type);
        }
        if (options.filters.category) {
          query = query.eq('category', options.filters.category);
        }
        if (options.filters.state) {
          query = query.eq('state', options.filters.state);
        }
        if (options.filters.location) {
          query = query.eq('location->>id', options.filters.location);
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

      const { data, error, count } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return {
        data: (data || []).map(row => this.mapToEquipment(row)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_FETCH_FAILED',
        message: 'Failed to fetch equipment list',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find equipment by type
   */
  async findEquipmentByType(
    type: EquipmentType,
    tenantId: string
  ): Promise<Equipment[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('equipment')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('type', type)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return (data || []).map(row => this.mapToEquipment(row));
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_TYPE_SEARCH_FAILED',
        message: 'Failed to find equipment by type',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find equipment by location
   */
  async findEquipmentByLocation(
    locationId: string,
    tenantId: string
  ): Promise<Equipment[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('equipment')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('location->>id', locationId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return (data || []).map(row => this.mapToEquipment(row));
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_LOCATION_SEARCH_FAILED',
        message: 'Failed to find equipment by location',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update equipment location
   */
  async updateEquipmentLocation(
    equipmentId: string,
    newLocation: Omit<EquipmentLocation, 'lastUpdated'>,
    tenantId: string
  ): Promise<Equipment | null> {
    try {
      const location = {
        ...newLocation,
        lastUpdated: new Date().toISOString(),
      };

      const { data, error } = await this.supabaseClient
        .from('equipment')
        .update({
          location,
          updated_at: new Date().toISOString(),
        })
        .eq('id', equipmentId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToEquipment(data);
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_LOCATION_UPDATE_FAILED',
        message: 'Failed to update equipment location',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find equipment by serial number
   */
  async findBySerialNumber(
    serialNumber: string,
    tenantId: string
  ): Promise<Equipment | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('equipment')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('serial_number', serialNumber)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToEquipment(data);
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_SERIAL_SEARCH_FAILED',
        message: 'Failed to find equipment by serial number',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Search equipment by name or manufacturer
   */
  async searchEquipment(
    searchTerm: string,
    tenantId: string,
    limit: number = 20
  ): Promise<Equipment[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('equipment')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,manufacturer->>name.ilike.%${searchTerm}%,manufacturer->>model.ilike.%${searchTerm}%`)
        .limit(limit)
        .order('name');

      if (error) throw error;

      return (data || []).map(row => this.mapToEquipment(row));
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_SEARCH_FAILED',
        message: 'Failed to search equipment',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete equipment (soft delete)
   */
  async delete(equipmentId: string, tenantId: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseClient
        .from('equipment')
        .update({
          is_active: false,
          state: EquipmentState.RETIRED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', equipmentId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_DELETE_FAILED',
        message: 'Failed to delete equipment',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Generate unique equipment number
   */
  private async generateEquipmentNumber(tenantId: string): Promise<string> {
    const prefix = 'EQ';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Map database row to Equipment type
   */
  private mapToEquipment(row: any): Equipment {
    if (!row) throw new Error('Cannot map null row to Equipment');

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      equipment_number: row.equipment_number,
      name: row.name,
      type: row.type as EquipmentType,
      category: row.category as EquipmentCategory,
      manufacturer: row.manufacturer,
      serialNumber: row.serial_number,
      purchaseDate: row.purchase_date ? new Date(row.purchase_date) : undefined,
      purchasePrice: row.purchase_price,
      warrantyExpiration: row.warranty_expiration ? new Date(row.warranty_expiration) : undefined,
      specs: row.specs || {},
      state: row.state as EquipmentState,
      location: {
        ...row.location,
        lastUpdated: new Date(row.location.lastUpdated),
      },
      usage: {
        hoursUsed: row.usage?.hoursUsed || 0,
        milesUsed: row.usage?.milesUsed || 0,
        cyclesCompleted: row.usage?.cyclesCompleted || 0,
        lastUsedDate: row.usage?.lastUsedDate ? new Date(row.usage.lastUsedDate) : undefined,
        averageUsagePerWeek: row.usage?.averageUsagePerWeek || 0,
      },
      qrCode: row.qr_code,
      photos: row.photos || [],
      manuals: row.manuals || [],
      notes: row.notes,
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
export const createEquipmentRepository = (supabase: SupabaseClient): EquipmentRepository => {
  return new EquipmentRepository(supabase);
};