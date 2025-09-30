/**
 * @file /src/domains/vision/__tests__/scenarios/offline-queue.scenario.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose End-to-end scenario tests for offline queue feature
 * @test_coverage Full scenario coverage
 */

import { OfflineVerificationQueue } from '../../lib/offline-queue';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  databases: []
};

// Mock window.indexedDB
(global as any).indexedDB = mockIndexedDB;
(global as any).IDBRequest = class {};
(global as any).IDBOpenDBRequest = class {};
(global as any).IDBDatabase = class {};

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
(global as any).localStorage = mockLocalStorage;

describe('Offline Queue - End-to-End Scenarios', () => {
  let queue: OfflineVerificationQueue;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock database
    mockDb = {
      transaction: jest.fn(),
      objectStoreNames: { contains: jest.fn().mockReturnValue(false) }
    };

    // Mock successful DB open
    const mockRequest = {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      result: mockDb
    };

    mockIndexedDB.open.mockReturnValue(mockRequest);

    // Trigger success after short delay
    setTimeout(() => {
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess({ target: { result: mockDb } });
      }
    }, 0);

    queue = new OfflineVerificationQueue();
  });

  describe('Scenario 1: Queue verification when offline', () => {
    it('should store verification in IndexedDB when network is unavailable', async () => {
      // Arrange: Simulate offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const mockStore = {
        add: jest.fn(),
        getAll: jest.fn()
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockStore)
      };

      mockDb.transaction.mockReturnValue(mockTransaction);

      const mockAddRequest = {
        onsuccess: null as any,
        onerror: null as any
      };
      mockStore.add.mockReturnValue(mockAddRequest);

      // Create mock ImageData
      const imageData = new ImageData(new Uint8ClampedArray(400), 10, 10);

      // Act: Enqueue verification
      const enqueuePromise = queue.enqueue({
        kitId: 'kit-001',
        companyId: 'company-123',
        imageData,
        expectedItems: ['wrench', 'hammer'],
        maxBudgetUsd: 10.0,
        maxRequestsPerDay: 100
      });

      // Trigger success
      setTimeout(() => {
        if (mockAddRequest.onsuccess) {
          mockAddRequest.onsuccess();
        }
      }, 0);

      const queueId = await enqueuePromise;

      // Assert
      expect(queueId).toBeDefined();
      expect(queueId).toContain('queue-');
      expect(mockStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: queueId,
          kitId: 'kit-001',
          companyId: 'company-123',
          status: 'pending',
          attempts: 0
        })
      );
    });
  });

  describe('Scenario 2: Auto-sync when coming back online', () => {
    it('should automatically process queue when network becomes available', async () => {
      // Arrange: Start offline with queued items
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const mockStore = {
        getAll: jest.fn(),
        get: jest.fn(),
        put: jest.fn(),
        index: jest.fn()
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockStore)
      };

      mockDb.transaction.mockReturnValue(mockTransaction);

      // Mock queued items
      const mockIndex = {
        getAll: jest.fn()
      };
      mockStore.index.mockReturnValue(mockIndex);

      const queuedItems = [
        {
          id: 'queue-001',
          kitId: 'kit-001',
          companyId: 'company-123',
          imageData: { data: Array(400).fill(0), width: 10, height: 10, colorSpace: 'srgb' },
          expectedItems: ['wrench'],
          status: 'pending',
          attempts: 0,
          queuedAt: new Date().toISOString()
        }
      ];

      const mockGetAllRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: queuedItems
      };
      mockIndex.getAll.mockReturnValue(mockGetAllRequest);

      // Mock successful fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { verificationId: 'ver-001' } })
      });

      mockLocalStorage.getItem.mockReturnValue('mock-token');

      // Act: Simulate coming back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      // Trigger online event
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);

      // Trigger getAll success
      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: queuedItems } });
        }
      }, 0);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Fetch should have been called with queued verification
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/vision/verify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
    });
  });

  describe('Scenario 3: Retry failed verifications', () => {
    it('should retry failed verifications up to max attempts', async () => {
      // Arrange
      const mockStore = {
        getAll: jest.fn(),
        get: jest.fn(),
        put: jest.fn(),
        index: jest.fn()
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockStore)
      };

      mockDb.transaction.mockReturnValue(mockTransaction);

      const mockIndex = {
        getAll: jest.fn()
      };
      mockStore.index.mockReturnValue(mockIndex);

      // Mock item with 2 attempts
      const queuedItems = [
        {
          id: 'queue-001',
          kitId: 'kit-001',
          companyId: 'company-123',
          imageData: { data: Array(400).fill(0), width: 10, height: 10, colorSpace: 'srgb' },
          expectedItems: ['wrench'],
          status: 'pending',
          attempts: 2, // Already tried twice
          queuedAt: new Date().toISOString()
        }
      ];

      const mockGetAllRequest = {
        onsuccess: null as any,
        result: queuedItems
      };
      mockIndex.getAll.mockReturnValue(mockGetAllRequest);

      const mockGetRequest = {
        onsuccess: null as any,
        result: queuedItems[0]
      };
      mockStore.get.mockReturnValue(mockGetRequest);

      const mockPutRequest = {
        onsuccess: null as any
      };
      mockStore.put.mockReturnValue(mockPutRequest);

      // Mock failed fetch (3rd attempt)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      });

      mockLocalStorage.getItem.mockReturnValue('mock-token');

      // Act: Process queue
      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: queuedItems } });
        }
        if (mockGetRequest.onsuccess) {
          mockGetRequest.onsuccess({ target: { result: queuedItems[0] } });
        }
        if (mockPutRequest.onsuccess) {
          mockPutRequest.onsuccess();
        }
      }, 0);

      const result = await queue.processQueue();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Should be marked as failed after 3rd attempt
      expect(result.failed).toBeGreaterThan(0);
      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: 'Max attempts reached'
        })
      );
    });
  });

  describe('Scenario 4: Clear completed items', () => {
    it('should remove completed verifications from queue', async () => {
      // Arrange
      const mockStore = {
        getAll: jest.fn(),
        delete: jest.fn()
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockStore)
      };

      mockDb.transaction.mockReturnValue(mockTransaction);

      const queuedItems = [
        {
          id: 'queue-001',
          status: 'completed',
          kitId: 'kit-001',
          companyId: 'company-123',
          imageData: { data: [], width: 10, height: 10, colorSpace: 'srgb' },
          expectedItems: [],
          attempts: 1,
          queuedAt: ''
        },
        {
          id: 'queue-002',
          status: 'pending',
          kitId: 'kit-002',
          companyId: 'company-123',
          imageData: { data: [], width: 10, height: 10, colorSpace: 'srgb' },
          expectedItems: [],
          attempts: 0,
          queuedAt: ''
        },
        {
          id: 'queue-003',
          status: 'completed',
          kitId: 'kit-003',
          companyId: 'company-123',
          imageData: { data: [], width: 10, height: 10, colorSpace: 'srgb' },
          expectedItems: [],
          attempts: 1,
          queuedAt: ''
        }
      ];

      const mockGetAllRequest = {
        onsuccess: null as any,
        result: queuedItems
      };
      mockStore.getAll.mockReturnValue(mockGetAllRequest);

      const mockDeleteRequest = {
        onsuccess: null as any
      };
      mockStore.delete.mockReturnValue(mockDeleteRequest);

      // Act
      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: queuedItems } });
        }
        if (mockDeleteRequest.onsuccess) {
          mockDeleteRequest.onsuccess();
        }
      }, 0);

      await queue.clearCompleted();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Should delete 2 completed items
      expect(mockStore.delete).toHaveBeenCalledTimes(2);
      expect(mockStore.delete).toHaveBeenCalledWith('queue-001');
      expect(mockStore.delete).toHaveBeenCalledWith('queue-003');
    });
  });

  describe('Scenario 5: Queue statistics', () => {
    it('should provide accurate queue statistics', async () => {
      // Arrange
      const mockStore = {
        getAll: jest.fn()
      };

      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue(mockStore)
      };

      mockDb.transaction.mockReturnValue(mockTransaction);

      const queuedItems = [
        { id: '1', status: 'pending', imageData: { data: [], width: 10, height: 10, colorSpace: 'srgb' }, kitId: '', companyId: '', expectedItems: [], attempts: 0, queuedAt: '' },
        { id: '2', status: 'pending', imageData: { data: [], width: 10, height: 10, colorSpace: 'srgb' }, kitId: '', companyId: '', expectedItems: [], attempts: 0, queuedAt: '' },
        { id: '3', status: 'processing', imageData: { data: [], width: 10, height: 10, colorSpace: 'srgb' }, kitId: '', companyId: '', expectedItems: [], attempts: 1, queuedAt: '' },
        { id: '4', status: 'completed', imageData: { data: [], width: 10, height: 10, colorSpace: 'srgb' }, kitId: '', companyId: '', expectedItems: [], attempts: 1, queuedAt: '' },
        { id: '5', status: 'failed', imageData: { data: [], width: 10, height: 10, colorSpace: 'srgb' }, kitId: '', companyId: '', expectedItems: [], attempts: 3, queuedAt: '' }
      ];

      const mockGetAllRequest = {
        onsuccess: null as any,
        result: queuedItems
      };
      mockStore.getAll.mockReturnValue(mockGetAllRequest);

      // Act
      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: queuedItems } });
        }
      }, 0);

      const allItems = await queue.getAll();

      // Assert
      expect(allItems).toHaveLength(5);
      const pending = allItems.filter(i => i.status === 'pending');
      const processing = allItems.filter(i => i.status === 'processing');
      const completed = allItems.filter(i => i.status === 'completed');
      const failed = allItems.filter(i => i.status === 'failed');

      expect(pending).toHaveLength(2);
      expect(processing).toHaveLength(1);
      expect(completed).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });
  });
});