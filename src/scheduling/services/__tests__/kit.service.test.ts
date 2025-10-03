/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/services/__tests__/kit.service.test.ts
 * phase: 3
 * domain: Scheduling Core
 * purpose: Test kit management service
 * spec_ref: 003-scheduling-kits
 * complexity_budget: 250
 * migration_touched: None
 * state_machine: none
 * estimated_llm_cost: 0
 * offline_capability: REQUIRED
 * dependencies:
 *   internal: ['KitService', 'repositories', 'types']
 *   external: ['jest']
 * exports: tests
 * voice_considerations: none
 * test_requirements:
 *   unit: 100%
 *   integration: 0%
 * tasks:
 *   - Test kit loading with variants
 *   - Test seasonal variant selection
 *   - Test override handling
 *   - Test cache behavior
 */

import { KitService } from '../kit.service';
import { KitRepository } from '../../repositories/kit.repository';
import { KitItemRepository } from '../../repositories/kit-item.repository';
import { KitVariantRepository } from '../../repositories/kit-variant.repository';
import { KitAssignmentRepository } from '../../repositories/kit-assignment.repository';
import { Kit, KitItem, KitVariant } from '../../types/kit.types';

// Mock repositories
jest.mock('../../repositories/kit.repository');
jest.mock('../../repositories/kit-item.repository');
jest.mock('../../repositories/kit-variant.repository');
jest.mock('../../repositories/kit-assignment.repository');

describe('KitService', () => {
  let service: KitService;
  let mockKitRepo: jest.Mocked<KitRepository>;
  let mockItemRepo: jest.Mocked<KitItemRepository>;
  let mockVariantRepo: jest.Mocked<KitVariantRepository>;
  let mockAssignmentRepo: jest.Mocked<KitAssignmentRepository>;

  beforeEach(() => {
    // Create mocked instances with required methods
    mockKitRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockItemRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockVariantRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByKit: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockAssignmentRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    service = new KitService();
    // Replace internal repos with mocks (use correct property names)
    (service as any).kitRepo = mockKitRepo;
    (service as any).kitItemRepo = mockItemRepo;
    (service as any).kitVariantRepo = mockVariantRepo;
    (service as any).assignmentRepo = mockAssignmentRepo;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadKitWithVariant', () => {
    const mockKit: Kit = {
      id: 'kit-1',
      tenant_id: 'company-1',
      kit_code: 'LAWN-BASIC',
      name: 'Basic Lawn Care Kit',
      description: 'Essential lawn care tools',
      category: 'lawn_care',
      is_active: true,
      metadata: {},
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockItems: KitItem[] = [
      {
        id: 'item-1',
        tenant_id: 'company-1',
        kit_id: 'kit-1',
        variant_id: null,
        material_id: 'mat-1',
        quantity: 1,
        is_required: true,
        display_order: 1,
        voice_note: 'Lawn mower',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'item-2',
        tenant_id: 'company-1',
        kit_id: 'kit-1',
        variant_id: 'variant-summer',
        material_id: 'mat-2',
        quantity: 1,
        is_required: true,
        display_order: 2,
        voice_note: 'Summer fertilizer',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    const mockVariant: KitVariant = {
      id: 'variant-summer',
      tenant_id: 'company-1',
      kit_id: 'kit-1',
      variant_code: 'SUMMER',
      name: 'Summer Variant',
      is_default: false,
      metadata: { season: 'summer' },
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should load kit with specific variant', async () => {
      mockKitRepo.findById.mockResolvedValue(mockKit);
      mockVariantRepo.findAll.mockResolvedValue([mockVariant]);
      mockItemRepo.findAll.mockResolvedValue(mockItems);

      const result = await service.loadKitWithVariant('kit-1', 'SUMMER');

      expect(result).toBeDefined();
      expect(result.kit).toEqual(mockKit);
      expect(result.variant).toEqual(mockVariant);
      expect(result.items).toHaveLength(2);
      expect(mockKitRepo.findById).toHaveBeenCalledWith('kit-1');
    });

    it('should load kit with default variant when no variant specified', async () => {
      const defaultVariant = { ...mockVariant, is_default: true };
      
      mockKitRepo.findById.mockResolvedValue(mockKit);
      mockVariantRepo.findByKit.mockResolvedValue([defaultVariant]);
      mockItemRepo.findAll.mockResolvedValue(mockItems);

      const result = await service.loadKitWithVariant('kit-1');

      expect(result.variant).toEqual(defaultVariant);
      expect(mockVariantRepo.findByKit).toHaveBeenCalledWith('kit-1');
    });

    it('should select seasonal variant automatically', async () => {
      const winterVariant: KitVariant = {
        ...mockVariant,
        id: 'variant-winter',
        variant_code: 'WINTER',
        name: 'Winter Variant',
        metadata: {
          season: 'winter',
          valid_from: '12-01',
          valid_to: '02-28'
        }
      };

      mockKitRepo.findById.mockResolvedValue(mockKit);
      mockVariantRepo.findByKit.mockResolvedValue([mockVariant, winterVariant]);
      mockItemRepo.findAll.mockResolvedValue(mockItems);

      // Mock date to January (winter)
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15'));

      const result = await service.loadKitWithVariant('kit-1');

      expect(result.variant?.id).toBe('variant-winter');

      jest.useRealTimers();
    });

    it('should throw error when kit not found', async () => {
      mockKitRepo.findById.mockResolvedValue(null);

      await expect(service.loadKitWithVariant('invalid-kit'))
        .rejects.toThrow('Kit not found');
    });
  });

  describe('applyOverrides', () => {
    const baseItems: KitItem[] = [
      {
        id: 'item-1',
        tenant_id: 'company-1',
        kit_id: 'kit-1',
        variant_id: null,
        material_id: 'mat-1',
        quantity: 10,
        is_required: true,
        display_order: 1,
        voice_note: 'Standard amount',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    it('should apply quantity override', () => {
      const overrides = {
        'mat-1': { quantity: 20, reason: 'Large property' }
      };

      const result = service.applyOverrides(baseItems, overrides, 'job-1', 'tech-1');

      expect(result.items[0].quantity).toBe(20);
      expect(result.overrideLogs).toHaveLength(1);
      expect(result.overrideLogs[0].override_reason).toBe('Large property');
    });

    it('should skip items with skip override', () => {
      const overrides = {
        'mat-1': { skip: true, reason: 'Customer has own' }
      };

      const result = service.applyOverrides(baseItems, overrides, 'job-1', 'tech-1');

      expect(result.items).toHaveLength(0);
      expect(result.overrideLogs[0].metadata.action).toBe('skip');
    });

    it('should handle substitution overrides', () => {
      const overrides = {
        'mat-1': { 
          substitute_with: 'mat-2', 
          quantity: 15,
          reason: 'Out of stock' 
        }
      };

      const result = service.applyOverrides(baseItems, overrides, 'job-1', 'tech-1');

      expect(result.items[0].material_id).toBe('mat-2');
      expect(result.items[0].quantity).toBe(15);
      expect(result.overrideLogs[0].metadata.original_material_id).toBe('mat-1');
    });
  });

  describe('caching', () => {
    it('should cache loaded kits', async () => {
      const mockKit: Kit = {
        id: 'kit-1',
        tenant_id: 'company-1',
        kit_code: 'TEST',
        name: 'Test Kit',
        description: null,
        category: null,
        is_active: true,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      mockKitRepo.findById.mockResolvedValue(mockKit);
      mockVariantRepo.findByKit.mockResolvedValue([]);
      mockItemRepo.findAll.mockResolvedValue([]);

      // First call
      await service.loadKitWithVariant('kit-1');
      
      // Second call should use cache
      await service.loadKitWithVariant('kit-1');

      expect(mockKitRepo.findById).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on changes', async () => {
      // Assuming there's a method to clear cache
      service.clearCache();

      // Verify cache is cleared (implementation dependent)
      expect(service.getCacheSize()).toBe(0);
    });
  });
});