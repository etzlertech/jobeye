// Test Integrity Rule: Never change a test's business behavior or expected outcomes just to make it pass.

import { EquipmentService } from '@/domains/equipment/services/equipment-service';
import {
  EquipmentType,
  EquipmentState,
  EquipmentCategory,
} from '@/domains/equipment/types/equipment-types';

// Mock dependencies
jest.mock('@/domains/equipment/repositories/equipment-repository');
jest.mock('@/core/events/event-bus');
jest.mock('@/core/errors/error-types', () => ({
  createAppError: jest.fn((config) => {
    const error = new Error(config.message);
    (error as any).code = config.code;
    return error;
  }),
  ErrorSeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  },
  ErrorCategory: {
    DATABASE: 'database',
    VALIDATION: 'validation',
    BUSINESS_LOGIC: 'business_logic',
  },
}));

describe('EquipmentService', () => {
  let service: EquipmentService;
  let mockRepository: any;
  let mockEventBus: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock repository
    mockRepository = {
      createEquipment: jest.fn(),
      findById: jest.fn(),
      updateEquipment: jest.fn(),
      findBySerialNumber: jest.fn(),
      updateEquipmentLocation: jest.fn(),
      findAll: jest.fn(),
      searchEquipment: jest.fn(),
      findEquipmentByType: jest.fn(),
      findEquipmentByLocation: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      emit: jest.fn(),
    };

    // Mock Supabase client
    mockSupabaseClient = {};

    // Mock the repository constructor
    const { EquipmentRepository } = require('@/domains/equipment/repositories/equipment-repository');
    (EquipmentRepository as jest.Mock).mockImplementation(() => mockRepository);

    service = new EquipmentService(mockSupabaseClient, mockEventBus, {
      enableMaintenanceReminders: true,
      requireLocationTracking: true,
    });
  });

  describe('createEquipment', () => {
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

    it('should create equipment successfully', async () => {
      const mockCreatedEquipment = {
        id: 'eq-123',
        ...validEquipmentData,
        state: EquipmentState.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findBySerialNumber.mockResolvedValue(null);
      mockRepository.createEquipment.mockResolvedValue(mockCreatedEquipment);

      const result = await service.createEquipment(
        validEquipmentData,
        'tenant-1',
        'user-1'
      );

      expect(mockRepository.createEquipment).toHaveBeenCalledWith(
        validEquipmentData,
        'tenant-1'
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'equipment.created',
        expect.objectContaining({
          aggregateId: 'eq-123',
          tenantId: 'tenant-1',
          userId: 'user-1',
        })
      );
      expect(result).toEqual(mockCreatedEquipment);
    });

    it('should require location when location tracking is enabled', async () => {
      const dataWithoutLocation = {
        ...validEquipmentData,
        location: undefined,
      };

      await expect(
        service.createEquipment(dataWithoutLocation as any, 'tenant-1', 'user-1')
      ).rejects.toThrow('Equipment location is required');
    });

    it('should check for duplicate serial numbers', async () => {
      const dataWithSerial = {
        ...validEquipmentData,
        serialNumber: 'SN123456',
      };

      const existingEquipment = {
        id: 'existing-eq',
        serialNumber: 'SN123456',
      };

      mockRepository.findBySerialNumber.mockResolvedValue(existingEquipment);

      await expect(
        service.createEquipment(dataWithSerial, 'tenant-1', 'user-1')
      ).rejects.toThrow('Equipment with this serial number already exists');
    });
  });

  describe('updateEquipment', () => {
    const mockEquipment = {
      id: 'eq-123',
      name: 'Test Mower',
      state: EquipmentState.ACTIVE,
      location: {
        type: 'warehouse',
        id: 'warehouse-1',
        name: 'Main Warehouse',
      },
    };

    it('should update equipment successfully', async () => {
      const updates = {
        name: 'Updated Mower',
        state: EquipmentState.MAINTENANCE,
      };

      const updatedEquipment = {
        ...mockEquipment,
        ...updates,
      };

      mockRepository.findById.mockResolvedValue(mockEquipment);
      mockRepository.updateEquipment.mockResolvedValue(updatedEquipment);

      const result = await service.updateEquipment(
        'eq-123',
        updates,
        'tenant-1',
        'user-1'
      );

      expect(mockRepository.updateEquipment).toHaveBeenCalledWith(
        'eq-123',
        updates,
        'tenant-1'
      );
      expect(result).toEqual(updatedEquipment);
    });

    it('should validate state transitions', async () => {
      const invalidUpdate = {
        state: EquipmentState.REPAIR,
      };

      // Mock current equipment in RETIRED state
      const retiredEquipment = {
        ...mockEquipment,
        state: EquipmentState.RETIRED,
      };

      mockRepository.findById.mockResolvedValue(retiredEquipment);

      await expect(
        service.updateEquipment('eq-123', invalidUpdate, 'tenant-1', 'user-1')
      ).rejects.toThrow('Cannot transition from retired to repair');
    });

    it('should emit events for state changes', async () => {
      const stateUpdate = {
        state: EquipmentState.MAINTENANCE,
      };

      const updatedEquipment = {
        ...mockEquipment,
        state: EquipmentState.MAINTENANCE,
      };

      mockRepository.findById.mockResolvedValue(mockEquipment);
      mockRepository.updateEquipment.mockResolvedValue(updatedEquipment);

      await service.updateEquipment('eq-123', stateUpdate, 'tenant-1', 'user-1');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'equipment.state_changed',
        expect.objectContaining({
          payload: expect.objectContaining({
            fromState: EquipmentState.ACTIVE,
            toState: EquipmentState.MAINTENANCE,
          }),
        })
      );
    });
  });

  describe('moveEquipment', () => {
    const mockEquipment = {
      id: 'eq-123',
      location: {
        type: 'warehouse',
        id: 'warehouse-1',
        name: 'Main Warehouse',
      },
    };

    it('should move equipment to new location', async () => {
      const newLocation = {
        type: 'property' as const,
        id: 'property-1',
        name: 'Customer Property',
      };

      const movedEquipment = {
        ...mockEquipment,
        location: {
          ...newLocation,
          lastUpdated: new Date(),
        },
      };

      mockRepository.findById.mockResolvedValue(mockEquipment);
      mockRepository.updateEquipmentLocation.mockResolvedValue(movedEquipment);

      const result = await service.moveEquipment(
        'eq-123',
        newLocation,
        'tenant-1',
        'user-1'
      );

      expect(mockRepository.updateEquipmentLocation).toHaveBeenCalledWith(
        'eq-123',
        newLocation,
        'tenant-1'
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'equipment.moved',
        expect.objectContaining({
          payload: expect.objectContaining({
            fromLocation: mockEquipment.location,
            toLocation: newLocation,
          }),
        })
      );
      expect(result).toEqual(movedEquipment);
    });
  });

  describe('transitionState', () => {
    it('should transition equipment state with reason', async () => {
      const mockEquipment = {
        id: 'eq-123',
        state: EquipmentState.MAINTENANCE,
      };

      mockRepository.updateEquipment.mockResolvedValue(mockEquipment);

      const result = await service.transitionState(
        'eq-123',
        EquipmentState.MAINTENANCE,
        'Scheduled maintenance',
        'tenant-1',
        'user-1'
      );

      expect(mockRepository.updateEquipment).toHaveBeenCalledWith(
        'eq-123',
        { state: EquipmentState.MAINTENANCE },
        'tenant-1'
      );
      expect(result).toEqual(mockEquipment);
    });
  });

  describe('bulkImportEquipment', () => {
    it('should import multiple equipment items', async () => {
      const equipmentList = [
        {
          name: 'Mower 1',
          type: EquipmentType.MOWER,
          category: EquipmentCategory.LAWN_CARE,
          manufacturer: { name: 'Honda', model: 'HRX217' },
          location: { type: 'warehouse', id: 'wh-1', name: 'Warehouse 1' },
        },
        {
          name: 'Trimmer 1',
          type: EquipmentType.TRIMMER,
          category: EquipmentCategory.LAWN_CARE,
          manufacturer: { name: 'Echo', model: 'SRM-225' },
          location: { type: 'warehouse', id: 'wh-1', name: 'Warehouse 1' },
        },
      ];

      // Mock successful creation for first item, failure for second
      mockRepository.findBySerialNumber.mockResolvedValue(null);
      mockRepository.createEquipment
        .mockResolvedValueOnce({ id: 'eq-1', ...equipmentList[0] })
        .mockRejectedValueOnce(new Error('Validation failed'));

      const result = await service.bulkImportEquipment(
        equipmentList,
        'tenant-1',
        'user-1'
      );

      expect(result.success).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.success[0].id).toBe('eq-1');
      expect(result.failed[0].error).toBe('Failed to create equipment');
    });
  });

  describe('searchEquipment', () => {
    it('should search equipment by term', async () => {
      const mockSearchResults = [
        { id: 'eq-1', name: 'Honda Mower' },
        { id: 'eq-2', name: 'Honda Trimmer' },
      ];

      mockRepository.searchEquipment.mockResolvedValue(mockSearchResults);

      const result = await service.searchEquipment('Honda', 'tenant-1');

      expect(mockRepository.searchEquipment).toHaveBeenCalledWith('Honda', 'tenant-1');
      expect(result).toEqual(mockSearchResults);
    });

    it('should find all with filters when no search term', async () => {
      const mockResults = {
        data: [{ id: 'eq-1', type: EquipmentType.MOWER }],
        count: 1,
      };

      mockRepository.findAll.mockResolvedValue(mockResults);

      const result = await service.searchEquipment('', 'tenant-1', {
        type: EquipmentType.MOWER,
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        filters: { type: EquipmentType.MOWER },
        limit: 50,
      });
      expect(result).toEqual(mockResults.data);
    });
  });
});