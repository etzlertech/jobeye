import { PropertyService, PropertyEventType, createPropertyService } from '@/domains/property/services/property-service';
import { PropertyRepository } from '@/domains/property/repositories/property-repository';
import { PropertySearchService } from '@/domains/property/services/property-search-service';
import { EventBus } from '@/core/events/event-bus';
import {
  Property,
  PropertyCreate,
  PropertyUpdate,
  PropertyState,
  PropertyType,
  Address,
  PropertySearchResult,
  PropertyVoiceCommand,
} from '@/domains/property/types/property-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock dependencies
jest.mock('@/domains/property/repositories/property-repository');
jest.mock('@/domains/property/services/property-search-service');
jest.mock('@/core/events/event-bus');

describe('PropertyService', () => {
  let propertyService: PropertyService;
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockRepository: jest.Mocked<PropertyRepository>;
  let mockSearchService: jest.Mocked<PropertySearchService>;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';

  const mockAddress: Address = {
    street: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    country: 'US',
  };

  const mockProperty: Property = {
    id: 'prop-123',
    tenant_id: mockTenantId,
    customerId: 'cust-123',
    property_number: 'PROP-001',
    name: 'Test Property',
    address: mockAddress,
    type: PropertyType.RESIDENTIAL,
    state: PropertyState.ACTIVE,
    is_active: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabaseClient = {} as jest.Mocked<SupabaseClient>;

    // Mock EventBus
    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    } as unknown as jest.Mocked<EventBus>;

    // Mock Repository
    mockRepository = {
      createProperty: jest.fn().mockResolvedValue(mockProperty),
      updateProperty: jest.fn().mockResolvedValue(mockProperty),
      findById: jest.fn().mockResolvedValue(mockProperty),
      findPropertiesByCustomer: jest.fn().mockResolvedValue([]),
      findPropertyByAddress: jest.fn().mockResolvedValue(null),
      updatePropertyState: jest.fn().mockResolvedValue(mockProperty),
      findPropertiesNearby: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PropertyRepository>;

    // Mock Search Service
    mockSearchService = {
      geocodeAddress: jest.fn().mockResolvedValue({ address: mockAddress, confidence: 0.9 }),
      searchByVoiceCommand: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PropertySearchService>;

    // Mock the constructor calls
    (PropertyRepository as jest.MockedClass<typeof PropertyRepository>).mockImplementation(() => mockRepository);
    (PropertySearchService as jest.MockedClass<typeof PropertySearchService>).mockImplementation(() => mockSearchService);

    // Create service instance
    propertyService = new PropertyService(mockSupabaseClient, mockEventBus);
  });

  describe('createProperty', () => {
    const validPropertyData: PropertyCreate = {
      customerId: 'cust-123',
      address: mockAddress,
      type: PropertyType.RESIDENTIAL,
      notes: 'Test property',
    };

    it('should successfully create a property', async () => {
      const result = await propertyService.createProperty(validPropertyData, mockTenantId, mockUserId);

      expect(result).toEqual(mockProperty);
      expect(mockRepository.createProperty).toHaveBeenCalledWith(validPropertyData, mockTenantId);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PropertyEventType.PROPERTY_CREATED,
          aggregateId: mockProperty.id,
          tenantId: mockTenantId,
          userId: mockUserId,
        })
      );
    });

    it('should check for duplicate addresses before creating', async () => {
      mockRepository.findPropertyByAddress.mockResolvedValueOnce(mockProperty);

      await expect(
        propertyService.createProperty(validPropertyData, mockTenantId, mockUserId)
      ).rejects.toThrow('A property with this address already exists');

      expect(mockRepository.createProperty).not.toHaveBeenCalled();
    });

    it('should enforce property limit per customer', async () => {
      const manyProperties = Array(100).fill(mockProperty);
      mockRepository.findPropertiesByCustomer.mockResolvedValueOnce(manyProperties);

      await expect(
        propertyService.createProperty(validPropertyData, mockTenantId, mockUserId)
      ).rejects.toThrow('Customer has reached the maximum limit');

      expect(mockRepository.createProperty).not.toHaveBeenCalled();
    });

    it('should geocode address when enabled', async () => {
      const geocodedLocation = { latitude: 39.7817, longitude: -89.6501 };
      mockSearchService.geocodeAddress.mockResolvedValueOnce({
        address: mockAddress,
        location: {
          ...geocodedLocation,
          source: 'geocoding',
          timestamp: new Date(),
        },
        confidence: 0.95,
        source: 'google',
      });

      await propertyService.createProperty(validPropertyData, mockTenantId, mockUserId);

      expect(mockSearchService.geocodeAddress).toHaveBeenCalledWith(mockAddress);
      expect(mockRepository.createProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining(geocodedLocation),
        }),
        mockTenantId
      );
    });

    it('should continue even if geocoding fails', async () => {
      mockSearchService.geocodeAddress.mockRejectedValueOnce(new Error('Geocoding failed'));

      const result = await propertyService.createProperty(validPropertyData, mockTenantId, mockUserId);

      expect(result).toEqual(mockProperty);
      expect(mockRepository.createProperty).toHaveBeenCalled();
    });

    it('should include voice metadata in event when provided', async () => {
      const dataWithVoice: PropertyCreate = {
        ...validPropertyData,
        voiceMetadata: {
          nickname: 'The Smith House',
          landmarks: ['near the park'],
        },
      };

      await propertyService.createProperty(dataWithVoice, mockTenantId, mockUserId);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            voiceCreated: true,
          }),
        })
      );
    });

    it('should handle repository errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockRepository.createProperty.mockRejectedValueOnce(dbError);

      await expect(
        propertyService.createProperty(validPropertyData, mockTenantId, mockUserId)
      ).rejects.toMatchObject({
        message: 'Failed to create property',
        originalError: dbError,
      });
    });

    it('should create property with custom configuration', async () => {
      const customService = new PropertyService(mockSupabaseClient, mockEventBus, {
        maxPropertiesPerCustomer: 5,
        requireAddressValidation: false,
        autoGeocodeAddresses: false,
      });

      await customService.createProperty(validPropertyData, mockTenantId, mockUserId);

      expect(mockSearchService.geocodeAddress).not.toHaveBeenCalled();
    });
  });

  describe('updateProperty', () => {
    const updates: PropertyUpdate = {
      notes: 'Updated notes',
      state: PropertyState.INACTIVE,
    };

    it('should successfully update a property', async () => {
      const updatedProperty = { ...mockProperty, ...updates };
      mockRepository.updateProperty.mockResolvedValueOnce(updatedProperty);

      const result = await propertyService.updateProperty(
        mockProperty.id,
        updates,
        mockTenantId,
        mockUserId
      );

      expect(result).toEqual(updatedProperty);
      expect(mockRepository.updateProperty).toHaveBeenCalledWith(mockProperty.id, updates, mockTenantId);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PropertyEventType.PROPERTY_UPDATED,
        })
      );
    });

    it('should validate state transitions', async () => {
      const invalidTransition: PropertyUpdate = {
        state: PropertyState.SCHEDULED,
      };
      mockRepository.findById.mockResolvedValueOnce({
        ...mockProperty,
        state: PropertyState.INACTIVE,
      });

      await expect(
        propertyService.updateProperty(mockProperty.id, invalidTransition, mockTenantId, mockUserId)
      ).rejects.toThrow('Cannot transition from inactive to scheduled');
    });

    it('should publish state change event when state changes', async () => {
      const stateUpdate: PropertyUpdate = { state: PropertyState.INACTIVE };
      const updatedProperty = { ...mockProperty, state: PropertyState.INACTIVE };
      mockRepository.updateProperty.mockResolvedValueOnce(updatedProperty);

      await propertyService.updateProperty(mockProperty.id, stateUpdate, mockTenantId, mockUserId);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PropertyEventType.PROPERTY_STATE_CHANGED,
          payload: expect.objectContaining({
            fromState: PropertyState.ACTIVE,
            toState: PropertyState.INACTIVE,
          }),
        })
      );
    });

    it('should handle property not found', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(
        propertyService.updateProperty('invalid-id', updates, mockTenantId, mockUserId)
      ).rejects.toThrow('Property not found');
    });

    it('should handle update failure', async () => {
      mockRepository.updateProperty.mockResolvedValueOnce(null);

      await expect(
        propertyService.updateProperty(mockProperty.id, updates, mockTenantId, mockUserId)
      ).rejects.toThrow('Failed to update property');
    });

    it('should preserve existing values when partially updating', async () => {
      const partialUpdate: PropertyUpdate = { notes: 'Just updating notes' };
      
      await propertyService.updateProperty(mockProperty.id, partialUpdate, mockTenantId, mockUserId);

      expect(mockRepository.updateProperty).toHaveBeenCalledWith(
        mockProperty.id,
        partialUpdate,
        mockTenantId
      );
    });
  });

  describe('findPropertiesByVoice', () => {
    const voiceCommand: PropertyVoiceCommand = {
      type: 'find_property',
      query: 'property near the park',
    };

    const mockSearchResults: PropertySearchResult[] = [
      {
        property: mockProperty,
        matchType: 'fuzzy',
        confidence: 0.8,
        matchedField: 'landmarks',
      },
    ];

    it('should delegate to search service for voice commands', async () => {
      mockSearchService.searchByVoiceCommand.mockResolvedValueOnce(mockSearchResults);

      const results = await propertyService.findPropertiesByVoice(
        voiceCommand,
        mockTenantId,
        mockUserId
      );

      expect(results).toEqual(mockSearchResults);
      expect(mockSearchService.searchByVoiceCommand).toHaveBeenCalledWith(voiceCommand, mockTenantId);
    });

    it('should throw error when voice search is disabled', async () => {
      const serviceWithoutVoice = new PropertyService(mockSupabaseClient, mockEventBus, {
        enableVoiceSearch: false,
      });

      await expect(
        serviceWithoutVoice.findPropertiesByVoice(voiceCommand, mockTenantId, mockUserId)
      ).rejects.toThrow('Voice search is not enabled');
    });

    it('should handle search service errors', async () => {
      const searchError = new Error('Search service unavailable');
      mockSearchService.searchByVoiceCommand.mockRejectedValueOnce(searchError);

      await expect(
        propertyService.findPropertiesByVoice(voiceCommand, mockTenantId, mockUserId)
      ).rejects.toMatchObject({
        message: 'Failed to search properties by voice',
        originalError: searchError,
      });
    });
  });

  describe('updateAccessInstructions', () => {
    const instructions = {
      gateCode: '1234',
      accessInstructions: 'Use side gate',
      petWarnings: 'Beware of dog',
      voiceNotes: ['Dog is friendly but loud'],
    };

    it('should update property access instructions', async () => {
      const updatedProperty = {
        ...mockProperty,
        notes: instructions.accessInstructions,
      };
      mockRepository.updateProperty.mockResolvedValueOnce(updatedProperty);

      const result = await propertyService.updateAccessInstructions(
        mockProperty.id,
        instructions,
        mockTenantId,
        mockUserId
      );

      expect(result).toEqual(updatedProperty);
      expect(mockRepository.updateProperty).toHaveBeenCalledWith(
        mockProperty.id,
        expect.objectContaining({
          notes: instructions.accessInstructions,
        }),
        mockTenantId
      );
    });

    it('should publish access updated event', async () => {
      await propertyService.updateAccessInstructions(
        mockProperty.id,
        instructions,
        mockTenantId,
        mockUserId
      );

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PropertyEventType.PROPERTY_ACCESS_UPDATED,
          payload: expect.objectContaining({
            instructions,
            voiceUpdate: true,
          }),
        })
      );
    });

    it('should handle property not found', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(
        propertyService.updateAccessInstructions('invalid-id', instructions, mockTenantId, mockUserId)
      ).rejects.toThrow('Property not found');
    });

    it('should preserve existing notes if not provided', async () => {
      const partialInstructions = { gateCode: '5678' };
      
      await propertyService.updateAccessInstructions(
        mockProperty.id,
        partialInstructions,
        mockTenantId,
        mockUserId
      );

      expect(mockRepository.updateProperty).toHaveBeenCalledWith(
        mockProperty.id,
        expect.objectContaining({
          notes: mockProperty.notes,
        }),
        mockTenantId
      );
    });
  });

  describe('transitionState', () => {
    it('should transition property state', async () => {
      const newState = PropertyState.INACTIVE;
      const reason = 'Customer requested deactivation';
      const transitionedProperty = { ...mockProperty, state: newState };
      
      mockRepository.updatePropertyState.mockResolvedValueOnce(transitionedProperty);

      const result = await propertyService.transitionState(
        mockProperty.id,
        newState,
        reason,
        mockTenantId,
        mockUserId
      );

      expect(result).toEqual(transitionedProperty);
      expect(mockRepository.updatePropertyState).toHaveBeenCalledWith(
        mockProperty.id,
        newState,
        mockTenantId
      );
    });

    it('should handle property not found during transition', async () => {
      mockRepository.updatePropertyState.mockResolvedValueOnce(null);

      await expect(
        propertyService.transitionState(
          'invalid-id',
          PropertyState.INACTIVE,
          'test',
          mockTenantId,
          mockUserId
        )
      ).rejects.toThrow('Property not found');
    });
  });

  describe('deleteProperty', () => {
    it('should soft delete property by setting it inactive', async () => {
      const inactiveProperty = { ...mockProperty, state: PropertyState.INACTIVE };
      mockRepository.updatePropertyState.mockResolvedValueOnce(inactiveProperty);

      await propertyService.deleteProperty(mockProperty.id, mockTenantId, mockUserId);

      expect(mockRepository.updatePropertyState).toHaveBeenCalledWith(
        mockProperty.id,
        PropertyState.INACTIVE,
        mockTenantId
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PropertyEventType.PROPERTY_DELETED,
        })
      );
    });

    it('should handle errors during deletion', async () => {
      const error = new Error('Delete failed');
      mockRepository.updatePropertyState.mockRejectedValueOnce(error);

      await expect(
        propertyService.deleteProperty(mockProperty.id, mockTenantId, mockUserId)
      ).rejects.toMatchObject({
        message: 'Failed to transition property state',
      });
    });
  });

  describe('getCustomerProperties', () => {
    const customerProperties = [mockProperty, { ...mockProperty, id: 'prop-124' }];

    it('should retrieve all properties for a customer', async () => {
      mockRepository.findPropertiesByCustomer.mockResolvedValueOnce(customerProperties);

      const results = await propertyService.getCustomerProperties('cust-123', mockTenantId);

      expect(results).toEqual(customerProperties);
      expect(mockRepository.findPropertiesByCustomer).toHaveBeenCalledWith('cust-123', mockTenantId);
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database error');
      mockRepository.findPropertiesByCustomer.mockRejectedValueOnce(error);

      await expect(
        propertyService.getCustomerProperties('cust-123', mockTenantId)
      ).rejects.toMatchObject({
        message: 'Failed to fetch customer properties',
        originalError: error,
      });
    });
  });

  describe('getProperty', () => {
    it('should retrieve a property by ID', async () => {
      const result = await propertyService.getProperty(mockProperty.id, mockTenantId);

      expect(result).toEqual(mockProperty);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockProperty.id, mockTenantId);
    });

    it('should return null for non-existent property', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      const result = await propertyService.getProperty('invalid-id', mockTenantId);

      expect(result).toBeNull();
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database error');
      mockRepository.findById.mockRejectedValueOnce(error);

      await expect(
        propertyService.getProperty(mockProperty.id, mockTenantId)
      ).rejects.toMatchObject({
        message: 'Failed to fetch property',
        originalError: error,
      });
    });
  });

  describe('findNearbyProperties', () => {
    const location = { latitude: 39.7817, longitude: -89.6501 };
    const radiusMeters = 5000;
    const nearbyProperties = [
      { ...mockProperty, distance: 1000 },
      { ...mockProperty, id: 'prop-124', distance: 2500 },
    ];

    it('should find properties within radius', async () => {
      mockRepository.findPropertiesNearby.mockResolvedValueOnce(nearbyProperties);

      const results = await propertyService.findNearbyProperties(
        location,
        radiusMeters,
        mockTenantId
      );

      expect(results).toEqual(nearbyProperties);
      expect(mockRepository.findPropertiesNearby).toHaveBeenCalledWith(
        location,
        radiusMeters,
        mockTenantId,
        20 // default limit
      );
    });

    it('should accept custom limit', async () => {
      mockRepository.findPropertiesNearby.mockResolvedValueOnce([]);

      await propertyService.findNearbyProperties(location, radiusMeters, mockTenantId, 50);

      expect(mockRepository.findPropertiesNearby).toHaveBeenCalledWith(
        location,
        radiusMeters,
        mockTenantId,
        50
      );
    });

    it('should handle search errors', async () => {
      const error = new Error('Geospatial query failed');
      mockRepository.findPropertiesNearby.mockRejectedValueOnce(error);

      await expect(
        propertyService.findNearbyProperties(location, radiusMeters, mockTenantId)
      ).rejects.toMatchObject({
        message: 'Failed to search nearby properties',
        originalError: error,
      });
    });
  });

  describe('factory function', () => {
    it('should create service instance using factory', () => {
      const service = createPropertyService(mockSupabaseClient, mockEventBus, {
        maxPropertiesPerCustomer: 50,
      });

      expect(service).toBeInstanceOf(PropertyService);
    });
  });

  describe('state transition validation', () => {
    const testCases = [
      {
        from: PropertyState.DRAFT,
        to: PropertyState.ACTIVE,
        valid: true,
      },
      {
        from: PropertyState.DRAFT,
        to: PropertyState.INACTIVE,
        valid: false,
      },
      {
        from: PropertyState.ACTIVE,
        to: PropertyState.INACTIVE,
        valid: true,
      },
      {
        from: PropertyState.ACTIVE,
        to: PropertyState.SCHEDULED,
        valid: true,
      },
      {
        from: PropertyState.INACTIVE,
        to: PropertyState.ACTIVE,
        valid: true,
      },
      {
        from: PropertyState.INACTIVE,
        to: PropertyState.SCHEDULED,
        valid: false,
      },
      {
        from: PropertyState.SCHEDULED,
        to: PropertyState.ACTIVE,
        valid: true,
      },
      {
        from: PropertyState.SCHEDULED,
        to: PropertyState.INACTIVE,
        valid: false,
      },
    ];

    test.each(testCases)(
      'should validate transition from $from to $to',
      async ({ from, to, valid }) => {
        const currentProperty = { ...mockProperty, state: from };
        mockRepository.findById.mockResolvedValue(currentProperty);
        
        if (valid) {
          mockRepository.updateProperty.mockResolvedValue({ ...currentProperty, state: to });
          
          await expect(
            propertyService.updateProperty(mockProperty.id, { state: to }, mockTenantId, mockUserId)
          ).resolves.toBeDefined();
        } else {
          await expect(
            propertyService.updateProperty(mockProperty.id, { state: to }, mockTenantId, mockUserId)
          ).rejects.toThrow(`Cannot transition from ${from} to ${to}`);
        }
      }
    );
  });
});