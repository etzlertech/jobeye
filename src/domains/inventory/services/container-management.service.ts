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

import * as containersRepo from '../repositories/containers.repository';
import * as containerAssignmentsRepo from '../repositories/container-assignments.repository';
import * as inventoryItemsRepo from '../repositories/inventory-items.repository';
import type {
  Container,
  ContainerAssignment,
  InventoryItem,
} from '../types/inventory-types';

export interface ContainerWithContents {
  container: Container;
  items: InventoryItem[];
  totalItems: number;
}

/**
 * Create new container
 */
export async function createContainer(
  companyId: string,
  userId: string,
  data: {
    name: string;
    type: 'truck' | 'trailer' | 'warehouse' | 'toolbox' | 'storage_unit';
    locationId?: string;
    capacity?: number;
    attributes?: Record<string, any>;
  }
): Promise<{ data: Container | null; error: Error | null }> {
  return await containersRepo.create({
    company_id: companyId,
    name: data.name,
    type: data.type,
    status: 'active',
    current_location_id: data.locationId,
    capacity: data.capacity,
    attributes: data.attributes,
    created_by: userId,
  });
}

/**
 * Get container with its contents
 */
export async function getContainerWithContents(
  containerId: string
): Promise<{ data: ContainerWithContents | null; error: Error | null }> {
  try {
    // Step 1: Get container details
    const containerResult = await containersRepo.findById(containerId);
    if (containerResult.error || !containerResult.data) {
      return {
        data: null,
        error: containerResult.error || new Error('Container not found'),
      };
    }

    const container = containerResult.data;

    // Step 2: Get items in container
    const itemsResult = await inventoryItemsRepo.findAll({
      companyId: container.company_id,
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
  companyId: string,
  options: {
    type?: string;
    status?: string;
    limit?: number;
  } = {}
): Promise<{ data: Container[]; error: Error | null }> {
  return await containersRepo.findByCompany(companyId, options.limit);
}

/**
 * Update container details
 */
export async function updateContainer(
  containerId: string,
  updates: Partial<Container>
): Promise<{ data: Container | null; error: Error | null }> {
  return await containersRepo.update(containerId, updates);
}

/**
 * Assign item to container
 */
export async function assignItemToContainer(
  companyId: string,
  userId: string,
  itemId: string,
  containerId: string,
  jobId?: string
): Promise<{ data: ContainerAssignment | null; error: Error | null }> {
  try {
    // Step 1: Validate item exists
    const itemResult = await inventoryItemsRepo.findById(itemId);
    if (itemResult.error || !itemResult.data) {
      return {
        data: null,
        error: itemResult.error || new Error('Item not found'),
      };
    }

    // Step 2: Check for existing active assignment
    const existingResult = await containerAssignmentsRepo.findActiveByItem(itemId);
    if (existingResult.data) {
      return {
        data: null,
        error: new Error(
          `Item already assigned to container ${existingResult.data.container_id}`
        ),
      };
    }

    // Step 3: Create assignment
    const assignmentResult = await containerAssignmentsRepo.create({
      company_id: companyId,
      container_id: containerId,
      item_id: itemId,
      assigned_by: userId,
      job_id: jobId,
      status: 'active',
    });

    if (assignmentResult.error || !assignmentResult.data) {
      return {
        data: null,
        error:
          assignmentResult.error || new Error('Failed to create assignment'),
      };
    }

    // Step 4: Update item location
    await inventoryItemsRepo.update(itemId, {
      current_location_id: containerId,
      updated_at: new Date().toISOString(),
    });

    return {
      data: assignmentResult.data,
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
  itemId: string
): Promise<{ error: Error | null }> {
  try {
    // Find active assignment
    const assignmentResult = await containerAssignmentsRepo.findActiveByItem(itemId);

    if (!assignmentResult.data) {
      return {
        error: new Error('No active assignment found for item'),
      };
    }

    // Check out assignment
    const checkOutResult = await containerAssignmentsRepo.checkOut(
      assignmentResult.data.id,
      new Date().toISOString()
    );

    if (checkOutResult.error) {
      return checkOutResult;
    }

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