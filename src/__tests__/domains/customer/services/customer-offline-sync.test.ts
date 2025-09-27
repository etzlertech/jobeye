import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { CustomerOfflineSync } from '@/domains/customer/services/customer-offline-sync';
import { CustomerService } from '@/domains/customer/services/customer-service';
import { 
  OfflineOperation, 
  SyncConflict,
  Customer,
  CustomerCreate,
  CustomerUpdate 
} from '@/domains/customer/types/customer-types';
import { EventBus } from '@/core/events/event-bus';
import { voiceLogger } from '@/core/logger/voice-logger';

// Mock dependencies
jest.mock('@/domains/customer/services/customer-service');
jest.mock('@/core/events/event-bus');
jest.mock('@/core/logger/voice-logger');

// Mock browser APIs
const mockNavigator = {
  onLine: true,
};

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

describe('CustomerOfflineSync', () => {
  let offlineSync: CustomerOfflineSync;
  let mockCustomerService: jest.Mocked<CustomerService>;
  let mockEventBus: jest.Mocked<EventBus>;
  
  const mockTenantId = 'tenant-123';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup browser API mocks
    (global as any).navigator = mockNavigator;
    (global as any).localStorage = mockLocalStorage;
    (global as any).window = {
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    };
    
    // Reset navigator state
    mockNavigator.onLine = true;
    
    // Setup service mocks
    mockCustomerService = new CustomerService(null as any) as jest.Mocked<CustomerService>;
    mockEventBus = {
      emit: jest.fn(),
      getInstance: jest.fn().mockReturnThis(),
    } as any;
    (EventBus.getInstance as jest.Mock).mockReturnValue(mockEventBus);
    
    // Create offline sync instance
    offlineSync = new CustomerOfflineSync(mockCustomerService);
  });

  afterEach(() => {
    delete (global as any).navigator;
    delete (global as any).localStorage;
    delete (global as any).window;
  });

  describe('queueCustomerOperation', () => {
    it('should queue operation successfully', async () => {
      const operation: OfflineOperation = {
        id: 'op-123',
        type: 'create',
        entityId: 'cust-123',
        data: { name: 'John Doe', phone: '555-123-4567' },
        tenantId: mockTenantId,
        timestamp: new Date(),
      };

      await offlineSync.queueCustomerOperation(operation, 'session-123');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'customer_offline_queue',
        expect.stringContaining(operation.id)
      );
      expect(voiceLogger.speak).toHaveBeenCalledWith(
        'Operation saved offline. Will sync when connection is restored.',
        expect.objectContaining({ voiceSessionId: 'session-123' })
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('customer:offline:queued', {
        operationId: expect.stringMatching(/^op-/),
        type: 'create',
      });
    });

    it('should persist queue to localStorage', async () => {
      const operation: OfflineOperation = {
        id: 'op-123',
        type: 'update',
        entityId: 'cust-123',
        data: { phone: '555-987-6543' },
        tenantId: mockTenantId,
        timestamp: new Date(),
      };

      await offlineSync.queueCustomerOperation(operation);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].operation.type).toBe('update');
    });
  });

  describe('syncPendingOperations', () => {
    beforeEach(() => {
      // Set online status
      mockNavigator.onLine = true;
    });

    it('should sync create operations successfully', async () => {
      const createOp: OfflineOperation = {
        id: 'op-create',
        type: 'create',
        entityId: 'cust-new',
        data: { name: 'New Customer', phone: '555-111-1111' } as CustomerCreate,
        tenantId: mockTenantId,
        timestamp: new Date(),
      };

      await offlineSync.queueCustomerOperation(createOp);
      
      mockCustomerService.findById = jest.fn().mockResolvedValue(null);
      mockCustomerService.createCustomer = jest.fn().mockResolvedValue({
        id: 'cust-new',
        ...createOp.data,
      });

      const result = await offlineSync.syncPendingOperations();

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.conflicts).toHaveLength(0);
      expect(mockCustomerService.createCustomer).toHaveBeenCalledWith(createOp.data);
    });

    it('should handle update operations with version checking', async () => {
      const updateOp: OfflineOperation = {
        id: 'op-update',
        type: 'update',
        entityId: 'cust-123',
        data: { phone: '555-222-2222' } as CustomerUpdate,
        tenantId: mockTenantId,
        timestamp: new Date(),
        version: 1,
      };

      await offlineSync.queueCustomerOperation(updateOp);
      
      const mockCustomer: Customer = {
        id: 'cust-123',
        customer_number: 'CUST-001',
        name: 'John Doe',
        tenant_id: mockTenantId,
        version: 1,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockCustomerService.findById = jest.fn().mockResolvedValue(mockCustomer);
      mockCustomerService.updateCustomer = jest.fn().mockResolvedValue({
        ...mockCustomer,
        ...updateOp.data,
        version: 2,
      });

      const result = await offlineSync.syncPendingOperations();

      expect(result.successful).toBe(1);
      expect(result.conflicts).toHaveLength(0);
      expect(mockCustomerService.updateCustomer).toHaveBeenCalledWith(
        'cust-123',
        updateOp.data
      );
    });

    it('should detect version conflicts', async () => {
      const updateOp: OfflineOperation = {
        id: 'op-update',
        type: 'update',
        entityId: 'cust-123',
        data: { phone: '555-333-3333' },
        tenantId: mockTenantId,
        timestamp: new Date(),
        version: 1,
      };

      await offlineSync.queueCustomerOperation(updateOp);
      
      mockCustomerService.findById = jest.fn().mockResolvedValue({
        id: 'cust-123',
        version: 2, // Version mismatch
        tenant_id: mockTenantId,
      });

      const result = await offlineSync.syncPendingOperations();

      expect(result.successful).toBe(0);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('version_mismatch');
    });

    it('should handle delete operations', async () => {
      const deleteOp: OfflineOperation = {
        id: 'op-delete',
        type: 'delete',
        entityId: 'cust-456',
        tenantId: mockTenantId,
        timestamp: new Date(),
      };

      await offlineSync.queueCustomerOperation(deleteOp);
      
      mockCustomerService.findById = jest.fn().mockResolvedValue({ id: 'cust-456' });
      mockCustomerService.deleteCustomer = jest.fn().mockResolvedValue(true);

      const result = await offlineSync.syncPendingOperations();

      expect(result.successful).toBe(1);
      expect(mockCustomerService.deleteCustomer).toHaveBeenCalledWith(
        'cust-456',
        mockTenantId
      );
    });

    it('should handle sync failures with retry logic', async () => {
      const operation: OfflineOperation = {
        id: 'op-fail',
        type: 'create',
        data: { name: 'Fail Test' },
        tenantId: mockTenantId,
        timestamp: new Date(),
      };

      await offlineSync.queueCustomerOperation(operation);
      
      mockCustomerService.createCustomer = jest.fn()
        .mockRejectedValue(new Error('Network error'));

      const result = await offlineSync.syncPendingOperations();

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Network error');
      
      // Check that operation is still in queue with incremented retry count
      const status = offlineSync.getOfflineStatus();
      expect(status.queuedOperations).toBe(1);
    });

    it('should remove operations after max retries', async () => {
      // Queue an operation with max retries already reached
      const operation: OfflineOperation = {
        id: 'op-max-retry',
        type: 'create',
        data: { name: 'Max Retry Test' },
        tenantId: mockTenantId,
        timestamp: new Date(),
      };

      // Manually set up the queue with max retries
      const queue = offlineSync as any;
      queue.queue.set('op-max-retry', {
        id: 'op-max-retry',
        operation,
        timestamp: new Date(),
        retryCount: 2, // Just below max
        lastError: 'Previous error',
      });

      mockCustomerService.createCustomer = jest.fn()
        .mockRejectedValue(new Error('Final error'));

      const result = await offlineSync.syncPendingOperations();

      expect(result.failed).toBe(1);
      
      // Operation should be removed from queue
      const status = offlineSync.getOfflineStatus();
      expect(status.queuedOperations).toBe(0);
      expect(mockEventBus.emit).toHaveBeenCalledWith('customer:offline:failed', {
        operationId: 'op-max-retry',
        error: 'Final error',
      });
    });

    it('should not sync when offline', async () => {
      mockNavigator.onLine = false;
      
      await expect(offlineSync.syncPendingOperations()).rejects.toThrow(
        'Cannot sync: offline or sync already in progress'
      );
    });

    it('should announce sync results via voice', async () => {
      // Queue multiple operations
      await offlineSync.queueCustomerOperation({
        id: 'op-1',
        type: 'create',
        data: { name: 'Customer 1' },
        tenantId: mockTenantId,
        timestamp: new Date(),
      });
      
      await offlineSync.queueCustomerOperation({
        id: 'op-2',
        type: 'update',
        entityId: 'cust-123',
        data: { phone: '555-444-4444' },
        tenantId: mockTenantId,
        timestamp: new Date(),
      });

      mockCustomerService.findById = jest.fn().mockResolvedValue(null);
      mockCustomerService.createCustomer = jest.fn().mockResolvedValue({ id: 'cust-1' });
      mockCustomerService.updateCustomer = jest.fn()
        .mockRejectedValue(new Error('Update failed'));

      const result = await offlineSync.syncPendingOperations();

      expect(voiceLogger.speak).toHaveBeenCalledWith(
        '1 operations synced successfully. 1 operations failed.'
      );
    });
  });

  describe('getOfflineStatus', () => {
    it('should return current status', async () => {
      const status = offlineSync.getOfflineStatus();

      expect(status).toEqual({
        isOnline: true,
        queuedOperations: 0,
        oldestOperation: null,
        syncInProgress: false,
      });
    });

    it('should track queued operations', async () => {
      const op1 = {
        id: 'op-1',
        type: 'create' as const,
        data: { name: 'Test 1' },
        tenantId: mockTenantId,
        timestamp: new Date('2024-01-01'),
      };
      
      const op2 = {
        id: 'op-2',
        type: 'update' as const,
        entityId: 'cust-123',
        data: { phone: '555-555-5555' },
        tenantId: mockTenantId,
        timestamp: new Date('2024-01-02'),
      };

      await offlineSync.queueCustomerOperation(op1);
      await offlineSync.queueCustomerOperation(op2);

      const status = offlineSync.getOfflineStatus();

      expect(status.queuedOperations).toBe(2);
      expect(status.oldestOperation).toEqual(op1.timestamp);
    });
  });

  describe('resolveConflicts', () => {
    const mockConflicts: SyncConflict[] = [
      {
        operationId: 'op-1',
        type: 'version_mismatch',
        localData: { phone: '555-111-1111' },
        remoteData: { id: 'cust-123', phone: '555-222-2222', version: 2 },
        message: 'Version conflict',
      },
      {
        operationId: 'op-2',
        type: 'entity_exists',
        localData: { name: 'Duplicate Customer' },
        remoteData: { id: 'cust-456', name: 'Existing Customer' },
        message: 'Entity exists',
      },
    ];

    it('should apply local version when selected', async () => {
      mockCustomerService.updateCustomer = jest.fn().mockResolvedValue({
        id: 'cust-123',
        phone: '555-111-1111',
      });

      await offlineSync.resolveConflicts(mockConflicts, ['local', 'remote']);

      expect(mockCustomerService.updateCustomer).toHaveBeenCalledOnce();
      expect(mockCustomerService.updateCustomer).toHaveBeenCalledWith(
        'cust-123',
        { phone: '555-111-1111' }
      );
    });

    it('should keep remote version when selected', async () => {
      await offlineSync.resolveConflicts(mockConflicts, ['remote', 'remote']);

      expect(mockCustomerService.updateCustomer).not.toHaveBeenCalled();
    });

    it('should merge conflicts when selected', async () => {
      mockCustomerService.updateCustomer = jest.fn().mockResolvedValue({
        id: 'cust-123',
        phone: '555-111-1111',
        version: 3,
      });

      await offlineSync.resolveConflicts([mockConflicts[0]], ['merge']);

      expect(mockCustomerService.updateCustomer).toHaveBeenCalledWith(
        'cust-123',
        expect.objectContaining({
          phone: '555-111-1111', // Local overrides remote
        })
      );
    });

    it('should validate resolution count', async () => {
      await expect(
        offlineSync.resolveConflicts(mockConflicts, ['local']) // Too few resolutions
      ).rejects.toThrow('Resolution count must match conflict count');
    });
  });

  describe('online/offline event handling', () => {
    it('should handle going offline', () => {
      const offlineHandler = mockAddEventListener.mock.calls
        .find(call => call[0] === 'offline')?.[1];
      
      offlineHandler?.();

      expect(voiceLogger.speak).toHaveBeenCalledWith(
        'Connection lost. Your changes will be saved offline.'
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('customer:sync:offline');
    });

    it('should handle coming online and auto-sync', async () => {
      jest.useFakeTimers();
      
      const onlineHandler = mockAddEventListener.mock.calls
        .find(call => call[0] === 'online')?.[1];
      
      mockCustomerService.createCustomer = jest.fn().mockResolvedValue({ id: 'test' });
      
      await onlineHandler?.();

      expect(voiceLogger.speak).toHaveBeenCalledWith(
        'Connection restored. Syncing offline changes...'
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('customer:sync:online');
      
      // Fast-forward timers to trigger auto-sync
      jest.advanceTimersByTime(2000);
      
      jest.useRealTimers();
    });
  });

  describe('localStorage persistence', () => {
    it('should load queue from localStorage on initialization', () => {
      const savedQueue = [
        {
          id: 'saved-op-1',
          operation: {
            id: 'saved-op-1',
            type: 'create',
            data: { name: 'Saved Customer' },
            tenantId: mockTenantId,
          },
          timestamp: new Date().toISOString(),
          retryCount: 1,
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedQueue));
      
      // Create new instance to trigger load
      const newSync = new CustomerOfflineSync(mockCustomerService);
      const status = newSync.getOfflineStatus();

      expect(status.queuedOperations).toBe(1);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('customer_offline_queue');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');
      
      // Should not throw
      const newSync = new CustomerOfflineSync(mockCustomerService);
      const status = newSync.getOfflineStatus();

      expect(status.queuedOperations).toBe(0);
    });
  });
});