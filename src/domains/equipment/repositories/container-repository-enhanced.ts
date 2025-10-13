// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/equipment/repositories/container-repository-enhanced.ts
// phase: 4
// domain: equipment-tracking
// purpose: Enhanced container repository combining equipment and inventory features
// spec_ref: phase4/equipment-tracking#container-repository
// version: 2025-10-03
// complexity_budget: 500 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/lib/repositories/base.repository
//     - /src/domains/equipment/types/container-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - ContainerRepository: class - Enhanced container data access
//   - All existing methods plus assignment tracking
//
// voice_considerations: |
//   Support voice-driven container queries.
//   Natural language container search.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/equipment/repositories/container-repository.test.ts
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import {
  Container,
  ContainerCreate,
  ContainerUpdate,
  ContainerFilters,
  ContainerSchema,
  ContainerCreateSchema,
  ContainerUpdateSchema,
} from '../types/container-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

// Types for container assignments (from inventory domain)
export interface ContainerAssignment {
  id: string;
  container_id: string;
  item_id: string;
  item_type: 'equipment' | 'material' | 'tool';
  assigned_at: string;
  assigned_by: string;
  checked_out_at?: string;
  checked_out_by?: string;
  status: 'active' | 'completed';
  notes?: string;
  tenant_id: string;
}

export interface ContainerAssignmentCreate {
  container_id: string;
  item_id: string;
  item_type: 'equipment' | 'material' | 'tool';
  assigned_by: string;
  notes?: string;
  tenant_id: string;
}

export class ContainerRepository extends BaseRepository<'containers'> {
  constructor(supabaseClient: SupabaseClient) {
    super('containers', supabaseClient);
  }

  /**
   * Find container by identifier within a tenant
   */
  async findByIdentifier(identifier: string, tenantId: string): Promise<Container | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('identifier', identifier)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapFromDb(data);
    } catch (error) {
      throw createAppError({
        code: 'CONTAINER_FIND_FAILED',
        message: `Failed to find container: ${identifier}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get default container for a tenant
   */
  async getDefault(tenantId: string): Promise<Container | null> {
    try {
      const { data, error} = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapFromDb(data);
    } catch (error) {
      throw createAppError({
        code: 'DEFAULT_CONTAINER_FIND_FAILED',
        message: 'Failed to find default container',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find all containers with filters
   */
  async findAll(options: {
    tenantId: string;
    filters?: ContainerFilters;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Container[]; count: number }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId);

      // Apply filters
      if (options.filters) {
        if (options.filters.containerType) {
          query = query.eq('container_type', options.filters.containerType);
        }
        if (options.filters.color) {
          query = query.eq('color', options.filters.color);
        }
        if (options.filters.isActive !== undefined) {
          query = query.eq('is_active', options.filters.isActive);
        }
        if (options.filters.isDefault !== undefined) {
          query = query.eq('is_default', options.filters.isDefault);
        }
        if (options.filters.searchTerm) {
          query = query.or(
            `name.ilike.%${options.filters.searchTerm}%,` +
            `identifier.ilike.%${options.filters.searchTerm}%`
          );
        }
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []).map((item: any) => this.mapFromDb(item)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'CONTAINER_LIST_FAILED',
        message: 'Failed to list containers',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Create new container with validation
   */
  async create(data: ContainerCreate): Promise<Container> {
    try {
      // Validate input
      const validated = ContainerCreateSchema.parse(data);
      
      // Get tenant ID from auth
      const tenantId = await this.getTenantId();

      // Check for duplicate identifier
      const existing = await this.findByIdentifier(validated.identifier, tenantId);
      if (existing) {
        throw createAppError({
          code: 'CONTAINER_DUPLICATE',
          message: `Container with identifier ${validated.identifier} already exists`,
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.VALIDATION,
        });
      }

      // If marked as default, unset other defaults
      if (validated.isDefault) {
        await this.unsetDefaults(tenantId);
      }

      const dbData = {
        ...this.mapToDb(validated),
        tenant_id: tenantId
      };
      
      const { data: created, error } = await this.supabase
        .from(this.tableName as any)
        .insert(dbData as any)
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(created);
    } catch (error) {
      throw createAppError({
        code: 'CONTAINER_CREATE_FAILED',
        message: 'Failed to create container',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update container with validation
   */
  async update(id: string, data: Record<string, any>): Promise<Record<string, any>> {
    try {
      // Validate input
      const validated = ContainerUpdateSchema.parse(data);
      
      // Get tenant ID from auth
      const tenantId = await this.getTenantId();

      // If setting as default, unset others
      if (validated.isDefault) {
        await this.unsetDefaults(tenantId);
      }

      const { data: updated, error } = await this.supabase
        .from(this.tableName as any)
        .update(this.mapToDb(validated) as any)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDb(updated);
    } catch (error) {
      throw createAppError({
        code: 'CONTAINER_UPDATE_FAILED',
        message: 'Failed to update container',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Soft delete container
   */
  async delete(id: string): Promise<void> {
    try {
      const tenantId = await this.getTenantId();
      
      const { error } = await this.supabase
        .from(this.tableName as any)
        .update({ is_active: false } as any)
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    } catch (error) {
      throw createAppError({
        code: 'CONTAINER_DELETE_FAILED',
        message: 'Failed to delete container',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  // ========== CONTAINER ASSIGNMENT METHODS (From Inventory Domain) ==========

  /**
   * Create a new container assignment
   */
  async createAssignment(assignment: ContainerAssignmentCreate): Promise<ContainerAssignment> {
    try {
      const { data, error } = await this.supabase
        .from('container_assignments' as any)
        .insert({
          ...assignment,
          status: 'active',
          assigned_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) throw error;

      return data as ContainerAssignment;
    } catch (error) {
      throw createAppError({
        code: 'ASSIGNMENT_CREATE_FAILED',
        message: 'Failed to create container assignment',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find active assignment for an item
   */
  async findActiveAssignment(itemId: string, tenantId: string): Promise<ContainerAssignment | null> {
    try {
      const { data, error } = await this.supabase
        .from('container_assignments')
        .select('*')
        .eq('item_id', itemId)
        .eq('tenant_id', tenantId)
        .is('checked_out_at', null)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data as ContainerAssignment;
    } catch (error) {
      throw createAppError({
        code: 'ASSIGNMENT_FIND_FAILED',
        message: 'Failed to find active assignment',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find all assignments for a container
   */
  async findAssignmentsByContainer(
    containerId: string, 
    tenantId: string,
    activeOnly = true
  ): Promise<ContainerAssignment[]> {
    try {
      let query = this.supabase
        .from('container_assignments')
        .select('*')
        .eq('container_id', containerId)
        .eq('tenant_id', tenantId);

      if (activeOnly) {
        query = query.eq('status', 'active').is('checked_out_at', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as ContainerAssignment[];
    } catch (error) {
      throw createAppError({
        code: 'ASSIGNMENTS_LIST_FAILED',
        message: 'Failed to list container assignments',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Check out an item from container
   */
  async checkOutAssignment(
    assignmentId: string,
    checkedOutBy: string,
    tenantId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('container_assignments' as any)
        .update({ 
          checked_out_at: new Date().toISOString(),
          checked_out_by: checkedOutBy,
          status: 'completed'
        } as any)
        .eq('id', assignmentId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    } catch (error) {
      throw createAppError({
        code: 'CHECKOUT_FAILED',
        message: 'Failed to check out assignment',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get container with its current assignments
   */
  async getContainerWithAssignments(
    containerId: string,
    tenantId: string
  ): Promise<Container & { assignments: ContainerAssignment[] }> {
    try {
      const container = await this.findById(containerId);
      if (!container) {
        throw createAppError({
          code: 'CONTAINER_NOT_FOUND',
          message: 'Container not found',
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.DATABASE,
        });
      }

      const assignments = await this.findAssignmentsByContainer(containerId, tenantId);

      return { ...container, assignments } as Container & { assignments: ContainerAssignment[] };
    } catch (error) {
      throw createAppError({
        code: 'CONTAINER_WITH_ASSIGNMENTS_FAILED',
        message: 'Failed to get container with assignments',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  // ========== PRIVATE HELPER METHODS ==========

  /**
   * Unset all default containers for a tenant
   */
  private async unsetDefaults(tenantId: string): Promise<void> {
    await this.supabase
      .from(this.tableName as any)
      .update({ is_default: false } as any)
      .eq('tenant_id', tenantId)
      .eq('is_default', true);
  }

  /**
   * Map from database format to domain model
   */
  private mapFromDb(data: any): Container {
    return ContainerSchema.parse({
      id: data.id,
      tenantId: data.tenant_id,
      name: data.name,
      identifier: data.identifier,
      description: data.description,
      containerType: data.container_type,
      color: data.color,
      defaultItems: data.default_items,
      isDefault: data.is_default,
      isActive: data.is_active,
      parentContainerId: data.parent_container_id,
      gpsLocation: data.gps_location,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  /**
   * Map from domain model to database format
   */
  private mapToDb(data: any): any {
    const mapped: any = {};
    
    // Map known Container properties
    if (data.name !== undefined) mapped.name = data.name;
    if (data.identifier !== undefined) mapped.identifier = data.identifier;
    if (data.containerType !== undefined) mapped.container_type = data.containerType;
    if (data.color !== undefined) mapped.color = data.color;
    if (data.capacityInfo !== undefined) mapped.capacity_info = data.capacityInfo;
    if (data.primaryImageUrl !== undefined) mapped.primary_image_url = data.primaryImageUrl;
    if (data.additionalImageUrls !== undefined) mapped.additional_image_urls = data.additionalImageUrls;
    if (data.isDefault !== undefined) mapped.is_default = data.isDefault;
    if (data.isActive !== undefined) mapped.is_active = data.isActive;
    if (data.metadata !== undefined) mapped.metadata = data.metadata;

    return mapped;
  }
}

// Export for backward compatibility
export type { Container, ContainerCreate, ContainerUpdate, ContainerFilters } from '../types/container-types';