import {
  PropertyType,
  PropertyState,
  Property,
  PropertyCreate,
  PropertyUpdate,
  Address,
  GeoLocation,
  ServiceLocation,
  PropertyVoiceProfile,
  PropertySearchResult,
  PropertyVoiceCommand,
  PropertyStateTransition,
  addressSchema,
  geoLocationSchema,
  propertyCreateSchema,
  propertyUpdateSchema,
  serviceLocationSchema,
  isProperty,
  isValidPropertyType,
  isValidPropertyState,
} from '@/domains/property/types/property-types';

describe('Property Types', () => {
  describe('Enums', () => {
    it('should have correct PropertyType values', () => {
      expect(PropertyType.RESIDENTIAL).toBe('residential');
      expect(PropertyType.COMMERCIAL).toBe('commercial');
      expect(PropertyType.INDUSTRIAL).toBe('industrial');
      expect(PropertyType.AGRICULTURAL).toBe('agricultural');
      expect(PropertyType.VACANT_LAND).toBe('vacant_land');
      expect(PropertyType.MIXED_USE).toBe('mixed_use');
    });

    it('should have correct PropertyState values', () => {
      expect(PropertyState.DRAFT).toBe('draft');
      expect(PropertyState.ACTIVE).toBe('active');
      expect(PropertyState.INACTIVE).toBe('inactive');
      expect(PropertyState.SCHEDULED).toBe('scheduled');
    });
  });

  describe('addressSchema', () => {
    it('should validate valid address', () => {
      const validAddress = {
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
      };

      const result = addressSchema.safeParse(validAddress);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.country).toBe('US'); // Default value
      }
    });

    it('should validate address with optional fields', () => {
      const addressWithOptionals = {
        street: '123 Main St',
        unit: 'Apt 4B',
        city: 'Springfield',
        state: 'IL',
        zip: '62701-1234', // Extended ZIP
        country: 'CA',
        formatted: '123 Main St Apt 4B, Springfield, IL 62701-1234',
        landmarks: ['near the park', 'blue building'],
      };

      const result = addressSchema.safeParse(addressWithOptionals);
      expect(result.success).toBe(true);
    });

    it('should reject invalid address', () => {
      const invalidAddresses = [
        { street: '', city: 'City', state: 'IL', zip: '62701' }, // Empty street
        { street: 'Street', city: '', state: 'IL', zip: '62701' }, // Empty city
        { street: 'Street', city: 'City', state: 'ILL', zip: '62701' }, // Invalid state
        { street: 'Street', city: 'City', state: 'IL', zip: 'ABCDE' }, // Invalid ZIP
        { street: 'Street', city: 'City', state: 'IL', zip: '1234' }, // Too short ZIP
      ];

      invalidAddresses.forEach(address => {
        const result = addressSchema.safeParse(address);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('geoLocationSchema', () => {
    it('should validate valid geolocation', () => {
      const validLocation = {
        latitude: 39.7817,
        longitude: -89.6501,
        accuracy: 10,
        altitude: 500,
        source: 'gps',
        timestamp: new Date(),
      };

      const result = geoLocationSchema.safeParse(validLocation);
      expect(result.success).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      const invalidLocations = [
        { latitude: 91, longitude: 0, source: 'gps', timestamp: new Date() }, // Lat > 90
        { latitude: -91, longitude: 0, source: 'gps', timestamp: new Date() }, // Lat < -90
        { latitude: 0, longitude: 181, source: 'gps', timestamp: new Date() }, // Lon > 180
        { latitude: 0, longitude: -181, source: 'gps', timestamp: new Date() }, // Lon < -180
      ];

      invalidLocations.forEach(location => {
        const result = geoLocationSchema.safeParse(location);
        expect(result.success).toBe(false);
      });
    });

    it('should validate source enum', () => {
      const validSources = ['gps', 'geocoding', 'manual'];
      
      validSources.forEach(source => {
        const location = {
          latitude: 0,
          longitude: 0,
          source,
          timestamp: new Date(),
        };
        const result = geoLocationSchema.safeParse(location);
        expect(result.success).toBe(true);
      });

      const invalidSource = {
        latitude: 0,
        longitude: 0,
        source: 'invalid',
        timestamp: new Date(),
      };
      const result = geoLocationSchema.safeParse(invalidSource);
      expect(result.success).toBe(false);
    });
  });

  describe('propertyCreateSchema', () => {
    const validPropertyCreate: PropertyCreate = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      address: {
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
      },
      type: PropertyType.RESIDENTIAL,
    };

    it('should validate valid property creation data', () => {
      const result = propertyCreateSchema.safeParse(validPropertyCreate);
      expect(result.success).toBe(true);
    });

    it('should validate with all optional fields', () => {
      const fullPropertyCreate = {
        ...validPropertyCreate,
        location: {
          latitude: 39.7817,
          longitude: -89.6501,
        },
        size: 2500,
        lotSize: 10890,
        yearBuilt: 1995,
        stories: 2,
        notes: 'Gate code 1234',
        tags: ['corner-lot', 'renovated'],
        serviceFrequency: 'monthly',
        voiceMetadata: {
          nickname: 'The Smith House',
          landmarks: ['near the park'],
        },
      };

      const result = propertyCreateSchema.safeParse(fullPropertyCreate);
      expect(result.success).toBe(true);
    });

    it('should reject invalid customer ID', () => {
      const invalidCreate = {
        ...validPropertyCreate,
        customerId: 'not-a-uuid',
      };

      const result = propertyCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });

    it('should reject invalid property type', () => {
      const invalidCreate = {
        ...validPropertyCreate,
        type: 'INVALID_TYPE',
      };

      const result = propertyCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });

    it('should validate year constraints', () => {
      const futureYear = {
        ...validPropertyCreate,
        yearBuilt: new Date().getFullYear() + 1,
      };
      expect(propertyCreateSchema.safeParse(futureYear).success).toBe(false);

      const ancientYear = {
        ...validPropertyCreate,
        yearBuilt: 1799,
      };
      expect(propertyCreateSchema.safeParse(ancientYear).success).toBe(false);
    });

    it('should validate service frequency enum', () => {
      const validFrequencies = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'as_needed'];
      
      validFrequencies.forEach(freq => {
        const create = { ...validPropertyCreate, serviceFrequency: freq };
        expect(propertyCreateSchema.safeParse(create).success).toBe(true);
      });

      const invalidFreq = { ...validPropertyCreate, serviceFrequency: 'daily' };
      expect(propertyCreateSchema.safeParse(invalidFreq).success).toBe(false);
    });
  });

  describe('propertyUpdateSchema', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        notes: 'Updated notes',
      };

      const result = propertyUpdateSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should allow empty updates', () => {
      const result = propertyUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should not allow customerId in updates', () => {
      const updateWithCustomerId = {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        notes: 'Updated',
      };

      const result = propertyUpdateSchema.safeParse(updateWithCustomerId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect('customerId' in result.data).toBe(false);
      }
    });
  });

  describe('serviceLocationSchema', () => {
    it('should validate service location data', () => {
      const validServiceLocation = {
        gateCode: '1234',
        accessInstructions: 'Use side gate',
        petWarnings: 'Large dog in backyard',
        equipmentLocation: 'Garage',
        shutoffLocations: {
          water: 'Front yard near sidewalk',
          gas: 'Side of house',
          electrical: 'Basement',
        },
        specialInstructions: 'Call before arrival',
        bestTimeToService: 'Mornings before 10am',
        voiceNotes: ['Dog is friendly', 'Owner prefers text'],
      };

      const result = serviceLocationSchema.safeParse(validServiceLocation);
      expect(result.success).toBe(true);
    });

    it('should reject invalid gate codes', () => {
      const invalidGateCodes = [
        { gateCode: '123' }, // Too short
        { gateCode: '12345678901' }, // Too long
        { gateCode: 'ABCD' }, // Non-numeric
      ];

      invalidGateCodes.forEach(data => {
        const result = serviceLocationSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });

    it('should enforce max length constraints', () => {
      const tooLongData = {
        accessInstructions: 'A'.repeat(501),
        petWarnings: 'B'.repeat(201),
        equipmentLocation: 'C'.repeat(201),
        specialInstructions: 'D'.repeat(501),
      };

      const result = serviceLocationSchema.safeParse(tooLongData);
      expect(result.success).toBe(false);
    });
  });

  describe('Type Guards', () => {
    const validProperty: Property = {
      id: 'prop-123',
      tenant_id: 'tenant-123',
      customerId: 'cust-123',
      property_number: 'PROP-001',
      name: 'Test Property',
      address: {
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
      },
      type: PropertyType.RESIDENTIAL,
      state: PropertyState.ACTIVE,
      is_active: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('isProperty', () => {
      it('should return true for valid property', () => {
        expect(isProperty(validProperty)).toBe(true);
      });

      it('should return false for invalid objects', () => {
        expect(isProperty(null)).toBe(false);
        expect(isProperty(undefined)).toBe(false);
        expect(isProperty({})).toBe(false);
        expect(isProperty({ id: 'test' })).toBe(false);
        expect(isProperty({ id: 'test', address: {} })).toBe(false);
        expect(isProperty({ id: 'test', address: {}, type: PropertyType.RESIDENTIAL })).toBe(true);
      });
    });

    describe('isValidPropertyType', () => {
      it('should validate property types', () => {
        Object.values(PropertyType).forEach(type => {
          expect(isValidPropertyType(type)).toBe(true);
        });

        expect(isValidPropertyType('INVALID')).toBe(false);
        expect(isValidPropertyType('')).toBe(false);
      });
    });

    describe('isValidPropertyState', () => {
      it('should validate property states', () => {
        Object.values(PropertyState).forEach(state => {
          expect(isValidPropertyState(state)).toBe(true);
        });

        expect(isValidPropertyState('INVALID')).toBe(false);
        expect(isValidPropertyState('')).toBe(false);
      });
    });
  });

  describe('Complex Types', () => {
    it('should define PropertyVoiceProfile correctly', () => {
      const voiceProfile: PropertyVoiceProfile = {
        propertyId: 'prop-123',
        nickname: 'The Smith House',
        phoneticAddress: 'one twenty three main street',
        landmarks: ['near the park', 'blue house'],
        alternateNames: ['Smith residence', 'Main street property'],
        commonMispronunciations: ['Maine street'],
        voiceSearchHits: 42,
        lastVoiceUpdate: new Date(),
      };

      expect(voiceProfile.propertyId).toBe('prop-123');
      expect(voiceProfile.landmarks).toHaveLength(2);
    });

    it('should define PropertySearchResult correctly', () => {
      const searchResult: PropertySearchResult = {
        property: {} as Property,
        matchType: 'fuzzy',
        confidence: 0.85,
        matchedField: 'address',
        distance: 1500,
        voiceContext: {
          spokenQuery: 'property near park',
          interpretedQuery: 'property landmarks:park',
          landmarks: ['park'],
        },
        highlightedText: 'Property **near park**',
      };

      expect(searchResult.matchType).toBe('fuzzy');
      expect(searchResult.confidence).toBe(0.85);
    });

    it('should define PropertyVoiceCommand correctly', () => {
      const commands: PropertyVoiceCommand[] = [
        { type: 'find_property', query: 'smith house' },
        { type: 'create_property', customerId: 'cust-123', address: { street: '123 Main St', city: 'City', state: 'ST', zip: '12345' } },
        { type: 'update_property', propertyId: 'prop-123', gateCode: '1234' },
        { type: 'add_service_note', propertyId: 'prop-123', note: 'Dog in backyard' },
        { type: 'update_gate_code', propertyId: 'prop-123', gateCode: '5678' },
        { type: 'schedule_service', propertyId: 'prop-123', serviceDate: new Date() },
        { type: 'list_properties', customerId: 'cust-123' },
        { type: 'property_details', propertyId: 'prop-123' },
      ];

      commands.forEach(cmd => {
        expect(cmd.type).toBeDefined();
      });
    });

    it('should define PropertyStateTransition correctly', () => {
      const transition: PropertyStateTransition = {
        from: PropertyState.ACTIVE,
        to: PropertyState.INACTIVE,
        reason: 'Customer requested deactivation',
        scheduledDate: new Date('2025-01-01'),
        performedBy: 'user-123',
        timestamp: new Date(),
      };

      expect(transition.from).toBe(PropertyState.ACTIVE);
      expect(transition.to).toBe(PropertyState.INACTIVE);
    });
  });
});