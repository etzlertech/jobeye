import { PropertySearchService, createPropertySearchService } from '@/domains/property/services/property-search-service';
import { PropertyRepository } from '@/domains/property/repositories/property-repository';
import { VoiceLogger } from '@/core/logger/voice-logger';
import {
  Property,
  PropertyType,
  PropertyState,
  Address,
  GeoLocation,
  PropertySearchResult,
  PropertyVoiceCommand,
} from '@/domains/property/types/property-types';
import { SupabaseClient } from '@supabase/supabase-js';
import Fuse from 'fuse.js';

// Mock dependencies
jest.mock('@/domains/property/repositories/property-repository');
jest.mock('@/core/logger/voice-logger');
jest.mock('fuse.js');

describe('PropertySearchService', () => {
  let searchService: PropertySearchService;
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;
  let mockRepository: jest.Mocked<PropertyRepository>;
  let mockLogger: jest.Mocked<VoiceLogger>;
  
  const mockTenantId = 'tenant-123';

  const createMockProperty = (overrides: Partial<Property> = {}): Property => ({
    id: 'prop-123',
    tenant_id: mockTenantId,
    customerId: 'cust-123',
    property_number: 'PROP-001',
    name: 'Test Property',
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      country: 'US',
      landmarks: ['near the park', 'across from school'],
    },
    type: PropertyType.RESIDENTIAL,
    state: PropertyState.ACTIVE,
    is_active: true,
    notes: 'Gate code 1234. Large dog on property.',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockProperties = [
    createMockProperty(),
    createMockProperty({
      id: 'prop-124',
      property_number: 'PROP-002',
      name: 'Oak Street Property',
      address: {
        street: '456 Oak St',
        city: 'Springfield',
        state: 'IL',
        zip: '62702',
        landmarks: ['near water tower'],
      },
    }),
    createMockProperty({
      id: 'prop-125',
      property_number: 'PROP-003',
      name: 'Downtown Office',
      address: {
        street: '789 Business Ave',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        landmarks: ['downtown', 'near train station'],
      },
      type: PropertyType.COMMERCIAL,
    }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseClient = {} as jest.Mocked<SupabaseClient>;

    mockRepository = {
      findPropertyByAddress: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue({ data: mockProperties, count: mockProperties.length }),
      findPropertiesByCustomer: jest.fn().mockResolvedValue([]),
      findPropertiesNearby: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PropertyRepository>;

    mockLogger = {
      logVoiceCommand: jest.fn().mockResolvedValue(undefined),
      logError: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<VoiceLogger>;

    // Mock Fuse.js
    const mockFuseSearch = jest.fn().mockReturnValue([
      { item: mockProperties[0], score: 0.1 },
      { item: mockProperties[1], score: 0.3 },
    ]);
    (Fuse as jest.MockedClass<typeof Fuse>).mockImplementation(() => ({
      search: mockFuseSearch,
    } as any));

    (PropertyRepository as jest.MockedClass<typeof PropertyRepository>).mockImplementation(() => mockRepository);
    (VoiceLogger as jest.MockedClass<typeof VoiceLogger>).mockImplementation(() => mockLogger);

    searchService = new PropertySearchService(mockSupabaseClient, mockLogger);
  });

  describe('searchByVoiceCommand', () => {
    it('should search by address when address is provided', async () => {
      const command: PropertyVoiceCommand = {
        type: 'find_property',
        address: { street: '123 Main', city: 'Springfield' },
      };

      const expectedResult: PropertySearchResult[] = [{
        property: mockProperties[0],
        matchType: 'exact',
        confidence: 1.0,
        matchedField: 'address',
      }];

      // Mock exact match
      mockRepository.findPropertyByAddress.mockResolvedValueOnce(mockProperties[0]);

      const results = await searchService.searchByVoiceCommand(command, mockTenantId);

      expect(results).toEqual(expectedResult);
      expect(mockLogger.logVoiceCommand).toHaveBeenCalledWith({
        command: command.type,
        query: command.query,
        customerId: command.customerId,
      });
    });

    it('should search by customer when customerId is provided', async () => {
      const command: PropertyVoiceCommand = {
        type: 'find_property',
        customerId: 'cust-123',
      };

      mockRepository.findPropertiesByCustomer.mockResolvedValueOnce([mockProperties[0]]);

      const results = await searchService.searchByVoiceCommand(command, mockTenantId);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        property: mockProperties[0],
        matchType: 'exact',
        confidence: 1.0,
        matchedField: 'customerId',
      });
    });

    it('should search by landmark when query contains landmark keywords', async () => {
      const command: PropertyVoiceCommand = {
        type: 'find_property',
        query: 'property near the water tower',
      };

      const results = await searchService.searchByVoiceCommand(command, mockTenantId);

      // Should find the Oak Street property with water tower landmark
      expect(results.find(r => r.property.id === 'prop-124')).toBeDefined();
      expect(results[0].matchType).toBe('landmark');
    });

    it('should fall back to fuzzy search for general queries', async () => {
      const command: PropertyVoiceCommand = {
        type: 'find_property',
        query: 'Springfield property',
      };

      const results = await searchService.searchByVoiceCommand(command, mockTenantId);

      expect(results).toHaveLength(2); // Mocked Fuse returns 2 results
      expect(results[0].matchType).toBe('fuzzy');
    });

    it('should log errors and rethrow them', async () => {
      const command: PropertyVoiceCommand = {
        type: 'find_property',
        query: 'test',
      };

      const error = new Error('Search failed');
      mockRepository.findAll.mockRejectedValueOnce(error);

      await expect(searchService.searchByVoiceCommand(command, mockTenantId)).rejects.toThrow();
      expect(mockLogger.logError).toHaveBeenCalledWith(error, {
        operation: 'voice-search',
        command: command.type,
      });
    });
  });

  describe('searchByAddress', () => {
    const partialAddress: Partial<Address> = {
      street: '123 Main',
      city: 'Springfield',
    };

    it('should return exact match when found', async () => {
      mockRepository.findPropertyByAddress.mockResolvedValueOnce(mockProperties[0]);

      const results = await searchService.searchByAddress(partialAddress, mockTenantId);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        property: mockProperties[0],
        matchType: 'exact',
        confidence: 1.0,
        matchedField: 'address',
      });
      expect(mockRepository.findPropertyByAddress).toHaveBeenCalledWith(partialAddress, mockTenantId);
    });

    it('should fall back to fuzzy search when no exact match', async () => {
      mockRepository.findPropertyByAddress.mockResolvedValueOnce(null);

      const results = await searchService.searchByAddress(partialAddress, mockTenantId);

      expect(results).toHaveLength(2);
      expect(results[0].matchType).toBe('fuzzy');
      expect(results[0].highlightedText).toBeDefined();
    });

    it('should use cache for repeated searches', async () => {
      mockRepository.findPropertyByAddress.mockResolvedValueOnce(mockProperties[0]);

      // First search
      await searchService.searchByAddress(partialAddress, mockTenantId);
      
      // Second search - should use cache
      await searchService.searchByAddress(partialAddress, mockTenantId);

      expect(mockRepository.findPropertyByAddress).toHaveBeenCalledTimes(1);
    });

    it('should respect fuzzy threshold configuration', async () => {
      mockRepository.findPropertyByAddress.mockResolvedValueOnce(null);

      await searchService.searchByAddress(partialAddress, mockTenantId, {
        fuzzyThreshold: 0.8,
      });

      expect(Fuse).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threshold: 0.8,
        })
      );
    });

    it('should include inactive properties when specified', async () => {
      await searchService.searchByAddress(partialAddress, mockTenantId, {
        includeInactive: true,
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        tenantId: mockTenantId,
        filters: { is_active: false },
      });
    });

    it('should limit results based on configuration', async () => {
      mockRepository.findPropertyByAddress.mockResolvedValueOnce(null);

      const results = await searchService.searchByAddress(partialAddress, mockTenantId, {
        maxResults: 1,
      });

      expect(results).toHaveLength(1);
    });
  });

  describe('searchNearby', () => {
    const location = { latitude: 39.7817, longitude: -89.6501 };
    const radiusMeters = 5000;

    it('should find properties near location', async () => {
      const nearbyProperties = [
        { ...mockProperties[0], distance: 1000 },
        { ...mockProperties[1], distance: 3000 },
      ];
      mockRepository.findPropertiesNearby.mockResolvedValueOnce(nearbyProperties);

      const results = await searchService.searchNearby(location, radiusMeters, mockTenantId);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        property: nearbyProperties[0],
        matchType: 'nearby',
        confidence: 0.8, // 1 - (1000/5000)
        distance: 1000,
      });
      expect(mockRepository.findPropertiesNearby).toHaveBeenCalledWith(
        location,
        radiusMeters,
        mockTenantId,
        undefined
      );
    });

    it('should calculate confidence based on distance', async () => {
      const nearbyProperties = [
        { ...mockProperties[0], distance: 0 },
        { ...mockProperties[1], distance: 2500 },
        { ...mockProperties[2], distance: 5000 },
      ];
      mockRepository.findPropertiesNearby.mockResolvedValueOnce(nearbyProperties);

      const results = await searchService.searchNearby(location, radiusMeters, mockTenantId);

      expect(results[0].confidence).toBe(1.0); // At location
      expect(results[1].confidence).toBe(0.5); // Half radius
      expect(results[2].confidence).toBe(0.0); // At edge
    });

    it('should pass max results to repository', async () => {
      await searchService.searchNearby(location, radiusMeters, mockTenantId, { maxResults: 5 });

      expect(mockRepository.findPropertiesNearby).toHaveBeenCalledWith(
        location,
        radiusMeters,
        mockTenantId,
        5
      );
    });
  });

  describe('searchByLandmark', () => {
    it('should find properties with matching landmarks', async () => {
      const results = await searchService.searchByLandmark('water tower', mockTenantId);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        property: mockProperties[1], // Oak Street has water tower
        matchType: 'landmark',
        confidence: 0.9,
        matchedField: 'landmarks',
      });
    });

    it('should search in voice navigation notes', async () => {
      const results = await searchService.searchByLandmark('dog', mockTenantId);

      expect(results).toHaveLength(1);
      expect(results[0].property.id).toBe('prop-123');
      expect(results[0].confidence).toBe(0.7);
    });

    it('should include voice context in results', async () => {
      const results = await searchService.searchByLandmark('park', mockTenantId);

      expect(results[0].voiceContext).toMatchObject({
        spokenQuery: 'park',
        interpretedQuery: 'park',
        landmarks: expect.arrayContaining(['near the park']),
      });
    });

    it('should sort results by confidence', async () => {
      // Create properties with different landmark matches
      const propertiesWithLandmarks = [
        createMockProperty({ 
          id: 'prop-200',
          notes: 'park nearby' // Lower confidence match
        }),
        createMockProperty({ 
          id: 'prop-201',
          address: { ...mockProperties[0].address, landmarks: ['park entrance'] } // Higher confidence
        }),
      ];

      mockRepository.findAll.mockResolvedValueOnce({
        data: propertiesWithLandmarks,
        count: propertiesWithLandmarks.length,
      });

      const results = await searchService.searchByLandmark('park', mockTenantId);

      expect(results[0].confidence).toBeGreaterThan(results[1].confidence);
    });
  });

  describe('searchByQuery', () => {
    it('should perform fuzzy search on query', async () => {
      const results = await searchService.searchByQuery('Main Street', mockTenantId);

      expect(results).toHaveLength(2);
      expect(results[0].matchType).toBe('fuzzy');
      expect(results[0].highlightedText).toContain('**Main**');
    });

    it('should determine matched field correctly', async () => {
      // Test will use the determineMatchedField logic
      const mockFuseResults = [
        { item: mockProperties[0], score: 0.1 }, // Main St property
        { item: mockProperties[2], score: 0.2 }, // Chicago property
      ];
      
      (Fuse as jest.MockedClass<typeof Fuse>).mockImplementation(() => ({
        search: jest.fn().mockReturnValue(mockFuseResults),
      } as any));

      const results = await searchService.searchByQuery('Chicago', mockTenantId);

      // Should match on city field for Chicago property
      const chicagoResult = results.find(r => r.property.id === 'prop-125');
      expect(chicagoResult?.matchedField).toBe('address.city');
    });

    it('should use cache for repeated queries', async () => {
      await searchService.searchByQuery('test query', mockTenantId);
      await searchService.searchByQuery('test query', mockTenantId);

      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should respect configuration options', async () => {
      await searchService.searchByQuery('test', mockTenantId, {
        maxResults: 5,
        includeInactive: true,
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        tenantId: mockTenantId,
        filters: { is_active: false },
      });
    });
  });

  describe('geocodeAddress', () => {
    const address: Address = {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      country: 'US',
    };

    it('should return cached geocoding result', async () => {
      // First call
      const result1 = await searchService.geocodeAddress(address);
      // Second call - should use cache
      const result2 = await searchService.geocodeAddress(address);

      expect(result1).toEqual(result2);
      expect(result1).toMatchObject({
        address,
        confidence: 0,
        source: 'cache',
      });
    });

    it('should handle geocoding with formatted address', async () => {
      const addressWithFormatted = {
        ...address,
        formatted: '123 Main St, Springfield, IL 62701',
      };

      const result = await searchService.geocodeAddress(addressWithFormatted);

      expect(result.address).toEqual(addressWithFormatted);
    });

    it('should handle errors gracefully', async () => {
      // Mock an error scenario
      const badAddress = { ...address, street: '' };
      
      await expect(searchService.geocodeAddress(badAddress)).resolves.toBeDefined();
    });
  });

  describe('reverseGeocode', () => {
    const location: GeoLocation = {
      latitude: 39.7817,
      longitude: -89.6501,
      source: 'gps',
      timestamp: new Date(),
    };

    it('should return placeholder address for location', async () => {
      const result = await searchService.reverseGeocode(location);

      expect(result).toMatchObject({
        address: {
          street: 'Unknown',
          city: 'Unknown',
          state: 'UN',
          zip: '00000',
        },
        location,
        confidence: 0,
        source: 'cache',
      });
    });
  });

  describe('cache management', () => {
    it('should clear all caches', async () => {
      // Populate caches
      await searchService.searchByQuery('test', mockTenantId);
      await searchService.geocodeAddress({
        street: 'Test St',
        city: 'Test City',
        state: 'TS',
        zip: '00000',
      });

      // Clear caches
      searchService.clearCache();

      // Verify caches are cleared by seeing if repository is called again
      await searchService.searchByQuery('test', mockTenantId);
      expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
    });

    it('should expire cached results after TTL', async () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      let currentTime = originalNow();
      Date.now = jest.fn(() => currentTime);

      try {
        // First search
        await searchService.searchByQuery('test', mockTenantId);
        
        // Advance time beyond TTL (5 minutes)
        currentTime += 6 * 60 * 1000;
        
        // Second search should not use cache
        await searchService.searchByQuery('test', mockTenantId);
        
        expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty property list', async () => {
      mockRepository.findAll.mockResolvedValueOnce({ data: [], count: 0 });

      const results = await searchService.searchByQuery('test', mockTenantId);

      expect(results).toHaveLength(0);
    });

    it('should handle properties without landmarks', async () => {
      const propertyNoLandmarks = createMockProperty({
        address: { ...mockProperties[0].address, landmarks: undefined },
        notes: undefined,
      });
      
      mockRepository.findAll.mockResolvedValueOnce({
        data: [propertyNoLandmarks],
        count: 1,
      });

      const results = await searchService.searchByLandmark('landmark', mockTenantId);

      expect(results).toHaveLength(0);
    });

    it('should handle malformed voice commands', async () => {
      const command: PropertyVoiceCommand = {
        type: 'find_property',
        // No query, address, or customerId
      };

      const results = await searchService.searchByVoiceCommand(command, mockTenantId);

      expect(results).toBeDefined();
    });

    it('should highlight matches with special characters', async () => {
      mockRepository.findPropertyByAddress.mockResolvedValueOnce(null);

      // Create a property with special characters
      const specialProperty = createMockProperty({
        address: {
          ...mockProperties[0].address,
          street: '123 Main St. (Suite A)',
        },
      });

      mockRepository.findAll.mockResolvedValueOnce({
        data: [specialProperty],
        count: 1,
      });

      const results = await searchService.searchByAddress(
        { street: 'Main' },
        mockTenantId
      );

      expect(results[0].highlightedText).toContain('**Main**');
    });
  });

  describe('factory function', () => {
    it('should create service instance using factory', () => {
      const service = createPropertySearchService(mockSupabaseClient, mockLogger);

      expect(service).toBeInstanceOf(PropertySearchService);
    });

    it('should work without providing logger', () => {
      const service = createPropertySearchService(mockSupabaseClient);

      expect(service).toBeInstanceOf(PropertySearchService);
    });
  });
});