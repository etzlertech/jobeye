/**
 * @file /src/domains/inventory/services/container-management.service.ts
 * @phase 3.6
 * @domain Inventory
 * @purpose Manage containers (trucks, toolboxes) and item assignments
 * @complexity_budget 200
 * @feature 004-voice-vision-inventory
 *
 * Container management:
 * 1. Create/update containers (trucks, toolboxes, storage)
 * 2. Assign items to containers
 * 3. Track container contents
 * 4. Location-based queries
 */

import { ContainerRepository } from '@/domains/equipment/repositories/container-repository-enhanced';
import { createSupabaseClient } from '@/lib/supabase/client';
import * as inventoryItemsRepo from '../repositories/inventory-items.repository';
import type {
  Container,
  InventoryItem,
} from '../types/inventory-types';
import type { ContainerAssignment } from '@/domains/equipment/repositories/container-repository-enhanced';

export interface ContainerWithContents {
  container: Container;
  items: InventoryItem[];
  totalItems: number;
}

/**
 * Create new container
 */
export async function createContainer(
  tenantId: string,
  userId: string,
  data: {
    name: string;
    type: 'truck' | 'trailer' | 'warehouse' | 'toolbox' | 'storage_unit';
    locationId?: string;
    capacity?: number;
    attributes?: Record<string, any>;
  }
): Promise<{ data: Container | null; error: Error | null }> {
  try {
    const supabase = createSupabaseClient();
    const containerRepo = new ContainerRepository(supabase);
    
    const container = await containerRepo.create({
      tenantId,
      name: data.name,
      identifier: `${data.type}-${Date.now()}`,
      containerType: data.type,
      metadata: data.attributes,
      isActive: true,
    });
    
    return {
      data: {
        id: container.id,
        tenant_id: container.tenantId,
        name: container.name,
        type: container.containerType as any,
        status: 'active',
        current_location_id: data.locationId || null,
        capacity: data.capacity || null,
        attributes: container.metadata,
        created_by: userId,
        created_at: container.createdAt,
        updated_at: container.updatedAt,
      } as Container,
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
 * Get container with its contents
 */
export async function getContainerWithContents(
  containerId: string
): Promise<{ data: ContainerWithContents | null; error: Error | null }> {
  try {
    // Step 1: Get container details
    const supabase = createSupabaseClient();
    const containerRepo = new ContainerRepository(supabase);
    const equipmentContainer = await containerRepo.findById(containerId);
    
    if (!equipmentContainer) {
      return {
        data: null,
        error: new Error('Container not found'),
      };
    }

    const container: Container = {
      id: equipmentContainer.id,
      tenant_id: equipmentContainer.tenantId,
      name: equipmentContainer.name,
      type: equipmentContainer.containerType as any,
      status: equipmentContainer.isActive ? 'active' : 'inactive',
      current_location_id: null,
      capacity: null,
      attributes: equipmentContainer.metadata,
      created_by: null,
      created_at: equipmentContainer.createdAt,
      updated_at: equipmentContainer.updatedAt,
    } as Container;

    // Step 2: Get items in container
    const itemsResult = await inventoryItemsRepo.findAll({
      tenantId: container.tenant_id,
      locationId: containerId,
    });

    if (itemsResult.error) {
      return {
        data: null,
        error: itemsResult.error,
      };
    }

    return {
      data: {
        container,
        items: itemsResult.data,
        totalItems: itemsResult.count,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(`Failed to get container contents: ${err.message}`),
    };
  }
}

/**
 * Get all containers for company
 */
export async function getContainers(
  tenantId: string,
  options: {
    type?: string;
    status?: string;
    limit?: number;
  } = {}
): Promise<{ data: Container[]; error: Error | null }> {
  try {
    const supabase = createSupabaseClient();
    const containerRepo = new ContainerRepository(supabase);
    
    const result = await containerRepo.findAll({
      tenantId,
      filters: {
        containerType: options.type,
        isActive: options.status === 'active',
      },
      limit: options.limit,
    });
    
    const containers = result.data.map((c): Container => ({
      id: c.id,
      tenant_id: c.tenantId,
      name: c.name,
      type: c.containerType as any,
      status: c.isActive ? 'active' : 'inactive',
      current_location_id: null,
      capacity: null,
      attributes: c.metadata,
      created_by: null,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    }) as Container);
    
    return {
      data: containers,
      error: null,
    };
  } catch (error: any) {
    return {
      data: [],
      error: new Error(error.message || 'Failed to get containers'),
    };
  }
}

/**
 * Update container details
 */
export async function updateContainer(
  containerId: string,
  updates: Partial<Container>
): Promise<{ data: Container | null; error: Error | null }> {
  try {
    const supabase = createSupabaseClient();
    const containerRepo = new ContainerRepository(supabase);
    
    // Get existing container to get tenant ID
    const existing = await containerRepo.findById(containerId);
    if (!existing) {
      return {
        data: null,
        error: new Error('Container not found'),
      };
    }
    
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined) updateData.containerType = updates.type;
    if (updates.attributes !== undefined) updateData.metadata = updates.attributes;
    if (updates.status !== undefined) updateData.isActive = updates.status === 'active';
    
    const updated = await containerRepo.update(containerId, updateData, existing.tenantId);
    
    return {
      data: {
        id: updated.id,
        tenant_id: updated.tenantId,
        name: updated.name,
        type: updated.containerType as any,
        status: updated.isActive ? 'active' : 'inactive',
        current_location_id: updates.current_location_id || null,
        capacity: updates.capacity || null,
        attributes: updated.metadata,
        created_by: null,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      } as Container,
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
 * Assign item to container
 */
export async function assignItemToContainer(
  tenantId: string,
  userId: string,
  itemId: string,
  containerId: string,
  jobId?: string
): Promise<{ data: ContainerAssignment | null; error: Error | null }> {
  try {
    // Initialize container repository
    const supabase = createSupabaseClient();
    const containerRepo = new ContainerRepository(supabase);

    // Step 1: Validate item exists
    const itemResult = await inventoryItemsRepo.findById(itemId);
    if (itemResult.error || !itemResult.data) {
      return {
        data: null,
        error: itemResult.error || new Error('Item not found'),
      };
    }

    // Step 2: Check for existing active assignment
    const existingAssignment = await containerRepo.findActiveAssignment(itemId, tenantId);
    if (existingAssignment) {
      return {
        data: null,
        error: new Error(
          `Item already assigned to container ${existingAssignment.container_id}`
        ),
      };
    }

    // Step 3: Create assignment
    const assignment = await containerRepo.createAssignment({
      tenant_id: tenantId,
      container_id: containerId,
      item_id: itemId,
      item_type: 'tool', // Assuming tools for inventory items
      assigned_by: userId,
    });

    // Step 4: Update item location
    await inventoryItemsRepo.update(itemId, {
      current_location_id: containerId,
      updated_at: new Date().toISOString(),
    });

    return {
      data: assignment,
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(`Assignment failed: ${err.message}`),
    };
  }
}

/**
 * Remove item from container
 */
export async function removeItemFromContainer(
  itemId: string,
  tenantId: string
): Promise<{ error: Error | null }> {
  try {
    // Initialize container repository
    const supabase = createSupabaseClient();
    const containerRepo = new ContainerRepository(supabase);

    // Find active assignment
    const assignment = await containerRepo.findActiveAssignment(itemId, tenantId);

    if (!assignment) {
      return {
        error: new Error('No active assignment found for item'),
      };
    }

    // Check out assignment
    await containerRepo.checkOutAssignment(
      assignment.id,
      new Date().toISOString(),
      tenantId
    );

    // Clear item location
    await inventoryItemsRepo.update(itemId, {
      current_location_id: null,
      updated_at: new Date().toISOString(),
    });

    return { error: null };
  } catch (err: any) {
    return {
      error: new Error(`Failed to remove item from container: ${err.message}`),
    };
  }
}

/**
 * Get container capacity info
 */
export async function getContainerCapacity(
  containerId: string
): Promise<{
  data: {
    capacity: number | null;
    currentCount: number;
    availableSpace: number | null;
    utilizationPercent: number | null;
  } | null;
  error: Error | null;
}> {
  try {
    const result = await getContainerWithContents(containerId);

    if (result.error || !result.data) {
      return {
        data: null,
        error: result.error || new Error('Failed to get container'),
      };
    }

    const { container, totalItems } = result.data;
    const capacity = container.capacity;

    return {
      data: {
        capacity,
        currentCount: totalItems,
        availableSpace: capacity ? capacity - totalItems : null,
        utilizationPercent:
          capacity && capacity > 0 ? (totalItems / capacity) * 100 : null,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(`Capacity calculation failed: ${err.message}`),
    };
  }
}