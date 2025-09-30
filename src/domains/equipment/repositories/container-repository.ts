// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/equipment/repositories/container-repository.ts
// phase: 4
// domain: equipment-tracking
// purpose: Data access layer for loading containers
// spec_ref: phase4/equipment-tracking#container-repository
// version: 2025-08-1
// complexity_budget: 400 LoC
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
//   - ContainerRepository: class - Container data access
//   - findById: function - Get container by ID
//   - findByIdentifier: function - Get container by identifier
//   - findAll: function - List containers with filters
//   - create: function - Create new container
//   - update: function - Update container
//   - delete: function - Soft delete container
//   - getDefault: function - Get default container
//
// voice_considerations: |
//   Support voice-driven container queries.
//   Natural language container search.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/equipment/repositories/container-repository.test.ts
//
// tasks:
//   1. Implement base repository extension
//   2. Add container-specific queries
//   3. Implement default container logic
//   4. Add offline support
//   5. Create search methods
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

export class ContainerRepository extends BaseRepository<Container> {
  constructor(supabaseClient: SupabaseClient) {
    super('containers', supabaseClient);
  }

  /**
   * Find container by identifier within a tenant
   */
  async findByIdentifier(identifier: string, tenantId: string): Promise<Container | null> {
    try {
      const { data, error } = await this.supabaseClient
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
      const { data, error} = await this.supabaseClient
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
      let query = this.supabaseClient
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
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      // Order by name
      query = query.order('name', { ascending: true });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []).map(d => this.mapFromDb(d)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'CONTAINERS_FIND_FAILED',
        message: 'Failed to find containers',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Create new container
   */
  async create(data: ContainerCreate, tenantId: string): Promise<Container> {
    try {
      // Validate input
      const validated = ContainerCreateSchema.parse(data);

      // Check for duplicate identifier
      const existing = await this.findByIdentifier(validated.identifier, tenantId);
      if (existing) {
        throw createAppError({
          code: 'CONTAINER_IDENTIFIER_EXISTS',
          message: `Container with identifier ${validated.identifier} already exists`,
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.VALIDATION,
        });
      }

      // If setting as default, unset other defaults
      if (validated.isDefault) {
        await this.unsetDefaults(tenantId);
      }

      const dbData = this.mapToDb({
        ...validated,
        tenant_id: tenantId,
      });

      const { data: created, error } = await this.supabaseClient
        .from(this.tableName)
        .insert(dbData)
        .select('*')
        .single();

      if (error) throw error;

      return this.mapFromDb(created);
    } catch (error) {
      if ((error as any).code === 'CONTAINER_IDENTIFIER_EXISTS') throw error;
      
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
   * Update container
   */
  async update(id: string, data: ContainerUpdate, tenantId: string): Promise<Container | null> {
    try {
      // Validate input
      const validated = ContainerUpdateSchema.parse(data);

      // If setting as default, unset other defaults
      if (validated.isDefault === true) {
        await this.unsetDefaults(tenantId, id);
      }

      const dbData = this.mapToDb(validated);

      const { data: updated, error } = await this.supabaseClient
        .from(this.tableName)
        .update(dbData)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

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
   * Get active containers for voice selection
   */
  async getActiveContainers(tenantId: string): Promise<Container[]> {
    const result = await this.findAll({
      tenantId,
      filters: { isActive: true },
      limit: 100,
    });
    return result.data;
  }

  /**
   * Search containers by name or identifier
   */
  async searchContainers(
    searchTerm: string,
    tenantId: string
  ): Promise<Container[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,identifier.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;

      return (data || []).map(d => this.mapFromDb(d));
    } catch (error) {
      throw createAppError({
        code: 'CONTAINER_SEARCH_FAILED',
        message: 'Failed to search containers',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Unset default flag on all containers except the specified one
   */
  private async unsetDefaults(tenantId: string, exceptId?: string): Promise<void> {
    let query = this.supabaseClient
      .from(this.tableName)
      .update({ is_default: false })
      .eq('tenant_id', tenantId)
      .eq('is_default', true);

    if (exceptId) {
      query = query.neq('id', exceptId);
    }

    const { error } = await query;
    if (error) throw error;
  }

  /**
   * Map from database format
   */
  private mapFromDb(data: any): Container {
    return {
      id: data.id,
      tenantId: data.tenant_id,
      containerType: data.container_type,
      identifier: data.identifier,
      name: data.name,
      color: data.color,
      capacityInfo: data.capacity_info,
      primaryImageUrl: data.primary_image_url,
      additionalImageUrls: data.additional_image_urls,
      isDefault: data.is_default,
      isActive: data.is_active,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Map to database format
   */
  private mapToDb(data: any): any {
    const mapped: any = {};

    if (data.company_id !== undefined) mapped.company_id = data.company_id;
    if (data.tenantId !== undefined) mapped.company_id = data.tenantId;
    if (data.containerType !== undefined) mapped.container_type = data.containerType;
    if (data.identifier !== undefined) mapped.identifier = data.identifier;
    if (data.name !== undefined) mapped.name = data.name;
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