// Test Integrity Rule: Never change a test's business behavior or expected outcomes just to make it pass.

import { ContainerService, ContainerEventType } from '@/domains/equipment/services/container-service';
import {
  Container,
  ContainerCreate,
  ContainerType,
  ContainerColor,
  ContainerVoiceCommand,
} from '@/domains/equipment/types/container-types';
import { EventBus } from '@/core/events/event-bus';
import { VoiceLogger } from '@/core/logger/voice-logger';

// Mock dependencies
jest.mock('@/domains/equipment/repositories/container-repository');
jest.mock('@/core/events/event-bus');
jest.mock('@/core/logger/voice-logger');

describe('ContainerService', () => {
  let service: ContainerService;
  let mockSupabaseClient: any;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockLogger: jest.Mocked<VoiceLogger>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockSupabaseClient = {};
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
    } as any;
    mockLogger = {
      info: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
    } as any;

    service = new ContainerService(
      mockSupabaseClient,
      mockEventBus,
      mockLogger,
      { enableVoiceCommands: true }
    );
  });

  describe('createContainer', () => {
    it('should create a new container successfully', async () => {
      const containerData: ContainerCreate = {
        containerType: ContainerType.TRUCK,
        identifier: 'VH-TKR',
        name: 'Red Truck',
        color: ContainerColor.RED,
        isDefault: true,
      };

      const mockContainer: Container = {
        id: 'container-123',
        tenantId: 'tenant-1',
        ...containerData,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock repository response
      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.create = jest.fn().mockResolvedValue(mockContainer);

      const result = await service.createContainer(containerData, 'tenant-1', 'user-1');

      expect(result).toEqual(mockContainer);
      expect(mockLogger.info).toHaveBeenCalledWith('Container created', expect.any(Object));
      expect(mockEventBus.emit).toHaveBeenCalledWith({
        type: ContainerEventType.CONTAINER_CREATED,
        payload: {
          container: mockContainer,
          createdBy: 'user-1',
        },
        metadata: {
          tenantId: 'tenant-1',
          timestamp: expect.any(Date),
        },
      });
    });

    it('should handle duplicate identifier error', async () => {
      const containerData: ContainerCreate = {
        containerType: ContainerType.TRUCK,
        identifier: 'VH-TKR',
        name: 'Red Truck',
      };

      // Mock repository to throw duplicate error
      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      const duplicateError: any = new Error('Container identifier exists');
      duplicateError.code = 'CONTAINER_IDENTIFIER_EXISTS';
      mockRepository.ContainerRepository.prototype.create = jest.fn().mockRejectedValue(duplicateError);

      await expect(
        service.createContainer(containerData, 'tenant-1', 'user-1')
      ).rejects.toThrow('Container identifier exists');
    });
  });

  describe('updateContainer', () => {
    it('should update container and emit default change event', async () => {
      const currentContainer: Container = {
        id: 'container-123',
        tenantId: 'tenant-1',
        containerType: ContainerType.TRUCK,
        identifier: 'VH-TKR',
        name: 'Red Truck',
        isDefault: false,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedContainer: Container = {
        ...currentContainer,
        isDefault: true,
        updatedAt: new Date(),
      };

      // Mock repository methods
      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.findById = jest.fn().mockResolvedValue(currentContainer);
      mockRepository.ContainerRepository.prototype.update = jest.fn().mockResolvedValue(updatedContainer);

      const result = await service.updateContainer(
        'container-123',
        { isDefault: true },
        'tenant-1',
        'user-1'
      );

      expect(result).toEqual(updatedContainer);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(2); // Update event + default change event
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ContainerEventType.DEFAULT_CONTAINER_CHANGED,
        })
      );
    });

    it('should throw error if container not found', async () => {
      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.findById = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateContainer('invalid-id', { name: 'New Name' }, 'tenant-1', 'user-1')
      ).rejects.toThrow('Container invalid-id not found');
    });
  });

  describe('getDefaultContainer', () => {
    it('should return existing default container', async () => {
      const defaultContainer: Container = {
        id: 'container-123',
        tenantId: 'tenant-1',
        containerType: ContainerType.TRUCK,
        identifier: 'VH-TKR',
        name: 'Red Truck',
        isDefault: true,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.getDefault = jest.fn().mockResolvedValue(defaultContainer);

      const result = await service.getDefaultContainer('tenant-1');

      expect(result).toEqual(defaultContainer);
    });

    it('should auto-create default if none exists and enabled', async () => {
      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.getDefault = jest.fn().mockResolvedValue(null);
      mockRepository.ContainerRepository.prototype.findAll = jest.fn().mockResolvedValue({ count: 0, data: [] });
      
      const newDefault: Container = {
        id: 'new-container',
        tenantId: 'tenant-1',
        containerType: ContainerType.TRUCK,
        identifier: 'VH-TRK1',
        name: 'Primary Truck',
        isDefault: true,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockRepository.ContainerRepository.prototype.create = jest.fn().mockResolvedValue(newDefault);

      const result = await service.getDefaultContainer('tenant-1');

      expect(result).toEqual(newDefault);
      expect(mockRepository.ContainerRepository.prototype.create).toHaveBeenCalled();
    });
  });

  describe('processVoiceCommand', () => {
    it('should select container by identifier', async () => {
      const command: ContainerVoiceCommand = {
        action: 'select',
        containerIdentifier: 'red truck',
      };

      const containers: Container[] = [
        {
          id: 'container-123',
          tenantId: 'tenant-1',
          containerType: ContainerType.TRUCK,
          identifier: 'VH-TKR',
          name: 'Red Truck',
          color: ContainerColor.RED,
          isDefault: true,
          isActive: true,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.searchContainers = jest.fn().mockResolvedValue(containers);

      const result = await service.processVoiceCommand(command, 'tenant-1', 'user-1');

      expect(result).toEqual(containers[0]);
      expect(mockRepository.ContainerRepository.prototype.searchContainers).toHaveBeenCalledWith(
        'red truck',
        'tenant-1'
      );
    });

    it('should return default when no identifier provided', async () => {
      const command: ContainerVoiceCommand = {
        action: 'select',
      };

      const defaultContainer: Container = {
        id: 'container-123',
        tenantId: 'tenant-1',
        containerType: ContainerType.TRUCK,
        identifier: 'VH-TKR',
        name: 'Red Truck',
        isDefault: true,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.getDefault = jest.fn().mockResolvedValue(defaultContainer);

      const result = await service.processVoiceCommand(command, 'tenant-1', 'user-1');

      expect(result).toEqual(defaultContainer);
    });

    it('should list all active containers', async () => {
      const command: ContainerVoiceCommand = {
        action: 'list',
      };

      const containers: Container[] = [
        {
          id: 'container-1',
          tenantId: 'tenant-1',
          containerType: ContainerType.TRUCK,
          identifier: 'VH-TKR',
          name: 'Red Truck',
          isActive: true,
          isDefault: true,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'container-2',
          tenantId: 'tenant-1',
          containerType: ContainerType.TRAILER,
          identifier: 'TR-001',
          name: 'Equipment Trailer',
          isActive: true,
          isDefault: false,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.getActiveContainers = jest.fn().mockResolvedValue(containers);

      const result = await service.processVoiceCommand(command, 'tenant-1', 'user-1');

      expect(result).toEqual(containers);
    });

    it('should throw error if voice commands disabled', async () => {
      const serviceWithoutVoice = new ContainerService(
        mockSupabaseClient,
        mockEventBus,
        mockLogger,
        { enableVoiceCommands: false }
      );

      const command: ContainerVoiceCommand = {
        action: 'select',
      };

      await expect(
        serviceWithoutVoice.processVoiceCommand(command, 'tenant-1', 'user-1')
      ).rejects.toThrow('Voice commands are not enabled');
    });
  });

  describe('getContainerSuggestions', () => {
    it('should filter containers by item type', async () => {
      const containers: Container[] = [
        {
          id: 'container-1',
          tenantId: 'tenant-1',
          containerType: ContainerType.TRUCK,
          identifier: 'VH-TKR',
          name: 'Red Truck',
          isActive: true,
          isDefault: true,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'container-2',
          tenantId: 'tenant-1',
          containerType: ContainerType.STORAGE_BIN,
          identifier: 'SHOP-A',
          name: 'Shop Storage A',
          isActive: true,
          isDefault: false,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.getActiveContainers = jest.fn().mockResolvedValue(containers);

      // Test equipment suggestions (should only include truck)
      const equipmentSuggestions = await service.getContainerSuggestions('tenant-1', 'equipment');
      expect(equipmentSuggestions).toEqual(['Red Truck (VH-TKR)']);

      // Test material suggestions (should include both)
      const materialSuggestions = await service.getContainerSuggestions('tenant-1', 'material');
      expect(materialSuggestions).toEqual(['Red Truck (VH-TKR)', 'Shop Storage A (SHOP-A)']);
    });
  });

  describe('validateContainerCapacity', () => {
    it('should validate capacity successfully', async () => {
      const container: Container = {
        id: 'container-123',
        tenantId: 'tenant-1',
        containerType: ContainerType.TRUCK,
        identifier: 'VH-TKR',
        name: 'Red Truck',
        capacityInfo: { itemLimit: 20 },
        isDefault: true,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.findById = jest.fn().mockResolvedValue(container);

      const result = await service.validateContainerCapacity('container-123', 5, 'tenant-1');

      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should detect capacity exceeded', async () => {
      const container: Container = {
        id: 'container-123',
        tenantId: 'tenant-1',
        containerType: ContainerType.TRUCK,
        identifier: 'VH-TKR',
        name: 'Red Truck',
        capacityInfo: { itemLimit: 10 },
        isDefault: true,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRepository = jest.requireMock('@/domains/equipment/repositories/container-repository');
      mockRepository.ContainerRepository.prototype.findById = jest.fn().mockResolvedValue(container);

      const result = await service.validateContainerCapacity('container-123', 15, 'tenant-1');

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Container capacity exceeded');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ContainerEventType.CONTAINER_CAPACITY_WARNING,
        })
      );
    });
  });
});