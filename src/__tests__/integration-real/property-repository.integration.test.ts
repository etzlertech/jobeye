/**
 * Property Repository Integration Tests
 * Tests property operations against real Supabase database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PropertyRepository } from '@/domains/property/repositories/property-repository';
import { CustomerRepository } from '@/lib/repositories/customer.repository';
import { 
  PropertyType, 
  PropertyState,
  PropertyCreate,
  PropertyUpdate,
  Address,
} from '@/domains/property/types/property-types';
import {
  serviceClient,
  cleanupTestData,
  createTestTenant,
  createTestCustomer,
  testData,
} from './test-setup';

describe('Property Repository Integration Tests (Real Database)', () => {
  let propertyRepo: PropertyRepository;
  let customerRepo: CustomerRepository;
  let testTenant1: any;
  let testTenant2: any;
  let testCustomer1: any;
  let testCustomer2: any;

  beforeAll(async () => {
    // Create repositories
    propertyRepo = new PropertyRepository(serviceClient);
    customerRepo = new CustomerRepository(serviceClient);

    // Create test tenants
    testTenant1 = await createTestTenant('Property Test Company 1');
    testTenant2 = await createTestTenant('Property Test Company 2');

    // Create test customers
    testCustomer1 = await createTestCustomer(testTenant1.id);
    testCustomer2 = await createTestCustomer(testTenant2.id);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('CRUD Operations', () => {
    it('should create a property with address and voice metadata', async () => {
      const propertyData: PropertyCreate = {
        customerId: testCustomer1.id,
        address: {
          street: '123 Main Street',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
          landmarks: ['Near the water tower', 'Across from City Hall'],
        },
        type: PropertyType.RESIDENTIAL,
        size: 2500,
        lotSize: 10000,
        yearBuilt: 2010,
        stories: 2,
        notes: 'Blue house with white trim',
        tags: ['corner-lot', 'gated'],
        serviceFrequency: 'monthly',
        voiceMetadata: {
          nickname: 'The Johnson House',
          landmarks: ['water tower', 'city hall'],
        },
      };

      const property = await propertyRepo.createProperty(propertyData, testTenant1.id);

      expect(property).toBeDefined();
      expect(property.id).toBeTruthy();
      expect(property.tenant_id).toBe(testTenant1.id);
      expect(property.customerId).toBe(testCustomer1.id);
      expect(property.address.street).toBe('123 Main Street');
      expect(property.address.landmarks).toContain('Near the water tower');
      expect(property.type).toBe(PropertyType.RESIDENTIAL);
      expect(property.state).toBe(PropertyState.ACTIVE);
      expect(property.is_active).toBe(true);

      // Track for cleanup
      testData.properties.add(property.id);
    });

    it('should update property information', async () => {
      // Create property first
      const property = await propertyRepo.createProperty({
        customerId: testCustomer1.id,
        address: {
          street: '456 Oak Avenue',
          city: 'Springfield',
          state: 'IL',
          zip: '62702',
        },
        type: PropertyType.COMMERCIAL,
      }, testTenant1.id);
      testData.properties.add(property.id);

      // Update property
      const updates: PropertyUpdate = {
        size: 5000,
        notes: 'Updated access code: 1234',
        tags: ['premium', 'corner-lot'],
        serviceFrequency: 'weekly',
      };

      const updated = await propertyRepo.updateProperty(
        property.id,
        updates,
        testTenant1.id
      );

      expect(updated).toBeDefined();
      expect(updated?.size).toBe(5000);
      expect(updated?.notes).toBe('Updated access code: 1234');
      expect(updated?.tags).toContain('premium');
    });

    it('should find properties by customer', async () => {
      // Create multiple properties for a customer
      const property1 = await propertyRepo.createProperty({
        customerId: testCustomer1.id,
        address: {
          street: '789 Pine Street',
          city: 'Springfield',
          state: 'IL',
          zip: '62703',
        },
        type: PropertyType.RESIDENTIAL,
      }, testTenant1.id);
      testData.properties.add(property1.id);

      const property2 = await propertyRepo.createProperty({
        customerId: testCustomer1.id,
        address: {
          street: '321 Elm Street',
          city: 'Springfield',
          state: 'IL',
          zip: '62704',
        },
        type: PropertyType.COMMERCIAL,
      }, testTenant1.id);
      testData.properties.add(property2.id);

      // Find properties
      const properties = await propertyRepo.findPropertiesByCustomer(
        testCustomer1.id,
        testTenant1.id
      );

      expect(properties.length).toBeGreaterThanOrEqual(2);
      expect(properties.some(p => p.address.street === '789 Pine Street')).toBe(true);
      expect(properties.some(p => p.address.street === '321 Elm Street')).toBe(true);
    });

    it('should update property state', async () => {
      const property = await propertyRepo.createProperty({
        customerId: testCustomer1.id,
        address: {
          street: '555 State Street',
          city: 'Springfield',
          state: 'IL',
          zip: '62705',
        },
        type: PropertyType.RESIDENTIAL,
      }, testTenant1.id);
      testData.properties.add(property.id);

      // Update state to inactive
      const updated = await propertyRepo.updatePropertyState(
        property.id,
        PropertyState.INACTIVE,
        testTenant1.id
      );

      expect(updated).toBeDefined();
      expect(updated?.state).toBe(PropertyState.INACTIVE);
      expect(updated?.is_active).toBe(false);
    });
  });

  describe('Address Search Operations', () => {
    beforeAll(async () => {
      // Create properties with various addresses for search
      const addresses = [
        { street: '100 Search Test Lane', city: 'Springfield', state: 'IL', zip: '62701' },
        { street: '200 Search Test Avenue', city: 'Chicago', state: 'IL', zip: '60601' },
        { street: '300 Search Test Road', city: 'Springfield', state: 'MO', zip: '65801' },
      ];

      for (const address of addresses) {
        const prop = await propertyRepo.createProperty({
          customerId: testCustomer1.id,
          address,
          type: PropertyType.RESIDENTIAL,
        }, testTenant1.id);
        testData.properties.add(prop.id);
      }
    });

    it('should find property by partial address', async () => {
      const property = await propertyRepo.findPropertyByAddress({
        street: 'Search Test Lane',
        city: 'Springfield',
      }, testTenant1.id);

      expect(property).toBeDefined();
      expect(property?.address.street).toBe('100 Search Test Lane');
      expect(property?.address.city).toBe('Springfield');
    });

    it('should find property by city and state', async () => {
      const property = await propertyRepo.findPropertyByAddress({
        city: 'Chicago',
        state: 'IL',
      }, testTenant1.id);

      expect(property).toBeDefined();
      expect(property?.address.city).toBe('Chicago');
    });

    it('should return null for non-existent address', async () => {
      const property = await propertyRepo.findPropertyByAddress({
        street: '999 Non-Existent Street',
        city: 'NowhereVille',
      }, testTenant1.id);

      expect(property).toBeNull();
    });
  });

  describe('Geospatial Operations', () => {
    it('should create property with geolocation', async () => {
      const propertyData: PropertyCreate = {
        customerId: testCustomer1.id,
        address: {
          street: '1600 Pennsylvania Avenue',
          city: 'Washington',
          state: 'DC',
          zip: '20500',
        },
        type: PropertyType.COMMERCIAL,
        location: {
          latitude: 38.8977,
          longitude: -77.0365,
          source: 'geocoding',
        },
      };

      const property = await propertyRepo.createProperty(propertyData, testTenant1.id);
      testData.properties.add(property.id);

      expect(property.location).toBeDefined();
      expect(property.location?.latitude).toBeCloseTo(38.8977, 4);
      expect(property.location?.longitude).toBeCloseTo(-77.0365, 4);
    });

    it('should find properties nearby a location', async () => {
      // Create properties with locations
      const properties = [
        {
          address: { street: '100 Nearby St', city: 'TestCity', state: 'TS', zip: '12345' },
          location: { latitude: 40.7128, longitude: -74.0060 }, // NYC
        },
        {
          address: { street: '200 Nearby Ave', city: 'TestCity', state: 'TS', zip: '12345' },
          location: { latitude: 40.7580, longitude: -73.9855 }, // Times Square
        },
        {
          address: { street: '300 Far Away Rd', city: 'TestCity', state: 'TS', zip: '12345' },
          location: { latitude: 34.0522, longitude: -118.2437 }, // LA
        },
      ];

      for (const propData of properties) {
        const prop = await propertyRepo.createProperty({
          customerId: testCustomer1.id,
          ...propData,
          type: PropertyType.RESIDENTIAL,
        }, testTenant1.id);
        testData.properties.add(prop.id);
      }

      // Search near NYC
      const nearbyProps = await propertyRepo.findPropertiesNearby(
        { latitude: 40.7128, longitude: -74.0060 },
        10000, // 10km radius
        testTenant1.id
      );

      // Should find at least the NYC properties
      expect(nearbyProps.length).toBeGreaterThanOrEqual(1);
      expect(nearbyProps[0].distance).toBeLessThan(10000);
      
      // LA property should not be in results or be last with large distance
      const laProperty = nearbyProps.find(p => p.address.street === '300 Far Away Rd');
      if (laProperty) {
        expect(laProperty.distance).toBeGreaterThan(1000000); // > 1000km
      }
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should not allow cross-tenant property access', async () => {
      // Create property in tenant1
      const property = await propertyRepo.createProperty({
        customerId: testCustomer1.id,
        address: {
          street: '999 Isolated Street',
          city: 'PrivateVille',
          state: 'IL',
          zip: '60000',
        },
        type: PropertyType.RESIDENTIAL,
      }, testTenant1.id);
      testData.properties.add(property.id);

      // Try to access from tenant2
      const found = await propertyRepo.findById(property.id, testTenant2.id);
      expect(found).toBeNull();

      // Try to update from tenant2
      const updated = await propertyRepo.updateProperty(
        property.id,
        { notes: 'Hacked!' },
        testTenant2.id
      );
      expect(updated).toBeNull();
    });

    it('should keep property data separate between tenants', async () => {
      // Create properties in both tenants
      const prop1 = await propertyRepo.createProperty({
        customerId: testCustomer1.id,
        address: {
          street: '111 Tenant One Street',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
        },
        type: PropertyType.RESIDENTIAL,
      }, testTenant1.id);
      testData.properties.add(prop1.id);

      const prop2 = await propertyRepo.createProperty({
        customerId: testCustomer2.id,
        address: {
          street: '222 Tenant Two Street',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
        },
        type: PropertyType.COMMERCIAL,
      }, testTenant2.id);
      testData.properties.add(prop2.id);

      // Each tenant should only see their own properties
      const tenant1Props = await propertyRepo.findAll({
        tenantId: testTenant1.id,
        filters: { is_active: true },
      });

      const tenant2Props = await propertyRepo.findAll({
        tenantId: testTenant2.id,
        filters: { is_active: true },
      });

      expect(tenant1Props.data.some(p => p.address.street === '111 Tenant One Street')).toBe(true);
      expect(tenant1Props.data.some(p => p.address.street === '222 Tenant Two Street')).toBe(false);

      expect(tenant2Props.data.some(p => p.address.street === '222 Tenant Two Street')).toBe(true);
      expect(tenant2Props.data.some(p => p.address.street === '111 Tenant One Street')).toBe(false);
    });
  });

  describe('Voice Metadata and Landmarks', () => {
    it('should store and retrieve voice-friendly property data', async () => {
      const propertyData: PropertyCreate = {
        customerId: testCustomer1.id,
        address: {
          street: '777 Voice Test Boulevard',
          city: 'AudioVille',
          state: 'IL',
          zip: '62777',
          landmarks: ['Next to the big oak tree', 'Behind the gas station'],
        },
        type: PropertyType.RESIDENTIAL,
        voiceMetadata: {
          nickname: 'The Red Brick House',
          landmarks: ['oak tree', 'gas station', 'blue mailbox'],
        },
        notes: 'Gate code is 4-3-2-1. Dog in backyard.',
      };

      const property = await propertyRepo.createProperty(propertyData, testTenant1.id);
      testData.properties.add(property.id);

      expect(property.address.landmarks).toHaveLength(2);
      expect(property.address.landmarks).toContain('Next to the big oak tree');
      expect(property.notes).toContain('Gate code is 4-3-2-1');
      
      // The name should be set to the nickname
      expect(property.name).toBe('The Red Brick House');
    });
  });

  describe('Error Handling', () => {
    it('should validate required fields', async () => {
      await expect(propertyRepo.createProperty({
        customerId: 'invalid-uuid',
        address: {
          street: '',
          city: '',
          state: 'X', // Too short
          zip: 'invalid',
        },
        type: PropertyType.RESIDENTIAL,
      }, testTenant1.id)).rejects.toThrow();
    });

    it('should handle duplicate property creation gracefully', async () => {
      const propertyData: PropertyCreate = {
        customerId: testCustomer1.id,
        address: {
          street: '888 Duplicate Test Lane',
          city: 'DupCity',
          state: 'IL',
          zip: '62888',
        },
        type: PropertyType.COMMERCIAL,
      };

      // Create first property
      const prop1 = await propertyRepo.createProperty(propertyData, testTenant1.id);
      testData.properties.add(prop1.id);

      // Second property with same address should succeed (different property_number)
      const prop2 = await propertyRepo.createProperty(propertyData, testTenant1.id);
      testData.properties.add(prop2.id);

      expect(prop1.id).not.toBe(prop2.id);
      expect(prop1.property_number).not.toBe(prop2.property_number);
    });
  });
});