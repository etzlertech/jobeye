/**
 * @file /src/domains/inventory/adapters/container-repository-adapter.ts
 * @purpose Adapter to use equipment domain's ContainerRepository in inventory domain
 * @description Provides functional interface compatible with inventory services
 *              while using the comprehensive equipment repository implementation
 */

import { ContainerRepository } from '@/domains/equipment/repositories/container-repository';
import { createClient } from '@/lib/supabase/client';
import type {
  Container,
  ContainerCreate,
  ContainerUpdate,
  ContainerType,
} from '../types/inventory-types';

export interface ContainerFilter {
  companyId?: string;
  type?: ContainerType;
  isActive?: boolean;
  isDefault?: boolean;
  parentContainerId?: string;
  limit?: number;
  offset?: number;
}

// Shared repository instance to avoid client recreation
let repositoryInstance: ContainerRepository | null = null;

function getRepository(): ContainerRepository {
  if (!repositoryInstance) {
    const supabase = createClient();
    repositoryInstance = new ContainerRepository(supabase);
  }
  return repositoryInstance;
}

/**
 * Find container by ID
 */
export async function findById(
  id: string
): Promise<{ data: Container | null; error: Error | null }> {
  try {
    const repo = getRepository();
    const result = await repo.findById(id);
    return {
      data: result ? mapToInventoryFormat(result) : null,
      error: null,
    };
  } catch (error: any) {
    return {
      data: null,
      error: new Error(error.message || 'Failed to find container'),
    };
  }
}

/**
 * Find all containers with filters
 */
export async function findAll(
  filter: ContainerFilter = {}
): Promise<{ data: Container[]; error: Error | null; count: number }> {
  try {
    const repo = getRepository();

    // Map inventory filter format to equipment repository format
    const result = await repo.findAll({
      tenantId: filter.companyId || '',
      filters: {
        containerType: filter.type,
        isActive: filter.isActive,
        isDefault: filter.isDefault,
      },
      limit: filter.limit,
      offset: filter.offset,
    });

    return {
      data: result.data.map(mapToInventoryFormat),
      error: null,
      count: result.count,
    };
  } catch (error: any) {
    return {
      data: [],
      error: new Error(error.message || 'Failed to find containers'),
      count: 0,
    };
  }
}

/**
 * Create new container
 */
export async function create(
  container: ContainerCreate
): Promise<{ data: Container | null; error: Error | null }> {
  try {
    const repo = getRepository();

    // Extract tenant ID and prepare data
    const tenantId = container.company_id;
    if (!tenantId) {
      return {
        data: null,
        error: new Error('company_id is required'),
      };
    }

    const createData = {
      identifier: container.identifier || `container-${Date.now()}`,
      name: container.name,
      containerType: container.type || container.container_type,
      color: container.color,
      capacityInfo: container.capacity_info,
      primaryImageUrl: container.primary_image_url,
      additionalImageUrls: container.additional_image_urls,
      isDefault: container.is_default ?? false,
      isActive: container.is_active ?? true,
      metadata: container.metadata || {},
    };

    const result = await repo.create(createData, tenantId);

    return {
      data: mapToInventoryFormat(result),
      error: null,
    };
  } catch (error: any) {
    return {
      data: null,
      error: new Error(error.message || 'Failed to create container'),
    };
  }
}

/**
 * Update container
 */
export async function update(
  id: string,
  updates: ContainerUpdate
): Promise<{ data: Container | null; error: Error | null }> {
  try {
    const repo = getRepository();

    // Get existing container to extract tenant ID
    const existing = await repo.findById(id);
    if (!existing) {
      return {
        data: null,
        error: new Error('Container not found'),
      };
    }

    const tenantId = existing.tenantId;

    // Map update data
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined) updateData.containerType = updates.type;
    if (updates.container_type !== undefined) updateData.containerType = updates.container_type;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.capacity_info !== undefined) updateData.capacityInfo = updates.capacity_info;
    if (updates.primary_image_url !== undefined) updateData.primaryImageUrl = updates.primary_image_url;
    if (updates.additional_image_urls !== undefined) updateData.additionalImageUrls = updates.additional_image_urls;
    if (updates.is_default !== undefined) updateData.isDefault = updates.is_default;
    if (updates.is_active !== undefined) updateData.isActive = updates.is_active;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    const result = await repo.update(id, updateData, tenantId);

    return {
      data: result ? mapToInventoryFormat(result) : null,
      error: null,
    };
  } catch (error: any) {
    return {
      data: null,
      error: new Error(error.message || 'Failed to update container'),
    };
  }
}

/**
 * Delete container by ID
 * Note: Equipment repository doesn't have hard delete, so we do soft delete via is_active
 */
export async function deleteById(
  id: string
): Promise<{ error: Error | null }> {
  try {
    const repo = getRepository();

    // Get existing container to extract tenant ID
    const existing = await repo.findById(id);
    if (!existing) {
      return {
        error: new Error('Container not found'),
      };
    }

    // Soft delete by setting is_active to false
    await repo.update(id, { isActive: false }, existing.tenantId);

    return { error: null };
  } catch (error: any) {
    return {
      error: new Error(error.message || 'Failed to delete container'),
    };
  }
}

/**
 * Find containers by company (compatibility method for inventory service)
 */
export async function findByCompany(
  companyId: string,
  limit?: number
): Promise<{ data: Container[]; error: Error | null }> {
  try {
    const repo = getRepository();

    const result = await repo.findAll({
      tenantId: companyId,
      limit: limit || 50,
    });

    return {
      data: result.data.map(mapToInventoryFormat),
      error: null,
    };
  } catch (error: any) {
    return {
      data: [],
      error: new Error(error.message || 'Failed to find containers'),
    };
  }
}

/**
 * Map equipment repository format to inventory format
 */
function mapToInventoryFormat(equipmentContainer: any): Container {
  return {
    id: equipmentContainer.id,
    company_id: equipmentContainer.tenantId,
    name: equipmentContainer.name,
    type: equipmentContainer.containerType,
    container_type: equipmentContainer.containerType,
    identifier: equipmentContainer.identifier,
    color: equipmentContainer.color,
    capacity: null, // Equipment uses capacityInfo (string), inventory uses capacity (number)
    capacity_info: equipmentContainer.capacityInfo,
    primary_image_url: equipmentContainer.primaryImageUrl,
    additional_image_urls: equipmentContainer.additionalImageUrls,
    is_default: equipmentContainer.isDefault,
    is_active: equipmentContainer.isActive,
    status: equipmentContainer.isActive ? 'active' : 'inactive',
    current_location_id: null, // Not tracked in equipment repository
    parent_container_id: null, // Not tracked in equipment repository
    attributes: equipmentContainer.metadata,
    metadata: equipmentContainer.metadata,
    created_by: null, // Not tracked in equipment repository
    created_at: equipmentContainer.createdAt.toISOString(),
    updated_at: equipmentContainer.updatedAt.toISOString(),
  } as Container;
}