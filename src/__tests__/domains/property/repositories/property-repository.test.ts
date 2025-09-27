import { PropertyRepository, createPropertyRepository } from '@/domains/property/repositories/property-repository';
import { BaseRepository } from '@/lib/repositories/base.repository';
import {
  Property,
  PropertyCreate,
  PropertyUpdate,
  PropertyType,
  PropertyState,
  Address,
  GeoLocation,
} from '@/domains/property/types/property-types';
import { createAppError } from '@/core/errors/error-types';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock the base repository
jest.mock('@/lib/repositories/base.repository');

describe('PropertyRepository', () => {
  let repository: PropertyRepository;
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;
  
  const mockTenantId = 'tenant-123';
  const mockPropertyId = 'prop-123';

  const mockAddress: Address = {
    street: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    country: 'US',
  };

  const mockPropertyData = {
    id: mockPropertyId,
    tenant_id: mockTenantId,
    customer_id: 'cust-123',
    property_number: 'PROP-001',
    name: 'Test Property',
    address: mockAddress,
    property_type: PropertyType.RESIDENTIAL,
    size_sqft: 2000,
    lot_size_acres: 0.25,
    access_notes: 'Use side gate',
    voice_navigation_notes: 'Near the park',
    is_active: true,
    metadata: {
      yearBuilt: 1995,
      stories: 2,
      tags: ['corner-lot'],
      serviceFrequency: 'monthly',
      state: PropertyState.ACTIVE,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockPropertyData, error: null }),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    } as any;

    repository = new PropertyRepository(mockSupabaseClient);
  });

  describe('createProperty', () => {
    const validPropertyCreate: PropertyCreate = {
      customerId: 'cust-123',
      address: mockAddress,
      type: PropertyType.RESIDENTIAL,
      size: 2000,
      lotSize: 10890, // 0.25 acres in sqft
      yearBuilt: 1995,
      stories: 2,
      notes: 'Use side gate',
      tags: ['corner-lot'],
      serviceFrequency: 'monthly',
      voiceMetadata: {
        nickname: 'The Smith House',
        landmarks: ['near the park'],
      },
    };

    it('should create a property with valid data', async () => {
      const result = await repository.createProperty(validPropertyCreate, mockTenantId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPropertyId);
      expect(result.property_number).toBe('PROP-001');
      expect(result.name).toBe('Test Property');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('properties');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: mockTenantId,
          customer_id: validPropertyCreate.customerId,
          property_type: validPropertyCreate.type,
          size_sqft: validPropertyCreate.size,
          lot_size_acres: 0.25,
        })
      );
    });

    it('should generate unique property number', async () => {
      await repository.createProperty(validPropertyCreate, mockTenantId);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          property_number: expect.stringMatching(/^PROP-[A-Z0-9]+-[A-Z0-9]+$/),
        })
      );
    });

    it('should format address for JSONB storage', async () => {
      await repository.createProperty(validPropertyCreate, mockTenantId);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          address: expect.objectContaining({
            street: mockAddress.street,
            city: mockAddress.city,
            state: mockAddress.state.toUpperCase(),
            zip: mockAddress.zip,
            country: 'US',
            formatted: expect.stringContaining('123 Main St'),
            landmarks: validPropertyCreate.voiceMetadata?.landmarks,
          }),
        })
      );
    });

    it('should use property nickname as name if provided', async () => {
      await repository.createProperty(validPropertyCreate, mockTenantId);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'The Smith House',
        })
      );
    });

    it('should use formatted address as name if no nickname', async () => {
      const createWithoutNickname = {
        ...validPropertyCreate,
        voiceMetadata: undefined,
      };

      await repository.createProperty(createWithoutNickname, mockTenantId);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '123 Main St, Springfield',
        })
      );
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: dbError });

      await expect(
        repository.createProperty(validPropertyCreate, mockTenantId)
      ).rejects.toMatchObject({
        code: 'PROPERTY_CREATE_FAILED',
        originalError: dbError,
      });
    });

    it('should validate input with zod schema', async () => {
      const invalidCreate = {
        customerId: 'not-a-uuid',
        address: {
          street: '',
          city: '',
          state: 'INVALID',
          zip: 'bad-zip',
        },
        type: 'INVALID_TYPE',
      } as any;

      await expect(
        repository.createProperty(invalidCreate, mockTenantId)
      ).rejects.toThrow();
    });
  });

  describe('updateProperty', () => {
    const validUpdate: PropertyUpdate = {
      notes: 'Updated access notes',
      size: 2500,
      tags: ['corner-lot', 'renovated'],
      state: PropertyState.INACTIVE,
    };

    it('should update property with valid data', async () => {
      // Mock getting current metadata
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { metadata: mockPropertyData.metadata }, error: null })
        .mockResolvedValueOnce({ data: mockPropertyData, error: null });

      const result = await repository.updateProperty(mockPropertyId, validUpdate, mockTenantId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockPropertyId);

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          access_notes: validUpdate.notes,
          size_sqft: validUpdate.size,
          metadata: expect.objectContaining({
            tags: validUpdate.tags,
            state: validUpdate.state,
          }),
          updated_at: expect.any(String),
        })
      );
    });

    it('should preserve existing metadata when updating', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ 
          data: { 
            metadata: {
              yearBuilt: 1990,
              stories: 1,
              customField: 'preserved',
            },
          }, 
          error: null,
        })
        .mockResolvedValueOnce({ data: mockPropertyData, error: null });

      await repository.updateProperty(
        mockPropertyId,
        { tags: ['new-tag'] },
        mockTenantId
      );

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            yearBuilt: 1990,
            stories: 1,
            customField: 'preserved',
            tags: ['new-tag'],
          }),
        })
      );
    });

    it('should return null if property not found', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { metadata: {} }, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const result = await repository.updateProperty('invalid-id', validUpdate, mockTenantId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Update failed');
      mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: dbError });

      await expect(
        repository.updateProperty(mockPropertyId, validUpdate, mockTenantId)
      ).rejects.toMatchObject({
        code: 'PROPERTY_UPDATE_FAILED',
        originalError: dbError,
      });
    });
  });

  describe('findPropertiesByCustomer', () => {
    it('should find all active properties for a customer', async () => {
      const mockProperties = [mockPropertyData, { ...mockPropertyData, id: 'prop-124' }];
      mockSupabaseClient.order.mockReturnValueOnce({
        then: (cb: any) => cb({ data: mockProperties, error: null }),
      } as any);

      const results = await repository.findPropertiesByCustomer('cust-123', mockTenantId);

      expect(results).toHaveLength(2);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('properties');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('customer_id', 'cust-123');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should include customer relation data', async () => {
      await repository.findPropertiesByCustomer('cust-123', mockTenantId);

      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        expect.stringContaining('customer:customers!inner')
      );
    });

    it('should handle empty results', async () => {
      mockSupabaseClient.order.mockReturnValueOnce({
        then: (cb: any) => cb({ data: [], error: null }),
      } as any);

      const results = await repository.findPropertiesByCustomer('cust-123', mockTenantId);

      expect(results).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Query failed');
      mockSupabaseClient.order.mockReturnValueOnce({
        then: (cb: any) => cb({ data: null, error: dbError }),
      } as any);

      await expect(
        repository.findPropertiesByCustomer('cust-123', mockTenantId)
      ).rejects.toMatchObject({
        code: 'PROPERTIES_FETCH_FAILED',
        originalError: dbError,
      });
    });
  });

  describe('findPropertiesNearby', () => {
    const location = { latitude: 39.7817, longitude: -89.6501 };
    const radiusMeters = 5000;

    it('should use PostGIS RPC for spatial query', async () => {
      const mockNearbyData = [
        { ...mockPropertyData, distance_meters: 1000 },
        { ...mockPropertyData, id: 'prop-124', distance_meters: 2500 },
      ];
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: mockNearbyData, error: null });

      const results = await repository.findPropertiesNearby(location, radiusMeters, mockTenantId);

      expect(results).toHaveLength(2);
      expect(results[0].distance).toBe(1000);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('find_properties_nearby', {
        p_tenant_id: mockTenantId,
        p_longitude: location.longitude,
        p_latitude: location.latitude,
        p_radius_meters: radiusMeters,
        p_limit: 20,
      });
    });

    it('should fall back to non-spatial query if PostGIS fails', async () => {
      // First RPC fails
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: null, error: new Error('PostGIS error') });
      
      // Fallback query succeeds
      mockSupabaseClient.limit.mockReturnValueOnce({
        then: (cb: any) => cb({ 
          data: [
            { ...mockPropertyData, location: 'POINT(-89.6501 39.7817)' },
          ], 
          error: null,
        }),
      } as any);

      const results = await repository.findPropertiesNearby(location, radiusMeters, mockTenantId);

      expect(results).toHaveLength(1);
      expect(results[0].distance).toBeCloseTo(0, 1); // Same location
    });

    it('should calculate distances manually in fallback', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: null, error: new Error('PostGIS error') });
      
      const differentLocation = 'POINT(-90.0 40.0)'; // Different coordinates
      mockSupabaseClient.limit.mockReturnValueOnce({
        then: (cb: any) => cb({ 
          data: [{ ...mockPropertyData, location: differentLocation }], 
          error: null,
        }),
      } as any);

      const results = await repository.findPropertiesNearby(location, radiusMeters, mockTenantId);

      expect(results[0].distance).toBeGreaterThan(0);
    });

    it('should handle properties without location', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: null, error: new Error('PostGIS error') });
      
      mockSupabaseClient.limit.mockReturnValueOnce({
        then: (cb: any) => cb({ 
          data: [{ ...mockPropertyData, location: null }], 
          error: null,
        }),
      } as any);

      const results = await repository.findPropertiesNearby(location, radiusMeters, mockTenantId);

      expect(results[0].distance).toBe(Infinity);
    });
  });

  describe('findPropertyByAddress', () => {
    const searchAddress: Partial<Address> = {
      street: '123 Main',
      city: 'Springfield',
    };

    it('should find property by partial address', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({ data: mockPropertyData, error: null });

      const result = await repository.findPropertyByAddress(searchAddress, mockTenantId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockPropertyId);
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('address->>street', '%123 Main%');
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('address->>city', '%Springfield%');
    });

    it('should handle exact state matching', async () => {
      await repository.findPropertyByAddress({ state: 'IL' }, mockTenantId);

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('address->>state', 'IL');
    });

    it('should handle exact zip matching', async () => {
      await repository.findPropertyByAddress({ zip: '62701' }, mockTenantId);

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('address->>zip', '62701');
    });

    it('should return null if not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const result = await repository.findPropertyByAddress(searchAddress, mockTenantId);

      expect(result).toBeNull();
    });
  });

  describe('findPropertyWithVoiceProfile', () => {
    it('should include voice profile relation', async () => {
      const mockWithVoice = {
        ...mockPropertyData,
        voice_profile: {
          propertyId: mockPropertyId,
          nickname: 'The Smith House',
          landmarks: ['near park'],
          voiceSearchHits: 5,
        },
      };
      mockSupabaseClient.single.mockResolvedValueOnce({ data: mockWithVoice, error: null });

      const result = await repository.findPropertyWithVoiceProfile(mockPropertyId, mockTenantId);

      expect(result?.voiceProfile).toBeDefined();
      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        expect.stringContaining('voice_profile:property_voice_profiles')
      );
    });
  });

  describe('updatePropertyState', () => {
    it('should update property state and is_active flag', async () => {
      // Mock for fetching current metadata
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { metadata: {} }, error: null })
        .mockResolvedValueOnce({ data: mockPropertyData, error: null });

      const result = await repository.updatePropertyState(
        mockPropertyId,
        PropertyState.INACTIVE,
        mockTenantId
      );

      expect(result).toBeDefined();
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            state: PropertyState.INACTIVE,
          }),
          is_active: false,
          updated_at: expect.any(String),
        })
      );
    });

    it('should set is_active true for ACTIVE state', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { metadata: {} }, error: null })
        .mockResolvedValueOnce({ data: mockPropertyData, error: null });

      await repository.updatePropertyState(
        mockPropertyId,
        PropertyState.ACTIVE,
        mockTenantId
      );

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: true,
        })
      );
    });
  });

  describe('findById', () => {
    it('should find property by ID with tenant isolation', async () => {
      const result = await repository.findById(mockPropertyId, mockTenantId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockPropertyId);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockPropertyId);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
    });
  });

  describe('findAll', () => {
    it('should find all properties with filters', async () => {
      const mockProperties = [mockPropertyData, { ...mockPropertyData, id: 'prop-124' }];
      mockSupabaseClient.limit.mockReturnValueOnce({
        then: (cb: any) => cb({ data: mockProperties, error: null, count: 2 }),
      } as any);

      const result = await repository.findAll({
        tenantId: mockTenantId,
        filters: { is_active: true },
        limit: 50,
      });

      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('delete', () => {
    it('should delete property with tenant isolation', async () => {
      mockSupabaseClient.eq.mockReturnValueOnce({
        then: (cb: any) => cb({ error: null }),
      } as any);

      const result = await repository.delete(mockPropertyId, mockTenantId);

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('properties');
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockPropertyId);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
    });
  });

  describe('helper methods', () => {
    it('should parse PostGIS POINT format correctly', async () => {
      const mockWithLocation = {
        ...mockPropertyData,
        location: 'POINT(-89.6501 39.7817)',
      };
      mockSupabaseClient.single.mockResolvedValueOnce({ data: mockWithLocation, error: null });

      const result = await repository.findById(mockPropertyId, mockTenantId);

      expect(result?.location).toMatchObject({
        longitude: -89.6501,
        latitude: 39.7817,
        source: 'geocoding',
      });
    });

    it('should handle GeoJSON format', async () => {
      const mockWithGeoJSON = {
        ...mockPropertyData,
        location: {
          type: 'Point',
          coordinates: [-89.6501, 39.7817],
        },
      };
      mockSupabaseClient.single.mockResolvedValueOnce({ data: mockWithGeoJSON, error: null });

      const result = await repository.findById(mockPropertyId, mockTenantId);

      expect(result?.location).toMatchObject({
        longitude: -89.6501,
        latitude: 39.7817,
      });
    });

    it('should map database fields to Property type correctly', async () => {
      const result = await repository.findById(mockPropertyId, mockTenantId);

      expect(result).toMatchObject({
        id: mockPropertyId,
        tenant_id: mockTenantId,
        customerId: mockPropertyData.customer_id,
        property_number: mockPropertyData.property_number,
        name: mockPropertyData.name,
        address: mockAddress,
        type: PropertyType.RESIDENTIAL,
        size: mockPropertyData.size_sqft,
        lotSize: 10890, // Convert acres back to sqft
        state: PropertyState.ACTIVE,
        is_active: true,
        notes: mockPropertyData.access_notes,
        tags: mockPropertyData.metadata.tags,
      });
    });
  });

  describe('factory function', () => {
    it('should create repository instance', () => {
      const repo = createPropertyRepository(mockSupabaseClient);
      expect(repo).toBeInstanceOf(PropertyRepository);
    });
  });
});