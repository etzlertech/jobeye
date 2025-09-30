/**
 * Integration Test: Offline Queue for Inventory Operations
 *
 * Feature: 004-voice-vision-inventory
 * Purpose: Test IndexedDB queue, sync after reconnect, storage thresholds
 *
 * Tests T016-T018:
 * - T016: IndexedDB storage and retrieval
 * - T017: Sync operations after reconnect
 * - T018: Storage threshold warnings (80%, 95% device storage)
 *
 * MUST FAIL: OfflineQueueService does not exist yet (TDD)
 */

import { OfflineQueueService } from '@/domains/inventory/services/offline-queue.service';

// Mock IndexedDB
const mockIndexedDB = {
  databases: new Map<string, any>(),
  open: jest.fn(),
};

global.indexedDB = mockIndexedDB as any;

// Mock navigator.storage for quota tests
const mockStorageEstimate = jest.fn();
global.navigator = {
  ...global.navigator,
  storage: {
    estimate: mockStorageEstimate,
  },
} as any;

describe('Inventory Offline Queue Integration Tests', () => {
  let offlineQueue: OfflineQueueService;

  beforeEach(() => {
    offlineQueue = new OfflineQueueService();
    mockIndexedDB.databases.clear();
    jest.clearAllMocks();
  });

  describe('T016: IndexedDB storage and retrieval', () => {
    it('should initialize IndexedDB with correct schema', async () => {
      await offlineQueue.initialize();

      expect(mockIndexedDB.open).toHaveBeenCalledWith(
        expect.stringContaining('inventory_offline_queue'),
        expect.any(Number)
      );
    });

    it('should store operation in queue', async () => {
      const operation = {
        id: 'op-1',
        type: 'check_out',
        payload: {
          itemIds: ['item-1', 'item-2'],
          containerId: 'container-1',
        },
        timestamp: Date.now(),
        retryCount: 0,
      };

      await offlineQueue.enqueue(operation);

      const queued = await offlineQueue.getAll();
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject(operation);
    });

    it('should retrieve operations in FIFO order', async () => {
      const ops = [
        { id: 'op-1', type: 'check_out', timestamp: Date.now() - 3000 },
        { id: 'op-2', type: 'check_in', timestamp: Date.now() - 2000 },
        { id: 'op-3', type: 'transfer', timestamp: Date.now() - 1000 },
      ];

      for (const op of ops) {
        await offlineQueue.enqueue(op as any);
      }

      const queued = await offlineQueue.getAll();
      expect(queued.map((q) => q.id)).toEqual(['op-1', 'op-2', 'op-3']);
    });

    it('should remove operation after successful sync', async () => {
      await offlineQueue.enqueue({ id: 'op-1', type: 'check_out' } as any);
      await offlineQueue.remove('op-1');

      const queued = await offlineQueue.getAll();
      expect(queued).toHaveLength(0);
    });

    it('should persist operations across page reloads', async () => {
      await offlineQueue.enqueue({ id: 'op-1', type: 'check_out' } as any);

      // Simulate page reload
      const newQueue = new OfflineQueueService();
      await newQueue.initialize();

      const queued = await newQueue.getAll();
      expect(queued).toHaveLength(1);
      expect(queued[0].id).toBe('op-1');
    });

    it('should handle concurrent queue operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        id: `op-${i}`,
        type: 'check_out',
        timestamp: Date.now() + i,
      }));

      // Enqueue all operations concurrently
      await Promise.all(operations.map((op) => offlineQueue.enqueue(op as any)));

      const queued = await offlineQueue.getAll();
      expect(queued).toHaveLength(10);
    });

    it('should store operation metadata (photos, voice transcripts)', async () => {
      const operation = {
        id: 'op-1',
        type: 'check_out',
        payload: {
          itemIds: ['item-1'],
          photo: new Blob(['fake-image'], { type: 'image/jpeg' }),
          voiceTranscript: 'Check out item one',
        },
        timestamp: Date.now(),
      };

      await offlineQueue.enqueue(operation as any);

      const queued = await offlineQueue.getAll();
      expect(queued[0].payload.voiceTranscript).toBe('Check out item one');
      expect(queued[0].payload.photo).toBeInstanceOf(Blob);
    });

    it('should handle queue capacity limit (50 default)', async () => {
      // Fill queue to capacity
      for (let i = 0; i < 50; i++) {
        await offlineQueue.enqueue({ id: `op-${i}`, type: 'check_out' } as any);
      }

      // 51st operation should trigger warning
      const result = await offlineQueue.enqueue({ id: 'op-51', type: 'check_out' } as any);

      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('queue capacity');
    });

    it('should dynamically expand queue when storage available', async () => {
      // Mock 50% storage usage
      mockStorageEstimate.mockResolvedValue({
        usage: 5 * 1024 * 1024 * 1024, // 5GB used
        quota: 10 * 1024 * 1024 * 1024, // 10GB total
      });

      // Should allow expansion beyond 50
      for (let i = 0; i < 60; i++) {
        await offlineQueue.enqueue({ id: `op-${i}`, type: 'check_out' } as any);
      }

      const queued = await offlineQueue.getAll();
      expect(queued).toHaveLength(60);
    });
  });

  describe('T017: Sync operations after reconnect', () => {
    let mockOnlineStatus = true;

    beforeEach(() => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: mockOnlineStatus,
      });
    });

    it('should detect online status change', async () => {
      const onSyncStart = jest.fn();
      offlineQueue.on('sync-start', onSyncStart);

      // Simulate going online
      mockOnlineStatus = true;
      window.dispatchEvent(new Event('online'));

      expect(onSyncStart).toHaveBeenCalled();
    });

    it('should sync all queued operations when online', async () => {
      // Queue operations while offline
      mockOnlineStatus = false;
      await offlineQueue.enqueue({ id: 'op-1', type: 'check_out' } as any);
      await offlineQueue.enqueue({ id: 'op-2', type: 'check_in' } as any);

      // Go online and trigger sync
      mockOnlineStatus = true;
      const syncResult = await offlineQueue.syncAll();

      expect(syncResult.successCount).toBe(2);
      expect(syncResult.failureCount).toBe(0);

      const remaining = await offlineQueue.getAll();
      expect(remaining).toHaveLength(0);
    });

    it('should retry failed operations up to 10 times', async () => {
      const operation = {
        id: 'op-1',
        type: 'check_out',
        retryCount: 0,
      };

      await offlineQueue.enqueue(operation as any);

      // Simulate 9 failures
      for (let i = 0; i < 9; i++) {
        await offlineQueue.incrementRetry('op-1');
      }

      const op = await offlineQueue.get('op-1');
      expect(op?.retryCount).toBe(9);

      // 10th failure should move to failed archive
      await offlineQueue.incrementRetry('op-1');
      const archived = await offlineQueue.getArchived();
      expect(archived).toHaveLength(1);
    });

    it('should preserve retry order (newest first)', async () => {
      await offlineQueue.enqueue({ id: 'op-1', type: 'check_out', retryCount: 5 } as any);
      await offlineQueue.enqueue({ id: 'op-2', type: 'check_in', retryCount: 2 } as any);
      await offlineQueue.enqueue({ id: 'op-3', type: 'transfer', retryCount: 0 } as any);

      const syncOrder = await offlineQueue.getSyncOrder();
      expect(syncOrder.map((o) => o.id)).toEqual(['op-3', 'op-2', 'op-1']);
    });

    it('should emit progress events during sync', async () => {
      const onProgress = jest.fn();
      offlineQueue.on('sync-progress', onProgress);

      for (let i = 0; i < 5; i++) {
        await offlineQueue.enqueue({ id: `op-${i}`, type: 'check_out' } as any);
      }

      await offlineQueue.syncAll();

      expect(onProgress).toHaveBeenCalledTimes(5);
      expect(onProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({
          current: 5,
          total: 5,
          percentComplete: 100,
        })
      );
    });

    it('should handle partial sync failures gracefully', async () => {
      await offlineQueue.enqueue({ id: 'op-1', type: 'check_out' } as any);
      await offlineQueue.enqueue({ id: 'op-2-fail', type: 'invalid' } as any);
      await offlineQueue.enqueue({ id: 'op-3', type: 'check_in' } as any);

      const result = await offlineQueue.syncAll();

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].id).toBe('op-2-fail');
    });

    it('should sync operations in background without blocking UI', async () => {
      for (let i = 0; i < 100; i++) {
        await offlineQueue.enqueue({ id: `op-${i}`, type: 'check_out' } as any);
      }

      const syncPromise = offlineQueue.syncAll({ background: true });

      // Should return immediately
      expect(syncPromise).toBeInstanceOf(Promise);

      // But sync should still complete
      await syncPromise;
      const remaining = await offlineQueue.getAll();
      expect(remaining).toHaveLength(0);
    });
  });

  describe('T018: Storage threshold warnings', () => {
    it('should warn at 80% device storage usage', async () => {
      mockStorageEstimate.mockResolvedValue({
        usage: 8.5 * 1024 * 1024 * 1024, // 8.5GB used
        quota: 10 * 1024 * 1024 * 1024, // 10GB total (85% usage)
      });

      const warning = await offlineQueue.checkStorageThreshold();

      expect(warning.level).toBe('warning');
      expect(warning.percentUsed).toBeCloseTo(85);
      expect(warning.message).toContain('80%');
    });

    it('should block operations at 95% device storage', async () => {
      mockStorageEstimate.mockResolvedValue({
        usage: 9.6 * 1024 * 1024 * 1024, // 9.6GB used
        quota: 10 * 1024 * 1024 * 1024, // 10GB total (96% usage)
      });

      const result = await offlineQueue.enqueue({ id: 'op-1', type: 'check_out' } as any);

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('storage');
    });

    it('should calculate queue size estimate', async () => {
      for (let i = 0; i < 10; i++) {
        await offlineQueue.enqueue({
          id: `op-${i}`,
          type: 'check_out',
          payload: {
            photo: new Blob(['x'.repeat(1024 * 100)], { type: 'image/jpeg' }), // 100KB each
          },
        } as any);
      }

      const sizeEstimate = await offlineQueue.getQueueSize();
      expect(sizeEstimate).toBeGreaterThan(1024 * 1000); // >1MB total
    });

    it('should recommend cleanup when storage critical', async () => {
      mockStorageEstimate.mockResolvedValue({
        usage: 9.8 * 1024 * 1024 * 1024,
        quota: 10 * 1024 * 1024 * 1024, // 98% usage
      });

      const recommendation = await offlineQueue.getStorageRecommendation();

      expect(recommendation.action).toBe('cleanup_required');
      expect(recommendation.suggestions).toContain('Clear photo cache');
      expect(recommendation.suggestions).toContain('Archive old operations');
    });

    it('should allow manual queue size limit configuration', async () => {
      offlineQueue.setMaxQueueSize(100);

      for (let i = 0; i < 100; i++) {
        await offlineQueue.enqueue({ id: `op-${i}`, type: 'check_out' } as any);
      }

      const result = await offlineQueue.enqueue({ id: 'op-101', type: 'check_out' } as any);

      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('queue limit');
    });
  });
});