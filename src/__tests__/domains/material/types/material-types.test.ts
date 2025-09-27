// Test Integrity Rule: Never change a test's business behavior or expected outcomes just to make it pass.

import {
  Material,
  MaterialType,
  MaterialCategory,
  MaterialUnit,
  materialCreateSchema,
  materialUpdateSchema,
  isMaterialType,
  isMaterialCategory,
  isMaterialUnit,
} from '@/domains/material/types/material-types';

describe('Material Types', () => {
  describe('Type Guards', () => {
    it('should correctly identify valid material types', () => {
      expect(isMaterialType('fertilizer')).toBe(true);
      expect(isMaterialType('seed')).toBe(true);
      expect(isMaterialType('invalid')).toBe(false);
      expect(isMaterialType('')).toBe(false);
    });

    it('should correctly identify valid material categories', () => {
      expect(isMaterialCategory('lawn_care')).toBe(true);
      expect(isMaterialCategory('landscaping')).toBe(true);
      expect(isMaterialCategory('invalid')).toBe(false);
    });

    it('should correctly identify valid material units', () => {
      expect(isMaterialUnit('lb')).toBe(true);
      expect(isMaterialUnit('gal')).toBe(true);
      expect(isMaterialUnit('invalid')).toBe(false);
    });
  });

  describe('Material Create Schema', () => {
    const validMaterialData = {
      name: 'Premium Fertilizer',
      type: MaterialType.FERTILIZER,
      category: MaterialCategory.LAWN_CARE,
      unit: MaterialUnit.POUND,
      brand: 'Scotts',
      manufacturer: 'The Scotts Company',
    };

    it('should validate valid material creation data', () => {
      expect(() => materialCreateSchema.parse(validMaterialData)).not.toThrow();
    });

    it('should require mandatory fields', () => {
      expect(() => materialCreateSchema.parse({})).toThrow();
      expect(() => materialCreateSchema.parse({
        name: 'Test Material',
        // missing type
      })).toThrow();
    });

    it('should validate pricing structure when provided', () => {
      const withPricing = {
        ...validMaterialData,
        pricing: [{
          unitCost: 25.99,
          unit: MaterialUnit.POUND,
          supplier: 'supplier-1',
        }],
      };
      
      expect(() => materialCreateSchema.parse(withPricing)).not.toThrow();
    });

    it('should validate initial inventory when provided', () => {
      const withInventory = {
        ...validMaterialData,
        initialInventory: [{
          locationId: 'warehouse-1',
          locationName: 'Main Warehouse',
          currentStock: 100,
          reorderLevel: 20,
          maxStock: 500,
        }],
      };
      
      expect(() => materialCreateSchema.parse(withInventory)).not.toThrow();
    });

    it('should validate safety information when provided', () => {
      const withSafety = {
        ...validMaterialData,
        safety: {
          requiresPPE: true,
          ppeRequired: ['gloves', 'goggles'],
          hazardous: false,
          storageRequirements: 'Keep dry and cool',
        },
      };
      
      expect(() => materialCreateSchema.parse(withSafety)).not.toThrow();
    });
  });

  describe('Material Update Schema', () => {
    it('should validate partial updates', () => {
      const partialUpdate = {
        name: 'Updated Material Name',
        brand: 'New Brand',
      };
      
      expect(() => materialUpdateSchema.parse(partialUpdate)).not.toThrow();
    });

    it('should validate safety updates', () => {
      const safetyUpdate = {
        safety: {
          requiresPPE: false,
          hazardous: true,
        },
      };
      
      expect(() => materialUpdateSchema.parse(safetyUpdate)).not.toThrow();
    });
  });

  describe('Material Entity Structure', () => {
    it('should have all required properties defined in interface', () => {
      // This test verifies the Material interface structure
      const mockMaterial: Material = {
        id: 'mat-123',
        tenant_id: 'tenant-1',
        material_number: 'MAT-001',
        name: 'Test Fertilizer',
        type: MaterialType.FERTILIZER,
        category: MaterialCategory.LAWN_CARE,
        unit: MaterialUnit.POUND,
        pricing: [],
        inventory: [],
        usage: {
          totalUsed: 0,
          unit: MaterialUnit.POUND,
          averagePerJob: 0,
        },
        suppliers: [],
        tags: [],
        is_active: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: 'user-1',
      };

      expect(mockMaterial.id).toBeDefined();
      expect(mockMaterial.type).toBe(MaterialType.FERTILIZER);
      expect(mockMaterial.category).toBe(MaterialCategory.LAWN_CARE);
      expect(mockMaterial.unit).toBe(MaterialUnit.POUND);
    });
  });

  describe('Enums', () => {
    it('should have correct material types', () => {
      expect(MaterialType.FERTILIZER).toBe('fertilizer');
      expect(MaterialType.SEED).toBe('seed');
      expect(MaterialType.PESTICIDE).toBe('pesticide');
      expect(MaterialType.MULCH).toBe('mulch');
    });

    it('should have correct material categories', () => {
      expect(MaterialCategory.LAWN_CARE).toBe('lawn_care');
      expect(MaterialCategory.LANDSCAPING).toBe('landscaping');
      expect(MaterialCategory.IRRIGATION).toBe('irrigation');
      expect(MaterialCategory.CHEMICALS).toBe('chemicals');
    });

    it('should have correct material units', () => {
      expect(MaterialUnit.POUND).toBe('lb');
      expect(MaterialUnit.GALLON).toBe('gal');
      expect(MaterialUnit.BAG).toBe('bag');
      expect(MaterialUnit.CASE).toBe('case');
    });
  });
});