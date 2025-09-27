// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/equipment/services/container-service.ts
// phase: 4
// domain: equipment-tracking
// purpose: Business logic for loading container management
// spec_ref: phase4/equipment-tracking#container-service
// version: 2025-08-1
// complexity_budget: 400 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/equipment/repositories/container-repository
//     - /src/domains/equipment/types/container-types
//     - /src/core/events/event-bus
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - ContainerService: class - Container business logic
//   - createContainer: function - Create new container
//   - updateContainer: function - Update container
//   - getDefaultContainer: function - Get default for tenant
//   - assignItemToContainer: function - Assign item to container
//   - getContainerByVoice: function - Natural language container search
//
// voice_considerations: |
//   Natural language container selection.
//   Voice feedback for container status.
//   Default container suggestions.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/equipment/services/container-service.test.ts
//
// tasks:
//   1. Implement container CRUD operations
//   2. Add default container logic
//   3. Create voice command processing
//   4. Add capacity management
//   5. Implement event publishing
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { ContainerRepository } from '../repositories/container-repository';
import {
  Container,
  ContainerCreate,
  ContainerUpdate,
  ContainerType,
  ContainerFilters,
  ContainerVoiceCommand,
  ContainerAssignment,
  getContainerDisplayName,
  getContainerCapacityPercentage,
  DEFAULT_CONTAINERS,
} from '../types/container-types';
import { EventBus } from '@/core/events/event-bus';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { VoiceLogger } from '@/core/logger/voice-logger';

/**
 * Container service configuration
 */
interface ContainerServiceConfig {
  enableCapacityTracking?: boolean;
  enableVoiceCommands?: boolean;
  autoCreateDefaults?: boolean;
}

/**
 * Container business events
 */
export enum ContainerEventType {
  CONTAINER_CREATED = 'container.created',
  CONTAINER_UPDATED = 'container.updated',
  CONTAINER_DELETED = 'container.deleted',
  DEFAULT_CONTAINER_CHANGED = 'container.default_changed',
  ITEM_ASSIGNED_TO_CONTAINER = 'container.item_assigned',
  CONTAINER_CAPACITY_WARNING = 'container.capacity_warning',
}

/**
 * Container service for business logic orchestration
 */
export class ContainerService {
  private repository: ContainerRepository;
  private eventBus: EventBus;
  private logger: VoiceLogger;
  private config: Required<ContainerServiceConfig>;

  constructor(
    supabaseClient: SupabaseClient,
    eventBus?: EventBus,
    logger?: VoiceLogger,
    config?: ContainerServiceConfig
  ) {
    this.repository = new ContainerRepository(supabaseClient);
    this.eventBus = eventBus || new EventBus();
    this.logger = logger || new VoiceLogger();
    this.config = {
      enableCapacityTracking: config?.enableCapacityTracking ?? true,
      enableVoiceCommands: config?.enableVoiceCommands ?? true,
      autoCreateDefaults: config?.autoCreateDefaults ?? true,
    };
  }

  /**
   * Create a new container
   */
  async createContainer(
    data: ContainerCreate,
    tenantId: string,
    userId: string
  ): Promise<Container> {
    try {
      // Create container
      const container = await this.repository.create(data, tenantId);

      // Log creation
      await this.logger.info('Container created', {
        containerId: container.id,
        identifier: container.identifier,
        type: container.containerType,
        isDefault: container.isDefault,
        userId,
      });

      // Publish event
      await this.eventBus.emit({
        type: ContainerEventType.CONTAINER_CREATED,
        payload: {
          container,
          createdBy: userId,
        },
        metadata: {
          tenantId,
          timestamp: new Date(),
        },
      });

      return container;
    } catch (error) {
      await this.logger.error('Failed to create container', error as Error, {
        data,
        tenantId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update an existing container
   */
  async updateContainer(
    id: string,
    data: ContainerUpdate,
    tenantId: string,
    userId: string
  ): Promise<Container> {
    try {
      // Get current container
      const current = await this.repository.findById(id, tenantId);
      if (!current) {
        throw createAppError({
          code: 'CONTAINER_NOT_FOUND',
          message: `Container ${id} not found`,
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.NOT_FOUND,
        });
      }

      // Update container
      const updated = await this.repository.update(id, data, tenantId);
      if (!updated) {
        throw new Error('Update failed');
      }

      // Log update
      await this.logger.info('Container updated', {
        containerId: id,
        changes: data,
        userId,
      });

      // Publish event
      await this.eventBus.emit({
        type: ContainerEventType.CONTAINER_UPDATED,
        payload: {
          container: updated,
          previousState: current,
          updatedBy: userId,
        },
        metadata: {
          tenantId,
          timestamp: new Date(),
        },
      });

      // If default status changed, publish specific event
      if (data.isDefault === true && !current.isDefault) {
        await this.eventBus.emit({
          type: ContainerEventType.DEFAULT_CONTAINER_CHANGED,
          payload: {
            newDefault: updated,
            previousDefault: current,
          },
          metadata: {
            tenantId,
            timestamp: new Date(),
          },
        });
      }

      return updated;
    } catch (error) {
      await this.logger.error('Failed to update container', error as Error, {
        id,
        data,
        tenantId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get default container for a tenant
   */
  async getDefaultContainer(tenantId: string): Promise<Container | null> {
    try {
      const defaultContainer = await this.repository.getDefault(tenantId);

      // Auto-create default if enabled and none exists
      if (!defaultContainer && this.config.autoCreateDefaults) {
        const containers = await this.repository.findAll({ tenantId, limit: 1 });
        
        if (containers.count === 0) {
          // Create a default truck
          const defaultData = DEFAULT_CONTAINERS[0] as ContainerCreate;
          return await this.createContainer(
            defaultData,
            tenantId,
            'system'
          );
        }
      }

      return defaultContainer;
    } catch (error) {
      await this.logger.error('Failed to get default container', error as Error, {
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get container by identifier
   */
  async getContainerByIdentifier(
    identifier: string,
    tenantId: string
  ): Promise<Container | null> {
    return this.repository.findByIdentifier(identifier, tenantId);
  }

  /**
   * List active containers
   */
  async listActiveContainers(tenantId: string): Promise<Container[]> {
    return this.repository.getActiveContainers(tenantId);
  }

  /**
   * Process voice command for container selection
   */
  async processVoiceCommand(
    command: ContainerVoiceCommand,
    tenantId: string,
    userId: string
  ): Promise<Container | Container[] | null> {
    if (!this.config.enableVoiceCommands) {
      throw createAppError({
        code: 'VOICE_COMMANDS_DISABLED',
        message: 'Voice commands are not enabled',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.CONFIGURATION,
      });
    }

    try {
      switch (command.action) {
        case 'select':
          // Find container by natural language
          if (command.containerIdentifier) {
            const results = await this.repository.searchContainers(
              command.containerIdentifier,
              tenantId
            );
            
            if (results.length === 0) {
              await this.logger.warn('No containers found for voice command', {
                command,
                tenantId,
              });
              return null;
            }

            // Return best match
            return results[0];
          }
          // Return default if no identifier
          return this.getDefaultContainer(tenantId);

        case 'list':
          // List all active containers
          return this.listActiveContainers(tenantId);

        case 'change':
          // Change item container assignment
          throw new Error('Container change not yet implemented');

        default:
          throw new Error(`Unknown voice command action: ${command.action}`);
      }
    } catch (error) {
      await this.logger.error('Failed to process voice command', error as Error, {
        command,
        tenantId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Assign item to container (for tracking)
   */
  async assignItemToContainer(
    assignment: ContainerAssignment,
    tenantId: string
  ): Promise<void> {
    try {
      // Verify container exists
      const container = await this.repository.findById(assignment.containerId, tenantId);
      if (!container) {
        throw createAppError({
          code: 'CONTAINER_NOT_FOUND',
          message: `Container ${assignment.containerId} not found`,
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.NOT_FOUND,
        });
      }

      // Check capacity if enabled
      if (this.config.enableCapacityTracking && container.capacityInfo?.itemLimit) {
        // This would need to query current assignments to check capacity
        // For now, we'll just log the assignment
      }

      // Log assignment
      await this.logger.info('Item assigned to container', {
        ...assignment,
        containerName: container.name,
      });

      // Publish event
      await this.eventBus.emit({
        type: ContainerEventType.ITEM_ASSIGNED_TO_CONTAINER,
        payload: {
          assignment,
          container,
        },
        metadata: {
          tenantId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      await this.logger.error('Failed to assign item to container', error as Error, {
        assignment,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get container suggestions for voice feedback
   */
  async getContainerSuggestions(
    tenantId: string,
    itemType?: 'equipment' | 'material'
  ): Promise<string[]> {
    try {
      const containers = await this.listActiveContainers(tenantId);
      
      // Filter by typical usage patterns
      let filtered = containers;
      if (itemType === 'equipment') {
        filtered = containers.filter(c => 
          [ContainerType.TRUCK, ContainerType.TRAILER, ContainerType.VAN].includes(c.containerType)
        );
      } else if (itemType === 'material') {
        filtered = containers.filter(c =>
          [ContainerType.TRUCK, ContainerType.STORAGE_BIN].includes(c.containerType)
        );
      }

      // Return display names
      return filtered.map(c => getContainerDisplayName(c));
    } catch (error) {
      await this.logger.error('Failed to get container suggestions', error as Error, {
        tenantId,
        itemType,
      });
      return [];
    }
  }

  /**
   * Validate container for job requirements
   */
  async validateContainerCapacity(
    containerId: string,
    expectedItemCount: number,
    tenantId: string
  ): Promise<{ isValid: boolean; message?: string }> {
    try {
      const container = await this.repository.findById(containerId, tenantId);
      if (!container) {
        return { 
          isValid: false, 
          message: 'Container not found' 
        };
      }

      if (!container.capacityInfo?.itemLimit) {
        return { isValid: true }; // No limit defined
      }

      // This would need actual item count from assignments
      const currentItemCount = 0; // Placeholder
      const totalAfterLoading = currentItemCount + expectedItemCount;

      if (totalAfterLoading > container.capacityInfo.itemLimit) {
        const percentage = getContainerCapacityPercentage(container, totalAfterLoading);
        
        await this.eventBus.emit({
          type: ContainerEventType.CONTAINER_CAPACITY_WARNING,
          payload: {
            container,
            currentCount: currentItemCount,
            expectedCount: expectedItemCount,
            limit: container.capacityInfo.itemLimit,
            percentage,
          },
          metadata: {
            tenantId,
            timestamp: new Date(),
          },
        });

        return {
          isValid: false,
          message: `Container capacity exceeded: ${totalAfterLoading}/${container.capacityInfo.itemLimit} items`
        };
      }

      return { isValid: true };
    } catch (error) {
      await this.logger.error('Failed to validate container capacity', error as Error, {
        containerId,
        expectedItemCount,
        tenantId,
      });
      return {
        isValid: false,
        message: 'Failed to validate capacity'
      };
    }
  }
}