// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/property/services/property-service.ts
// phase: 2
// domain: property-management
// purpose: Property business logic orchestration with state management
// spec_ref: phase2/property-management#service
// version: 2025-08-1
// complexity_budget: 500 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/property/repositories/property-repository
//     - /src/domains/property/services/property-search-service
//     - /src/domains/property/types/property-types
//     - /src/domains/customer/types/customer-types
//     - /src/core/events/event-bus
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - PropertyService: class - Property business logic
//   - createProperty: function - Create property with validation
//   - updateProperty: function - Update with state transitions
//   - associateCustomer: function - Link property to customer
//   - findPropertiesByVoice: function - Voice-optimized search
//   - addServiceLocation: function - Add service details
//   - transitionState: function - Property state management
//
// state_machine:
//   states: [draft, active, inactive, scheduled]
//   transitions:
//     - from: draft, to: active, action: activate
//     - from: active, to: inactive, action: deactivate
//     - from: inactive, to: active, action: reactivate
//     - from: active, to: scheduled, action: schedule_service
//     - from: scheduled, to: active, action: complete_service
//
// voice_considerations: |
//   Orchestrate voice-friendly property searches.
//   Generate voice confirmations for property operations.
//   Support natural language state transitions.
//   Enable voice-based access instruction updates.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/property/services/property-service.test.ts
//
// tasks:
//   1. Implement property creation with address validation
//   2. Add customer association logic
//   3. Create state transition methods
//   4. Integrate search service
//   5. Add service location management
//   6. Implement event publishing
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { PropertyRepository } from '../repositories/property-repository';
import { PropertySearchService } from './property-search-service';
import {
  Property,
  PropertyCreate,
  PropertyUpdate,
  PropertyState,
  PropertyStateTransition,
  ServiceLocation,
  PropertyVoiceCommand,
  PropertySearchResult,
} from '../types/property-types';
import { Customer } from '@/domains/customer/types/customer-types';
import { EventBus } from '@/core/events/event-bus';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { z } from 'zod';

/**
 * Property service configuration
 */
interface PropertyServiceConfig {
  maxPropertiesPerCustomer?: number;
  requireAddressValidation?: boolean;
  autoGeocodeAddresses?: boolean;
  enableVoiceSearch?: boolean;
}

/**
 * Property business events
 */
export enum PropertyEventType {
  PROPERTY_CREATED = 'property.created',
  PROPERTY_UPDATED = 'property.updated',
  PROPERTY_STATE_CHANGED = 'property.state_changed',
  PROPERTY_CUSTOMER_ASSOCIATED = 'property.customer_associated',
  PROPERTY_SERVICE_SCHEDULED = 'property.service_scheduled',
  PROPERTY_SERVICE_COMPLETED = 'property.service_completed',
  PROPERTY_ACCESS_UPDATED = 'property.access_updated',
  PROPERTY_DELETED = 'property.deleted',
}

interface PropertyEventPayload {
  aggregateId: string;
  tenantId: string;
  userId?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Property service for business logic orchestration
 */
export class PropertyService {
  private repository: PropertyRepository;
  private searchService: PropertySearchService;
  private eventBus: EventBus;
  private config: Required<PropertyServiceConfig>;

  constructor(
    supabaseClient: SupabaseClient,
    eventBus: EventBus,
    config?: PropertyServiceConfig
  ) {
    this.repository = new PropertyRepository(supabaseClient);
    this.searchService = new PropertySearchService(supabaseClient);
    this.eventBus = eventBus;
    this.config = {
      maxPropertiesPerCustomer: config?.maxPropertiesPerCustomer ?? 100,
      requireAddressValidation: config?.requireAddressValidation ?? true,
      autoGeocodeAddresses: config?.autoGeocodeAddresses ?? true,
      enableVoiceSearch: config?.enableVoiceSearch ?? true,
    };
  }

  /**
   * Create a new property with validation and geocoding
   */
  async createProperty(
    data: PropertyCreate,
    tenantId: string,
    userId: string
  ): Promise<Property> {
    try {
      // Validate customer exists
      const customerProperties = await this.repository.findPropertiesByCustomer(
        data.customerId,
        tenantId
      );

      // Check property limit
      if (customerProperties.length >= this.config.maxPropertiesPerCustomer) {
        throw createAppError({
          code: 'PROPERTY_LIMIT_EXCEEDED',
          message: `Customer has reached the maximum limit of ${this.config.maxPropertiesPerCustomer} properties`,
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Check for duplicate address
      const existingProperty = await this.repository.findPropertyByAddress(
        data.address,
        tenantId
      );

      if (existingProperty) {
        throw createAppError({
          code: 'DUPLICATE_PROPERTY_ADDRESS',
          message: 'A property with this address already exists',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.VALIDATION,
          metadata: { propertyId: existingProperty.id },
        });
      }

      // Geocode address if enabled
      if (this.config.autoGeocodeAddresses) {
        try {
          const geocoded = await this.searchService.geocodeAddress(data.address);
          if (geocoded.location) {
            data.location = geocoded.location;
          }
        } catch (error) {
          // Log but don't fail on geocoding errors
          console.warn('Failed to geocode address:', error);
        }
      }

      // Create property
      const property = await this.repository.createProperty(data, tenantId);

      // Publish event
      this.emitEvent(PropertyEventType.PROPERTY_CREATED, {
        aggregateId: property.id,
        tenantId,
        userId,
        payload: {
          propertyId: property.id,
          customerId: property.customerId,
          address: property.address,
          type: property.type,
        },
        metadata: {
          voiceCreated: !!data.voiceMetadata,
        },
      });

      return property;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'PROPERTY_CREATE_FAILED',
        message: 'Failed to create property',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update property with validation
   */
  async updateProperty(
    propertyId: string,
    updates: PropertyUpdate,
    tenantId: string,
    userId: string
  ): Promise<Property> {
    try {
      // Get current property
      const currentProperty = await this.repository.findById(propertyId, tenantId);
      if (!currentProperty) {
        throw createAppError({
          code: 'PROPERTY_NOT_FOUND',
          message: 'Property not found',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Validate state transition if state is being updated
      if (updates.state && updates.state !== currentProperty.state) {
        this.validateStateTransition(currentProperty.state, updates.state);
      }

      // Update property
      const updatedProperty = await this.repository.updateProperty(
        propertyId,
        updates,
        tenantId
      );

      if (!updatedProperty) {
        throw new Error('Update failed');
      }

      // Publish event
      this.emitEvent(PropertyEventType.PROPERTY_UPDATED, {
        aggregateId: propertyId,
        tenantId,
        userId,
        payload: {
          propertyId,
          updates,
          previousState: currentProperty.state,
          newState: updatedProperty.state,
        },
      });

      // Publish state change event if state changed
      if (updates.state && updates.state !== currentProperty.state) {
        this.emitEvent(PropertyEventType.PROPERTY_STATE_CHANGED, {
          aggregateId: propertyId,
          tenantId,
          userId,
          payload: {
            propertyId,
            fromState: currentProperty.state,
            toState: updates.state,
            transition: {
              from: currentProperty.state,
              to: updates.state,
              reason: 'User initiated',
              performedBy: userId,
              timestamp: new Date(),
            } as PropertyStateTransition,
          },
        });
      }

      return updatedProperty;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'PROPERTY_UPDATE_FAILED',
        message: 'Failed to update property',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find properties by voice command
   */
  async findPropertiesByVoice(
    command: PropertyVoiceCommand,
    tenantId: string,
    userId: string
  ): Promise<PropertySearchResult[]> {
    if (!this.config.enableVoiceSearch) {
      throw createAppError({
        code: 'VOICE_SEARCH_DISABLED',
        message: 'Voice search is not enabled',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.BUSINESS_LOGIC,
      });
    }

    try {
      // Delegate to search service
      return await this.searchService.searchByVoiceCommand(command, tenantId);
    } catch (error) {
      throw createAppError({
        code: 'VOICE_SEARCH_FAILED',
        message: 'Failed to search properties by voice',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update property access information
   */
  async updateAccessInstructions(
    propertyId: string,
    instructions: {
      gateCode?: string;
      accessInstructions?: string;
      petWarnings?: string;
      voiceNotes?: string[];
    },
    tenantId: string,
    userId: string
  ): Promise<Property> {
    try {
      // Get current property
      const property = await this.repository.findById(propertyId, tenantId);
      if (!property) {
        throw createAppError({
          code: 'PROPERTY_NOT_FOUND',
          message: 'Property not found',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Update access notes
      const updates: PropertyUpdate = {
        notes: instructions.accessInstructions || property.notes,
      };

      const updatedProperty = await this.repository.updateProperty(
        propertyId,
        updates,
        tenantId
      );

      if (!updatedProperty) {
        throw new Error('Update failed');
      }

      // Publish event
      this.emitEvent(PropertyEventType.PROPERTY_ACCESS_UPDATED, {
        aggregateId: propertyId,
        tenantId,
        userId,
        payload: {
          propertyId,
          instructions,
          voiceUpdate: !!instructions.voiceNotes?.length,
        },
      });

      return updatedProperty;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'ACCESS_UPDATE_FAILED',
        message: 'Failed to update property access instructions',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Transition property state
   */
  async transitionState(
    propertyId: string,
    newState: PropertyState,
    reason: string,
    tenantId: string,
    userId: string
  ): Promise<Property> {
    try {
      const property = await this.repository.updatePropertyState(
        propertyId,
        newState,
        tenantId
      );

      if (!property) {
        throw createAppError({
          code: 'PROPERTY_NOT_FOUND',
          message: 'Property not found',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      return property;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'STATE_TRANSITION_FAILED',
        message: 'Failed to transition property state',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete a property (soft delete by setting inactive)
   */
  async deleteProperty(
    propertyId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    try {
      // Soft delete by setting inactive
      await this.transitionState(
        propertyId,
        PropertyState.INACTIVE,
        'Property deleted',
        tenantId,
        userId
      );

      // Publish event
      this.emitEvent(PropertyEventType.PROPERTY_DELETED, {
        aggregateId: propertyId,
        tenantId,
        userId,
        payload: {
          propertyId,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw createAppError({
        code: 'PROPERTY_DELETE_FAILED',
        message: 'Failed to delete property',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get properties for a customer
   */
  async getCustomerProperties(
    customerId: string,
    tenantId: string
  ): Promise<Property[]> {
    try {
      return await this.repository.findPropertiesByCustomer(customerId, tenantId);
    } catch (error) {
      throw createAppError({
        code: 'PROPERTIES_FETCH_FAILED',
        message: 'Failed to fetch customer properties',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get property by ID
   */
  async getProperty(
    propertyId: string,
    tenantId: string
  ): Promise<Property | null> {
    try {
      return await this.repository.findById(propertyId, tenantId);
    } catch (error) {
      throw createAppError({
        code: 'PROPERTY_FETCH_FAILED',
        message: 'Failed to fetch property',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find properties near a location
   */
  async findNearbyProperties(
    location: { latitude: number; longitude: number },
    radiusMeters: number,
    tenantId: string,
    limit: number = 20
  ): Promise<Array<Property & { distance: number }>> {
    try {
      return await this.repository.findPropertiesNearby(
        location,
        radiusMeters,
        tenantId,
        limit
      );
    } catch (error) {
      throw createAppError({
        code: 'NEARBY_SEARCH_FAILED',
        message: 'Failed to search nearby properties',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Validate state transition
   */
  private validateStateTransition(from: PropertyState, to: PropertyState): void {
    const validTransitions: Record<PropertyState, PropertyState[]> = {
      [PropertyState.DRAFT]: [PropertyState.ACTIVE],
      [PropertyState.ACTIVE]: [PropertyState.INACTIVE, PropertyState.SCHEDULED],
      [PropertyState.INACTIVE]: [PropertyState.ACTIVE],
      [PropertyState.SCHEDULED]: [PropertyState.ACTIVE],
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
   * Emit domain event through the shared event bus.
   */
  private emitEvent(eventType: PropertyEventType, event: PropertyEventPayload): void {
    this.eventBus.emit(eventType, {
      ...event,
      eventType,
      timestamp: new Date(),
    });
  }
}

/**
 * Factory function to create property service
 */
export function createPropertyService(
  supabaseClient: SupabaseClient,
  eventBus: EventBus,
  config?: PropertyServiceConfig
): PropertyService {
  return new PropertyService(supabaseClient, eventBus, config);
}
