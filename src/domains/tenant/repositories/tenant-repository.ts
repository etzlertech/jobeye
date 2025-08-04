// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/tenant/repositories/tenant-repository.ts
// purpose: Data access layer for tenant operations with Supabase RLS, pagination, and multi-tenant isolation
// spec_ref: tenant#repository
// version: 2025-08-1
// domain: tenant
// phase: 1
// complexity_budget: medium
// offline_capability: OPTIONAL
//
// dependencies:
//   - internal: ['src/core/database/connection.ts', 'src/core/logger/logger.ts', 'src/core/errors/error-types.ts', 'src/domains/tenant/types/tenant-types.ts']
//   - external: ['@supabase/supabase-js']
//
// exports:
//   - TenantRepository: class - Data access layer for tenant operations with RLS enforcement
//   - create(tenantData: CreateTenantData): Promise<Tenant> - Create new tenant with validation
//   - findById(id: string): Promise<Tenant | null> - Get tenant by ID with settings
//   - findBySlug(slug: string): Promise<Tenant | null> - Get tenant by URL slug
//   - findByDomain(domain: string): Promise<Tenant | null> - Get tenant by domain with fallback
//   - update(id: string, updates: UpdateTenantData): Promise<Tenant> - Update tenant configuration
//   - delete(id: string): Promise<void> - Soft delete tenant with data retention
//   - list(options: ListOptions): Promise<PaginatedResult<Tenant>> - List tenants with pagination
//   - checkNameUniqueness(name: string, excludeId?: string): Promise<boolean> - Validate name uniqueness
//   - checkSlugUniqueness(slug: string, excludeId?: string): Promise<boolean> - Validate slug uniqueness
//   - checkDomainUniqueness(domain: string, excludeId?: string): Promise<boolean> - Validate domain uniqueness
//
// voice_considerations: >
//   Repository should handle voice configuration data efficiently for real-time voice operations.
//   Voice settings should be cached separately for performance during voice interactions.
//   Tenant voice data should be isolated to prevent cross-tenant voice pattern access.
//
// security_considerations: >
//   All operations must enforce Row Level Security policies for multi-tenant data isolation.
//   Tenant data must be filtered by user permissions and tenant assignments.
//   Sensitive configuration data must be encrypted at rest using Supabase encryption.
//   Domain validation must prevent tenant impersonation and subdomain hijacking.
//   Soft delete must preserve audit trails while securing deleted tenant data.
//
// performance_considerations: >
//   Repository should use efficient queries with proper indexing on slug, domain, and name fields.
//   Pagination should use cursor-based pagination for large tenant datasets.
//   Frequently accessed tenant data should be cached with appropriate TTL.
//   Bulk operations should use batch processing to minimize database round trips.
//   Complex joins should be optimized to avoid N+1 query problems.
//
// tasks:
//   1. [SETUP] Create TenantRepository class with Supabase client and error handling
//   2. [CREATE] Implement create method with validation and default settings setup
//   3. [FIND_BY_ID] Add findById method with settings and voice config retrieval
//   4. [FIND_BY_SLUG] Create findBySlug method with active tenant filtering
//   5. [FIND_BY_DOMAIN] Implement findByDomain with primary and allowed domain matching
//   6. [UPDATE] Add update method with configuration merging and validation
//   7. [DELETE] Create soft delete method with data retention and cleanup
//   8. [LIST] Implement list method with pagination, filtering, and sorting
//   9. [UNIQUENESS] Add uniqueness checking methods for name, slug, and domain
//  10. [HELPERS] Create helper methods for query optimization and data transformation
// --- END DIRECTIVE BLOCK ---

import { supabase } from '@/core/database/connection';
import { logger } from '@/core/logger/logger';
import { DatabaseError, NotFoundError, ValidationError } from '@/core/errors/error-types';
import type {
  Tenant,
  CreateTenantData,
  UpdateTenantData,
  TenantSettings,
  createDefaultTenantSettings
} from '@/domains/tenant/types/tenant-types';

// Repository interfaces
interface ListOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  sortBy?: 'name' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class TenantRepository {
  private readonly tableName = 'tenants';

  /**
   * Create a new tenant with validation and default settings
   */
  async create(tenantData: CreateTenantData, createdBy?: string): Promise<Tenant> {
    try {
      logger.info('Creating tenant', { name: tenantData.name });

      // Validate uniqueness
      await this.validateUniqueness(tenantData);

      // Generate slug from name if not provided
      const slug = await this.generateUniqueSlug(tenantData.name);

      // Merge with default settings
      const defaultSettings = createDefaultTenantSettings();
      const settings: TenantSettings = {
        branding: {
          ...defaultSettings.branding,
          ...tenantData.settings?.branding
        },
        features: {
          ...defaultSettings.features,
          ...tenantData.settings?.features
        },
        limits: {
          ...defaultSettings.limits,
          ...tenantData.settings?.limits
        }
      };

      const { data, error } = await supabase()
        .from(this.tableName)
        .insert({
          name: tenantData.name,
          slug,
          display_name: tenantData.display_name,
          description: tenantData.description,
          domain: tenantData.domain,
          allowed_domains: tenantData.allowed_domains || [],
          settings,
          is_active: true,
          created_by: createdBy,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (error) {
        throw new DatabaseError(`Failed to create tenant: ${error.message}`);
      }

      logger.info('Tenant created successfully', { tenantId: data.id, slug });
      return data as Tenant;

    } catch (error) {
      logger.error('Error creating tenant', { error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Find tenant by ID with full settings
   */
  async findById(id: string): Promise<Tenant | null> {
    try {
      const { data, error } = await supabase()
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new DatabaseError(`Failed to find tenant by ID: ${error.message}`);
      }

      return data as Tenant;

    } catch (error) {
      logger.error('Error finding tenant by ID', { id, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Find tenant by slug
   */
  async findBySlug(slug: string): Promise<Tenant | null> {
    try {
      const { data, error } = await supabase()
        .from(this.tableName)
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new DatabaseError(`Failed to find tenant by slug: ${error.message}`);
      }

      return data as Tenant;

    } catch (error) {
      logger.error('Error finding tenant by slug', { slug, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Find tenant by domain (primary or allowed domains)
   */
  async findByDomain(domain: string): Promise<Tenant | null> {
    try {
      // First try primary domain
      let { data, error } = await supabase()
        .from(this.tableName)
        .select('*')
        .eq('domain', domain)
        .eq('is_active', true)
        .single();

      if (data) {
        return data as Tenant;
      }

      // If not found in primary domain, check allowed_domains array
      const { data: domainData, error: domainError } = await supabase()
        .from(this.tableName)
        .select('*')
        .contains('allowed_domains', [domain])
        .eq('is_active', true)
        .single();

      if (domainError && domainError.code !== 'PGRST116') {
        throw new DatabaseError(`Failed to find tenant by domain: ${domainError.message}`);
      }

      return domainData as Tenant || null;

    } catch (error) {
      logger.error('Error finding tenant by domain', { domain, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Update tenant with configuration merging
   */
  async update(id: string, updates: UpdateTenantData, updatedBy?: string): Promise<Tenant> {
    try {
      logger.info('Updating tenant', { tenantId: id });

      // Get existing tenant
      const existingTenant = await this.findById(id);
      if (!existingTenant) {
        throw new NotFoundError(`Tenant ${id} not found`);
      }

      // Validate uniqueness for changed fields
      await this.validateUniquenessForUpdate(updates, id);

      // Merge settings
      const mergedSettings: TenantSettings = {
        branding: {
          ...existingTenant.settings.branding,
          ...updates.settings?.branding
        },
        features: {
          ...existingTenant.settings.features,
          ...updates.settings?.features
        },
        limits: {
          ...existingTenant.settings.limits,
          ...updates.settings?.limits
        }
      };

      const updateData: any = {
        ...updates,
        settings: mergedSettings,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const { data, error } = await supabase()
        .from(this.tableName)
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        throw new DatabaseError(`Failed to update tenant: ${error.message}`);
      }

      logger.info('Tenant updated successfully', { tenantId: id });
      return data as Tenant;

    } catch (error) {
      logger.error('Error updating tenant', { tenantId: id, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Soft delete tenant with data retention
   */
  async delete(id: string, deletedBy?: string): Promise<void> {
    try {
      logger.info('Deleting tenant', { tenantId: id });

      const { error } = await supabase()
        .from(this.tableName)
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
          deleted_by: deletedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        throw new DatabaseError(`Failed to delete tenant: ${error.message}`);
      }

      logger.info('Tenant deleted successfully', { tenantId: id });

    } catch (error) {
      logger.error('Error deleting tenant', { tenantId: id, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * List tenants with pagination and filtering
   */
  async list(options: ListOptions = {}): Promise<PaginatedResult<Tenant>> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status = 'active',
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = options;

      const offset = (page - 1) * limit;

      // Build query with filters
      let query = supabase()
        .from(this.tableName)
        .select('*', { count: 'exact' });

      // Apply status filter
      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      }
      // 'all' status doesn't add a filter

      // Apply search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,display_name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new DatabaseError(`Failed to list tenants: ${error.message}`);
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: data as Tenant[],
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      };

    } catch (error) {
      logger.error('Error listing tenants', { error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Check if tenant name is unique
   */
  async checkNameUniqueness(name: string, excludeId?: string): Promise<boolean> {
    try {
      let query = supabase()
        .from(this.tableName)
        .select('id')
        .eq('name', name);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        throw new DatabaseError(`Failed to check name uniqueness: ${error.message}`);
      }

      return !data; // Returns true if name is unique (no data found)

    } catch (error) {
      logger.error('Error checking name uniqueness', { name, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Check if tenant slug is unique
   */
  async checkSlugUniqueness(slug: string, excludeId?: string): Promise<boolean> {
    try {
      let query = supabase()
        .from(this.tableName)
        .select('id')
        .eq('slug', slug);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        throw new DatabaseError(`Failed to check slug uniqueness: ${error.message}`);
      }

      return !data; // Returns true if slug is unique (no data found)

    } catch (error) {
      logger.error('Error checking slug uniqueness', { slug, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Check if domain is unique
   */
  async checkDomainUniqueness(domain: string, excludeId?: string): Promise<boolean> {
    try {
      // Check primary domain
      let query = supabase()
        .from(this.tableName)
        .select('id')
        .eq('domain', domain);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data: primaryData, error: primaryError } = await query.single();

      if (primaryError && primaryError.code !== 'PGRST116') {
        throw new DatabaseError(`Failed to check domain uniqueness: ${primaryError.message}`);
      }

      if (primaryData) {
        return false; // Domain is not unique
      }

      // Check allowed_domains array
      let allowedQuery = supabase()
        .from(this.tableName)
        .select('id')
        .contains('allowed_domains', [domain]);

      if (excludeId) {
        allowedQuery = allowedQuery.neq('id', excludeId);
      }

      const { data: allowedData, error: allowedError } = await allowedQuery.single();

      if (allowedError && allowedError.code !== 'PGRST116') {
        throw new DatabaseError(`Failed to check allowed domains uniqueness: ${allowedError.message}`);
      }

      return !allowedData; // Returns true if domain is unique (no data found)

    } catch (error) {
      logger.error('Error checking domain uniqueness', { domain, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  // Private helper methods

  /**
   * Validate uniqueness constraints for create operation
   */
  private async validateUniqueness(tenantData: CreateTenantData): Promise<void> {
    // Check name uniqueness
    const nameIsUnique = await this.checkNameUniqueness(tenantData.name);
    if (!nameIsUnique) {
      throw new ValidationError(`Tenant name '${tenantData.name}' is already in use`);
    }

    // Check domain uniqueness if provided
    if (tenantData.domain) {
      const domainIsUnique = await this.checkDomainUniqueness(tenantData.domain);
      if (!domainIsUnique) {
        throw new ValidationError(`Domain '${tenantData.domain}' is already in use`);
      }
    }

    // Check allowed domains uniqueness
    if (tenantData.allowed_domains) {
      for (const domain of tenantData.allowed_domains) {
        const domainIsUnique = await this.checkDomainUniqueness(domain);
        if (!domainIsUnique) {
          throw new ValidationError(`Domain '${domain}' is already in use`);
        }
      }
    }
  }

  /**
   * Validate uniqueness constraints for update operation
   */
  private async validateUniquenessForUpdate(updates: UpdateTenantData, excludeId: string): Promise<void> {
    // Check name uniqueness if being updated
    if (updates.name) {
      const nameIsUnique = await this.checkNameUniqueness(updates.name, excludeId);
      if (!nameIsUnique) {
        throw new ValidationError(`Tenant name '${updates.name}' is already in use`);
      }
    }

    // Check domain uniqueness if being updated
    if (updates.domain) {
      const domainIsUnique = await this.checkDomainUniqueness(updates.domain, excludeId);
      if (!domainIsUnique) {
        throw new ValidationError(`Domain '${updates.domain}' is already in use`);
      }
    }

    // Check allowed domains uniqueness if being updated
    if (updates.allowed_domains) {
      for (const domain of updates.allowed_domains) {
        const domainIsUnique = await this.checkDomainUniqueness(domain, excludeId);
        if (!domainIsUnique) {
          throw new ValidationError(`Domain '${domain}' is already in use`);
        }
      }
    }
  }

  /**
   * Generate unique slug from tenant name
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    // Convert name to slug format
    let baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    // Ensure uniqueness
    let slug = baseSlug;
    let counter = 0;

    while (!(await this.checkSlugUniqueness(slug))) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }

  /**
   * Get tenants count for statistics
   */
  async getCount(status?: 'active' | 'inactive' | 'all'): Promise<number> {
    try {
      let query = supabase()
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      }

      const { count, error } = await query;

      if (error) {
        throw new DatabaseError(`Failed to get tenant count: ${error.message}`);
      }

      return count || 0;

    } catch (error) {
      logger.error('Error getting tenant count', { error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Bulk update tenant settings
   */
  async bulkUpdateSettings(tenantIds: string[], settingsUpdate: Partial<TenantSettings>): Promise<void> {
    try {
      logger.info('Bulk updating tenant settings', { tenantCount: tenantIds.length });

      const { error } = await supabase()
        .from(this.tableName)
        .update({
          settings: settingsUpdate,
          updated_at: new Date().toISOString()
        })
        .in('id', tenantIds);

      if (error) {
        throw new DatabaseError(`Failed to bulk update tenant settings: ${error.message}`);
      }

      logger.info('Bulk tenant settings update completed', { tenantCount: tenantIds.length });

    } catch (error) {
      logger.error('Error in bulk tenant settings update', { error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }
}