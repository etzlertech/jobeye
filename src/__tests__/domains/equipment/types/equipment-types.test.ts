// Test Integrity Rule: Never change a test's business behavior or expected outcomes just to make it pass.

import {
  Equipment,
  EquipmentType,
  EquipmentState,
  EquipmentCategory,
  equipmentCreateSchema,
  equipmentUpdateSchema,
  isEquipmentType,
  isEquipmentState,
  isEquipmentCategory,
} from '@/domains/equipment/types/equipment-types';

describe('Equipment Types', () => {
  describe('Type Guards', () => {
    it('should correctly identify valid equipment types', () => {
      expect(isEquipmentType('mower')).toBe(true);
      expect(isEquipmentType('trimmer')).toBe(true);
      expect(isEquipmentType('invalid')).toBe(false);
      expect(isEquipmentType('')).toBe(false);
    });

    it('should correctly identify valid equipment states', () => {
      expect(isEquipmentState('active')).toBe(true);
      expect(isEquipmentState('maintenance')).toBe(true);
      expect(isEquipmentState('invalid')).toBe(false);
    });

    it('should correctly identify valid equipment categories', () => {
      expect(isEquipmentCategory('lawn_care')).toBe(true);
      expect(isEquipmentCategory('irrigation')).toBe(true);
      expect(isEquipmentCategory('invalid')).toBe(false);
    });
  });

  describe('Equipment Create Schema', () => {
    const validEquipmentData = {
      name: 'Test Mower',
      type: EquipmentType.MOWER,
      category: EquipmentCategory.LAWN_CARE,
      manufacturer: {
        name: 'Honda',
        model: 'HRX217VKA',
        year: 2023,
      },
      location: {
        type: 'warehouse' as const,
        id: 'warehouse-1',
        name: 'Main Warehouse',
      },
    };

    it('should validate valid equipment creation data', () => {
      expect(() => equipmentCreateSchema.parse(validEquipmentData)).not.toThrow();
    });

    it('should require mandatory fields', () => {
      expect(() => equipmentCreateSchema.parse({})).toThrow();
      expect(() => equipmentCreateSchema.parse({
        name: 'Test Mower',
        // missing type
      })).toThrow();
    });

    it('should validate manufacturer structure', () => {
      const invalidManufacturer = {
        ...validEquipmentData,
        manufacturer: {
          name: '', // empty name should fail
          model: 'HRX217VKA',
        },
      };
      
      expect(() => equipmentCreateSchema.parse(invalidManufacturer)).toThrow();
    });

    it('should validate location structure', () => {
      const invalidLocation = {
        ...validEquipmentData,
        location: {
          type: 'invalid' as any,
          id: 'warehouse-1',
          name: 'Main Warehouse',
        },
      };
      
      expect(() => equipmentCreateSchema.parse(invalidLocation)).toThrow();
    });

    it('should accept optional fields', () => {
      const withOptionalFields = {
        ...validEquipmentData,
        serialNumber: 'SN123456',
        purchaseDate: new Date(),
        purchasePrice: 500,
        specs: {
          engineType: '4-stroke',
          fuelType: 'gas' as const,
          power: '6.5 HP',
        },
        tags: ['new', 'warranty'],
      };
      
      expect(() => equipmentCreateSchema.parse(withOptionalFields)).not.toThrow();
    });
  });

  describe('Equipment Update Schema', () => {
    it('should validate partial updates', () => {
      const partialUpdate = {
        name: 'Updated Mower Name',
        state: EquipmentState.MAINTENANCE,
      };
      
      expect(() => equipmentUpdateSchema.parse(partialUpdate)).not.toThrow();
    });

    it('should validate optional nested updates', () => {
      const nestedUpdate = {
        manufacturer: {
          supportPhone: '1-800-HONDA',
        },
        specs: {
          weight: 85,
        },
        location: {
          name: 'Updated Location',
        },
      };
      
      expect(() => equipmentUpdateSchema.parse(nestedUpdate)).not.toThrow();
    });
  });

  describe('Equipment Entity Structure', () => {
    it('should have all required properties defined in interface', () => {
      // This test verifies the Equipment interface structure
      const mockEquipment: Equipment = {
        id: 'eq-123',
        tenant_id: 'tenant-1',
        equipment_number: 'EQ-001',
        name: 'Test Mower',
        type: EquipmentType.MOWER,
        category: EquipmentCategory.LAWN_CARE,
        manufacturer: {
          name: 'Honda',
          model: 'HRX217VKA',
        },
        specs: {},
        state: EquipmentState.ACTIVE,
        location: {
          type: 'warehouse',
          id: 'warehouse-1',
          name: 'Main Warehouse',
          lastUpdated: new Date(),
        },
        usage: {
          hoursUsed: 0,
        },
        tags: [],
        is_active: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: 'user-1',
      };

      expect(mockEquipment.id).toBeDefined();
      expect(mockEquipment.type).toBe(EquipmentType.MOWER);
      expect(mockEquipment.state).toBe(EquipmentState.ACTIVE);
      expect(mockEquipment.location.type).toBe('warehouse');
    });
  });

  describe('Enums', () => {
    it('should have correct equipment types', () => {
      expect(EquipmentType.MOWER).toBe('mower');
      expect(EquipmentType.TRIMMER).toBe('trimmer');
      expect(EquipmentType.IRRIGATION_CONTROLLER).toBe('irrigation_controller');
    });

    it('should have correct equipment states', () => {
      expect(EquipmentState.ACTIVE).toBe('active');
      expect(EquipmentState.MAINTENANCE).toBe('maintenance');
      expect(EquipmentState.REPAIR).toBe('repair');
      expect(EquipmentState.RETIRED).toBe('retired');
      expect(EquipmentState.LOST).toBe('lost');
    });

    it('should have correct equipment categories', () => {
      expect(EquipmentCategory.LAWN_CARE).toBe('lawn_care');
      expect(EquipmentCategory.IRRIGATION).toBe('irrigation');
      expect(EquipmentCategory.MAINTENANCE).toBe('maintenance');
    });
  });
});