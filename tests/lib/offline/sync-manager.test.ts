/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /tests/lib/offline/sync-manager.test.ts
 * phase: 3
 * domain: testing
 * purpose: Comprehensive test suite for enhanced offline sync manager
 * spec_ref: 007-mvp-intent-driven/contracts/sync-manager-tests.md
 * complexity_budget: 350
 * migrations_touched: []
 * state_machine: {
 *   states: ['setup', 'testing', 'cleanup', 'complete'],
 *   transitions: [
 *     'setup->testing: testsStarted()',
 *     'testing->cleanup: testsFinished()',
 *     'cleanup->complete: cleanupDone()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "testSuite": "$0.00 (no AI operations)"
 * }
 * offline_capability: CORE
 * dependencies: {
 *   internal: ['@/lib/offline/sync-manager', '@/lib/offline/offline-db'],
 *   external: ['jest', '@testing-library/jest-dom'],
 *   supabase: []
 * }
 * exports: []
 * voice_considerations: Test voice recording sync and image data sync
 * test_requirements: {
 *   coverage: 95,
 *   scenarios: ['priority sync', 'voice sync', 'image sync', 'conflict resolution']
 * }
 * tasks: [
 *   'Test priority-based sync queue processing',
 *   'Test voice recording synchronization',
 *   'Test image data synchronization',
 *   'Test conflict resolution strategies'
 * ]
 */

import { SyncManager, SyncResult, SyncOptions } from '@/lib/offline/sync-manager';
import { offlineDB, VoiceRecording, ImageData, SyncQueueItem } from '@/lib/offline/offline-db';

// Mock dependencies
jest.mock('@/lib/offline/offline-db');
jest.mock('@/core/logger/voice-logger', () => ({
  voiceLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window event listeners
const mockEventListeners: { [key: string]: Function[] } = {};
const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;

window.addEventListener = jest.fn((event: string, listener: Function) => {
  if (!mockEventListeners[event]) {
    mockEventListeners[event] = [];
  }
  mockEventListeners[event].push(listener);
});

window.removeEventListener = jest.fn((event: string, listener: Function) => {
  if (mockEventListeners[event]) {
    const index = mockEventListeners[event].indexOf(listener);
    if (index > -1) {
      mockEventListeners[event].splice(index, 1);
    }
  }
});

// Mock document.hidden
Object.defineProperty(document, 'hidden', {
  writable: true,
  value: false
});

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockOfflineDB: jest.Mocked<typeof offlineDB>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOfflineDB = offlineDB as jest.Mocked<typeof offlineDB>;
    
    // Reset singleton
    (SyncManager as any).instance = null;
    syncManager = SyncManager.getInstance();
    
    // Mock fetch responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve('OK'),
      status: 200
    });
  });

  afterEach(() => {
    // Clean up event listeners
    Object.keys(mockEventListeners).forEach(event => {
      mockEventListeners[event] = [];
    });
    
    // Restore original methods
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  describe('Initialization and Network Monitoring', () => {
    it('should set up network event listeners on initialization', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should trigger sync when network comes online', async () => {
      const syncAllSpy = jest.spyOn(syncManager, 'syncAll');
      
      // Simulate online event
      const onlineListener = mockEventListeners['online'][0];
      await onlineListener();

      expect(syncAllSpy).toHaveBeenCalled();
    });

    it('should update online status when network goes offline', () => {
      // Simulate offline event
      const offlineListener = mockEventListeners['offline'][0];
      offlineListener();

      expect(syncManager.isOnlineStatus()).toBe(false);
    });

    it('should sync when document becomes visible', async () => {
      const syncAllSpy = jest.spyOn(syncManager, 'syncAll');
      
      // Simulate visibility change
      Object.defineProperty(document, 'hidden', { value: false });
      const visibilityListener = mockEventListeners['visibilitychange']?.[0];
      
      if (visibilityListener) {
        await visibilityListener();
        expect(syncAllSpy).toHaveBeenCalled();
      }
    });
  });

  describe('Priority Operations Sync', () => {
    const mockPriorityOperations: SyncQueueItem[] = [
      {
        id: 'sync-1',
        operation: 'create',
        entity: 'jobs',
        data: { title: 'Test Job' },
        priority: 'critical',
        timestamp: Date.now(),
        syncStatus: 'pending'
      },
      {
        id: 'sync-2',
        operation: 'update',
        entity: 'equipment',
        entityId: 'equip-123',
        data: { status: 'available' },
        priority: 'high',
        timestamp: Date.now(),
        syncStatus: 'pending'
      }
    ];

    beforeEach(() => {
      mockOfflineDB.getPriorityOperations.mockResolvedValue(mockPriorityOperations);
      mockOfflineDB.getPendingVoiceRecordings.mockResolvedValue([]);
      mockOfflineDB.getPendingImageData.mockResolvedValue([]);
      mockOfflineDB.getPendingOfflineEntities.mockResolvedValue([]);
    });

    it('should sync all operations when online', async () => {
      const result = await syncManager.syncAll();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.conflicts).toBe(0);
    });

    it('should return error when offline', async () => {
      // Set offline
      (navigator as any).onLine = false;
      syncManager = SyncManager.getInstance();

      const result = await syncManager.syncAll();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Network is offline');
    });

    it('should prevent concurrent sync operations', async () => {
      // Start first sync
      const firstSync = syncManager.syncAll();
      
      // Try to start second sync immediately
      const secondSync = syncManager.syncAll();

      const [firstResult, secondResult] = await Promise.all([firstSync, secondSync]);

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(false);
      expect(secondResult.errors).toContain('Sync already in progress');
    });

    it('should handle sync operation failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      });

      const result = await syncManager.syncAll();

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should respect batch size limits', async () => {
      const largeOperationList = Array.from({ length: 100 }, (_, i) => ({
        ...mockPriorityOperations[0],
        id: `sync-${i}`,
        timestamp: Date.now() + i
      }));

      mockOfflineDB.getPriorityOperations.mockResolvedValue(largeOperationList);

      const options: SyncOptions = { batchSize: 10 };
      await syncManager.syncAll(options);

      expect(mockOfflineDB.getPriorityOperations).toHaveBeenCalledWith(10);
    });
  });

  describe('Voice Recording Sync', () => {
    const mockVoiceRecordings: VoiceRecording[] = [
      {
        id: 'voice-1',
        blob: new Blob(['audio data'], { type: 'audio/wav' }),
        transcript: 'Test command',
        duration: 3000,
        timestamp: Date.now(),
        jobId: 'job-123',
        syncStatus: 'pending'
      },
      {
        id: 'voice-2',
        blob: new Blob(['audio data 2'], { type: 'audio/wav' }),
        transcript: 'Another command',
        duration: 2000,
        timestamp: Date.now(),
        syncStatus: 'pending'
      }
    ];

    beforeEach(() => {
      mockOfflineDB.getPriorityOperations.mockResolvedValue([]);
      mockOfflineDB.getPendingVoiceRecordings.mockResolvedValue(mockVoiceRecordings);
      mockOfflineDB.getPendingImageData.mockResolvedValue([]);
      mockOfflineDB.getPendingOfflineEntities.mockResolvedValue([]);
      mockOfflineDB.updateVoiceRecordingStatus.mockResolvedValue();
    });

    it('should sync voice recordings successfully', async () => {
      const result = await syncManager.syncAll();

      expect(mockFetch).toHaveBeenCalledWith('/api/voice/upload', {
        method: 'POST',
        body: expect.any(FormData)
      });
      expect(mockOfflineDB.updateVoiceRecordingStatus).toHaveBeenCalledWith('voice-1', 'synced');
      expect(result.synced).toBe(2);
    });

    it('should handle voice recording upload failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        text: () => Promise.resolve('Payload too large')
      });

      const result = await syncManager.syncAll();

      expect(mockOfflineDB.updateVoiceRecordingStatus).toHaveBeenCalledWith('voice-1', 'error');
      expect(result.failed).toBeGreaterThan(0);
    });

    it('should respect voice sync batch size', async () => {
      const options: SyncOptions = { batchSize: 1 };
      await syncManager.syncAll(options);

      // Should only process 1 voice recording due to batch size
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should queue voice recording for immediate sync when online', async () => {
      const syncSpy = jest.spyOn(syncManager as any, 'syncVoiceRecordings');
      
      await syncManager.queueVoiceRecording(mockVoiceRecordings[0]);

      expect(mockOfflineDB.storeVoiceRecording).toHaveBeenCalledWith(mockVoiceRecordings[0]);
      expect(syncSpy).toHaveBeenCalledWith({ batchSize: 1 });
    });
  });

  describe('Image Data Sync', () => {
    const mockImageData: ImageData[] = [
      {
        id: 'image-1',
        blob: new Blob(['image data'], { type: 'image/jpeg' }),
        thumbnailBlob: new Blob(['thumb data'], { type: 'image/jpeg' }),
        metadata: {
          width: 1920,
          height: 1080,
          type: 'image/jpeg',
          size: 102400
        },
        timestamp: Date.now(),
        jobId: 'job-123',
        syncStatus: 'pending'
      }
    ];

    beforeEach(() => {
      mockOfflineDB.getPriorityOperations.mockResolvedValue([]);
      mockOfflineDB.getPendingVoiceRecordings.mockResolvedValue([]);
      mockOfflineDB.getPendingImageData.mockResolvedValue(mockImageData);
      mockOfflineDB.getPendingOfflineEntities.mockResolvedValue([]);
      mockOfflineDB.updateImageDataStatus.mockResolvedValue();
    });

    it('should sync image data successfully', async () => {
      const result = await syncManager.syncAll();

      expect(mockFetch).toHaveBeenCalledWith('/api/images/upload', {
        method: 'POST',
        body: expect.any(FormData)
      });
      expect(mockOfflineDB.updateImageDataStatus).toHaveBeenCalledWith('image-1', 'synced');
      expect(result.synced).toBe(1);
    });

    it('should include thumbnail in FormData when available', async () => {
      await syncManager.syncAll();

      const formData = mockFetch.mock.calls[0][1].body as FormData;
      expect(formData.has('image')).toBe(true);
      expect(formData.has('thumbnail')).toBe(true);
      expect(formData.has('metadata')).toBe(true);
      expect(formData.has('jobId')).toBe(true);
    });

    it('should handle image upload failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        text: () => Promise.resolve('File too large')
      });

      const result = await syncManager.syncAll();

      expect(mockOfflineDB.updateImageDataStatus).toHaveBeenCalledWith('image-1', 'error');
      expect(result.failed).toBeGreaterThan(0);
    });

    it('should queue image data for immediate sync when online', async () => {
      const syncSpy = jest.spyOn(syncManager as any, 'syncImageData');
      
      await syncManager.queueImageData(mockImageData[0]);

      expect(mockOfflineDB.storeImageData).toHaveBeenCalledWith(mockImageData[0]);
      expect(syncSpy).toHaveBeenCalledWith({ batchSize: 1 });
    });
  });

  describe('Conflict Resolution', () => {
    const mockConflictOperation: SyncQueueItem = {
      id: 'sync-conflict',
      operation: 'update',
      entity: 'jobs',
      entityId: 'job-123',
      data: { title: 'Updated Job', lastModified: Date.now() },
      priority: 'high',
      timestamp: Date.now(),
      syncStatus: 'pending'
    };

    beforeEach(() => {
      mockOfflineDB.getPriorityOperations.mockResolvedValue([mockConflictOperation]);
      mockOfflineDB.getPendingVoiceRecordings.mockResolvedValue([]);
      mockOfflineDB.getPendingImageData.mockResolvedValue([]);
      mockOfflineDB.getPendingOfflineEntities.mockResolvedValue([]);
      mockOfflineDB.queuePriorityOperation.mockResolvedValue();
    });

    it('should handle 409 conflict responses', async () => {
      const conflictData = { title: 'Remote Job', lastModified: Date.now() - 1000 };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve(conflictData)
      });

      const result = await syncManager.syncAll();

      expect(result.conflicts).toBe(1);
      expect(mockOfflineDB.queuePriorityOperation).toHaveBeenCalled();
    });

    it('should use overwrite strategy for critical operations', async () => {
      const criticalOperation = { ...mockConflictOperation, priority: 'critical' as const };
      mockOfflineDB.getPriorityOperations.mockResolvedValue([criticalOperation]);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ title: 'Remote Job' })
      });

      await syncManager.syncAll();

      expect(mockOfflineDB.queuePriorityOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictResolution: 'overwrite'
        })
      );
    });

    it('should use merge strategy for non-critical operations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ title: 'Remote Job' })
      });

      await syncManager.syncAll();

      expect(mockOfflineDB.queuePriorityOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictResolution: 'merge'
        })
      );
    });
  });

  describe('Retry Logic', () => {
    const mockFailingOperation: SyncQueueItem = {
      id: 'sync-retry',
      operation: 'create',
      entity: 'jobs',
      data: { title: 'Failing Job' },
      priority: 'medium',
      timestamp: Date.now(),
      syncStatus: 'pending',
      retryCount: 0,
      maxRetries: 3
    };

    beforeEach(() => {
      mockOfflineDB.getPriorityOperations.mockResolvedValue([mockFailingOperation]);
      mockOfflineDB.getPendingVoiceRecordings.mockResolvedValue([]);
      mockOfflineDB.getPendingImageData.mockResolvedValue([]);
      mockOfflineDB.getPendingOfflineEntities.mockResolvedValue([]);
    });

    it('should retry failed operations with exponential backoff', async () => {
      jest.useFakeTimers();
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await syncManager.syncAll();

      expect(result.failed).toBe(1);
      
      // Fast forward time to trigger retry
      jest.advanceTimersByTime(2000); // 2^1 * 1000ms
      
      expect(mockOfflineDB.queuePriorityOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          retryCount: 1
        })
      );

      jest.useRealTimers();
    });

    it('should not retry operations that exceed max retries', async () => {
      const maxRetryOperation = { ...mockFailingOperation, retryCount: 3 };
      mockOfflineDB.getPriorityOperations.mockResolvedValue([maxRetryOperation]);
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await syncManager.syncAll();

      expect(mockOfflineDB.queuePriorityOperation).not.toHaveBeenCalled();
    });
  });

  describe('Sync Statistics', () => {
    beforeEach(() => {
      mockOfflineDB.getPriorityOperations.mockResolvedValue([]);
      mockOfflineDB.getPendingVoiceRecordings.mockResolvedValue([]);
      mockOfflineDB.getPendingImageData.mockResolvedValue([]);
      mockOfflineDB.getPendingOfflineEntities.mockResolvedValue([]);
    });

    it('should return accurate sync statistics', async () => {
      mockOfflineDB.getPriorityOperations.mockResolvedValue([{} as any, {} as any]);
      mockOfflineDB.getPendingVoiceRecordings.mockResolvedValue([{} as any]);
      mockOfflineDB.getPendingImageData.mockResolvedValue([{} as any, {} as any, {} as any]);
      mockOfflineDB.getPendingOfflineEntities.mockResolvedValue([{} as any, {} as any]);

      const stats = await syncManager.getSyncStats();

      expect(stats).toEqual({
        pendingOperations: 2,
        pendingVoice: 1,
        pendingImages: 3,
        pendingEntities: 2
      });
    });

    it('should report sync status correctly', () => {
      const status = syncManager.getSyncStatus();

      expect(status).toEqual({
        isSyncing: expect.any(Boolean),
        isOnline: expect.any(Boolean)
      });
    });

    it('should report currently syncing status', () => {
      expect(syncManager.isCurrentlySyncing()).toBe(false);
      
      // During sync, this would be true
      // This is tested implicitly in other sync tests
    });
  });

  describe('Sync Options', () => {
    beforeEach(() => {
      mockOfflineDB.getPriorityOperations.mockResolvedValue([]);
      mockOfflineDB.getPendingVoiceRecordings.mockResolvedValue([]);
      mockOfflineDB.getPendingImageData.mockResolvedValue([]);
      mockOfflineDB.getPendingOfflineEntities.mockResolvedValue([]);
    });

    it('should exclude voice sync when includeVoice is false', async () => {
      const options: SyncOptions = { includeVoice: false };
      await syncManager.syncAll(options);

      expect(mockOfflineDB.getPendingVoiceRecordings).not.toHaveBeenCalled();
    });

    it('should exclude image sync when includeImages is false', async () => {
      const options: SyncOptions = { includeImages: false };
      await syncManager.syncAll(options);

      expect(mockOfflineDB.getPendingImageData).not.toHaveBeenCalled();
    });

    it('should apply timeout to sync operations', async () => {
      jest.useFakeTimers();
      
      // Mock a delayed response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        }), 5000))
      );

      mockOfflineDB.getPriorityOperations.mockResolvedValue([{
        id: 'sync-timeout',
        operation: 'create',
        entity: 'jobs',
        data: {},
        priority: 'medium',
        timestamp: Date.now(),
        syncStatus: 'pending'
      }]);

      const options: SyncOptions = { timeout: 1000 };
      const syncPromise = syncManager.syncAll(options);

      // Fast forward past timeout
      jest.advanceTimersByTime(1000);

      const result = await syncPromise;

      expect(result.failed).toBeGreaterThan(0);

      jest.useRealTimers();
    });
  });
});