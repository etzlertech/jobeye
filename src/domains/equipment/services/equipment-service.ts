// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/equipment/services/equipment-service.ts
// phase: 2
// domain: equipment-tracking
// purpose: Equipment business logic orchestration with maintenance tracking
// spec_ref: phase2/equipment-tracking#service
// version: 2025-08-1
// complexity_budget: 500 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/equipment/repositories/equipment-repository
//     - /src/domains/equipment/types/equipment-types
//     - /src/core/events/event-bus
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - EquipmentService: class - Equipment business logic
//   - createEquipment: function - Create equipment with validation
//   - updateEquipment: function - Update with state transitions
//   - moveEquipment: function - Track equipment location changes
//   - addMaintenanceRecord: function - Record maintenance activities
//   - transitionState: function - Equipment state management
//   - deleteEquipment: function - Soft delete equipment
//   - bulkImportEquipment: function - Bulk equipment import
//
// state_machine:
//   states: [active, maintenance, repair, retired, lost]
//   transitions:
//     - from: active, to: maintenance, action: schedule_maintenance
//     - from: maintenance, to: active, action: complete_maintenance
//     - from: maintenance, to: repair, action: require_repair
//     - from: repair, to: active, action: complete_repair
//     - from: active, to: retired, action: retire
//     - from: any, to: lost, action: report_lost
//
// voice_considerations: |
//   Support voice-driven equipment status updates.
//   Enable natural language maintenance reporting.
//   Voice-confirm equipment location changes.
//   Generate voice alerts for maintenance schedules.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/equipment/services/equipment-service.test.ts
//
// tasks:
//   1. Implement equipment creation with validation
//   2. Add maintenance record management
//   3. Create state transition methods
//   4. Implement location tracking
//   5. Add bulk import functionality
//   6. Integrate event publishing
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { EquipmentRepository } from '../repositories/equipment-repository';
import {
  Equipment,
  EquipmentCreate,
  EquipmentUpdate,
  EquipmentType,
  EquipmentState,
  EquipmentCategory,
  EquipmentLocation,
  MaintenanceRecord,
  EquipmentVoiceCommand,
  EquipmentSearchResult,
} from '../types/equipment-types';
import { EventBus } from '@/core/events/event-bus';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

/**
 * Equipment service configuration
 */
interface EquipmentServiceConfig {
  enableMaintenanceReminders?: boolean;
  defaultMaintenanceIntervalDays?: number;
  requireLocationTracking?: boolean;
  enableVoiceCommands?: boolean;
}

/**
 * Equipment business events
 */
export enum EquipmentEventType {
  EQUIPMENT_CREATED = 'equipment.created',
  EQUIPMENT_UPDATED = 'equipment.updated',
  EQUIPMENT_STATE_CHANGED = 'equipment.state_changed',
  EQUIPMENT_MOVED = 'equipment.moved',
  EQUIPMENT_MAINTENANCE_SCHEDULED = 'equipment.maintenance_scheduled',
  EQUIPMENT_MAINTENANCE_COMPLETED = 'equipment.maintenance_completed',
  EQUIPMENT_RETIRED = 'equipment.retired',
  EQUIPMENT_LOST = 'equipment.lost',
  EQUIPMENT_FOUND = 'equipment.found',
}

/**
 * Equipment service for business logic orchestration
 */
export class EquipmentService {
  private repository: EquipmentRepository;
  private eventBus: EventBus;
  private config: Required<EquipmentServiceConfig>;

  constructor(
    supabaseClient: SupabaseClient,
    eventBus?: EventBus,
    config?: EquipmentServiceConfig
  ) {
    this.repository = new EquipmentRepository(supabaseClient);
    this.eventBus = eventBus || EventBus.getInstance();
    this.config = {
      enableMaintenanceReminders: config?.enableMaintenanceReminders ?? true,
      defaultMaintenanceIntervalDays: config?.defaultMaintenanceIntervalDays ?? 90,
      requireLocationTracking: config?.requireLocationTracking ?? true,
      enableVoiceCommands: config?.enableVoiceCommands ?? true,
    };
  }

  /**
   * Create new equipment with validation
   */
  async createEquipment(
    data: EquipmentCreate,
    tenantId: string,
    userId: string
  ): Promise<Equipment> {
    try {
      // Validate location if required
      if (this.config.requireLocationTracking && !data.location) {
        throw createAppError({
          code: 'LOCATION_REQUIRED',
          message: 'Equipment location is required',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.VALIDATION,
        });
      }

      // Check for duplicate serial number if provided
      if (data.serialNumber) {
        const existingEquipment = await this.repository.findBySerialNumber(
          data.serialNumber,
          tenantId
        );
        if (existingEquipment) {
          throw createAppError({
            code: 'DUPLICATE_SERIAL_NUMBER',
            message: 'Equipment with this serial number already exists',
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.VALIDATION,
            metadata: { equipmentId: existingEquipment.id },
          });
        }
      }

      // Create equipment
      const equipment = await this.repository.createEquipment(data, tenantId);

      // Publish event
      this.publishEvent({
        type: EquipmentEventType.EQUIPMENT_CREATED,
        aggregateId: equipment.id,
        tenantId,
        userId,
        payload: {
          equipmentId: equipment.id,
          name: equipment.name,
          type: equipment.type,
          category: equipment.category,
          location: equipment.location,
        },
        metadata: {
          voiceCreated: !!data.voiceMetadata,
        },
      });

      return equipment;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'EQUIPMENT_CREATE_FAILED',
        message: 'Failed to create equipment',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update equipment with validation
   */
  async updateEquipment(
    equipmentId: string,
    updates: EquipmentUpdate,
    tenantId: string,
    userId: string
  ): Promise<Equipment> {
    try {
      // Get current equipment
      const currentEquipment = await this.repository.findById(equipmentId, tenantId);
      if (!currentEquipment) {
        throw createAppError({
          code: 'EQUIPMENT_NOT_FOUND',
          message: 'Equipment not found',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Validate state transition if state is being updated
      if (updates.state && updates.state !== currentEquipment.state) {
        this.validateStateTransition(currentEquipment.state, updates.state);
      }

      // Update equipment
      const updatedEquipment = await this.repository.updateEquipment(
        equipmentId,
        updates,
        tenantId
      );

      if (!updatedEquipment) {
        throw new Error('Update failed');
      }

      // Publish events
      await this.publishEvent({
        type: EquipmentEventType.EQUIPMENT_UPDATED,
        aggregateId: equipmentId,
        tenantId,
        userId,
        payload: {
          equipmentId,
          updates,
          previousState: currentEquipment.state,
          newState: updatedEquipment.state,
        },
      });

      // Publish state change event if state changed
      if (updates.state && updates.state !== currentEquipment.state) {
        this.publishEvent({
          type: EquipmentEventType.EQUIPMENT_STATE_CHANGED,
          aggregateId: equipmentId,
          tenantId,
          userId,
          payload: {
            equipmentId,
            fromState: currentEquipment.state,
            toState: updates.state,
          },
        });
      }

      // Publish location change event if location changed
      if (updates.location && updates.location.id !== currentEquipment.location.id) {
        this.publishEvent({
          type: EquipmentEventType.EQUIPMENT_MOVED,
          aggregateId: equipmentId,
          tenantId,
          userId,
          payload: {
            equipmentId,
            fromLocation: currentEquipment.location,
            toLocation: {
              ...currentEquipment.location,
              ...updates.location,
            },
          },
        });
      }

      return updatedEquipment;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'EQUIPMENT_UPDATE_FAILED',
        message: 'Failed to update equipment',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Move equipment to new location
   */
  async moveEquipment(
    equipmentId: string,
    newLocation: Omit<EquipmentLocation, 'lastUpdated'>,
    tenantId: string,
    userId: string
  ): Promise<Equipment> {
    try {
      const currentEquipment = await this.repository.findById(equipmentId, tenantId);
      if (!currentEquipment) {
        throw createAppError({
          code: 'EQUIPMENT_NOT_FOUND',
          message: 'Equipment not found',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      const updatedEquipment = await this.repository.updateEquipmentLocation(
        equipmentId,
        newLocation,
        tenantId
      );

      if (!updatedEquipment) {
        throw new Error('Location update failed');
      }

      // Publish event
      this.publishEvent({
        type: EquipmentEventType.EQUIPMENT_MOVED,
        aggregateId: equipmentId,
        tenantId,
        userId,
        payload: {
          equipmentId,
          fromLocation: currentEquipment.location,
          toLocation: newLocation,
        },
      });

      return updatedEquipment;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'EQUIPMENT_MOVE_FAILED',
        message: 'Failed to move equipment',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Transition equipment state
   */
  async transitionState(
    equipmentId: string,
    newState: EquipmentState,
    reason: string,
    tenantId: string,
    userId: string
  ): Promise<Equipment> {
    try {
      const equipment = await this.repository.updateEquipment(
        equipmentId,
        { state: newState },
        tenantId
      );

      if (!equipment) {
        throw createAppError({
          code: 'EQUIPMENT_NOT_FOUND',
          message: 'Equipment not found',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Publish appropriate event based on new state
      let eventType = EquipmentEventType.EQUIPMENT_STATE_CHANGED;
      if (newState === EquipmentState.RETIRED) {
        eventType = EquipmentEventType.EQUIPMENT_RETIRED;
      } else if (newState === EquipmentState.LOST) {
        eventType = EquipmentEventType.EQUIPMENT_LOST;
      }

      await this.publishEvent({
        type: eventType,
        aggregateId: equipmentId,
        tenantId,
        userId,
        payload: {
          equipmentId,
          newState,
          reason,
        },
      });

      return equipment;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'STATE_TRANSITION_FAILED',
        message: 'Failed to transition equipment state',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete equipment (soft delete by setting retired)
   */
  async deleteEquipment(
    equipmentId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    try {
      // Soft delete by setting retired
      await this.transitionState(
        equipmentId,
        EquipmentState.RETIRED,
        'Equipment deleted',
        tenantId,
        userId
      );
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'EQUIPMENT_DELETE_FAILED',
        message: 'Failed to delete equipment',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Bulk import equipment
   */
  async bulkImportEquipment(
    equipmentList: EquipmentCreate[],
    tenantId: string,
    userId: string
  ): Promise<{
    success: Equipment[];
    failed: Array<{ data: EquipmentCreate; error: string }>;
  }> {
    const success: Equipment[] = [];
    const failed: Array<{ data: EquipmentCreate; error: string }> = [];

    for (const equipmentData of equipmentList) {
      try {
        const equipment = await this.createEquipment(equipmentData, tenantId, userId);
        success.push(equipment);
      } catch (error) {
        failed.push({
          data: equipmentData,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { success, failed };
  }

  /**
   * Get equipment by ID
   */
  async getEquipment(
    equipmentId: string,
    tenantId: string
  ): Promise<Equipment | null> {
    try {
      return await this.repository.findById(equipmentId, tenantId);
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
   * Search equipment by various criteria
   */
  async searchEquipment(
    searchTerm: string,
    tenantId: string,
    filters?: {
      type?: EquipmentType;
      category?: EquipmentCategory;
      state?: EquipmentState;
      location?: string;
    }
  ): Promise<Equipment[]> {
    try {
      if (searchTerm) {
        return await this.repository.searchEquipment(searchTerm, tenantId);
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
        code: 'EQUIPMENT_SEARCH_FAILED',
        message: 'Failed to search equipment',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get equipment by type
   */
  async getEquipmentByType(
    type: EquipmentType,
    tenantId: string
  ): Promise<Equipment[]> {
    try {
      return await this.repository.findEquipmentByType(type, tenantId);
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_TYPE_FETCH_FAILED',
        message: 'Failed to fetch equipment by type',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get equipment by location
   */
  async getEquipmentByLocation(
    locationId: string,
    tenantId: string
  ): Promise<Equipment[]> {
    try {
      return await this.repository.findEquipmentByLocation(locationId, tenantId);
    } catch (error) {
      throw createAppError({
        code: 'EQUIPMENT_LOCATION_FETCH_FAILED',
        message: 'Failed to fetch equipment by location',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Validate state transition
   */
  private validateStateTransition(from: EquipmentState, to: EquipmentState): void {
    const validTransitions: Record<EquipmentState, EquipmentState[]> = {
      [EquipmentState.ACTIVE]: [
        EquipmentState.MAINTENANCE,
        EquipmentState.REPAIR,
        EquipmentState.RETIRED,
        EquipmentState.LOST,
      ],
      [EquipmentState.MAINTENANCE]: [
        EquipmentState.ACTIVE,
        EquipmentState.REPAIR,
        EquipmentState.RETIRED,
        EquipmentState.LOST,
      ],
      [EquipmentState.REPAIR]: [
        EquipmentState.ACTIVE,
        EquipmentState.RETIRED,
        EquipmentState.LOST,
      ],
      [EquipmentState.RETIRED]: [EquipmentState.ACTIVE], // Can reactivate retired equipment
      [EquipmentState.LOST]: [EquipmentState.ACTIVE], // Can recover lost equipment
    };

    const allowedTransitions = validTransitions[from] || [];
    if (!allowedTransitions.includes(to)) {
      throw createAppError({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition from ${from} to ${to}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        metadata: { from, to, allowed: allowedTransitions },
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
 * Factory function to create equipment service
 */
export function createEquipmentService(
  supabaseClient: SupabaseClient,
  eventBus?: EventBus,
  config?: EquipmentServiceConfig
): EquipmentService {
  return new EquipmentService(supabaseClient, eventBus, config);
}