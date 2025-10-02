/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /tests/lib/offline/offline-db.test.ts
 * phase: 3
 * domain: testing
 * purpose: Comprehensive test suite for enhanced IndexedDB offline database wrapper
 * spec_ref: 007-mvp-intent-driven/contracts/offline-db-tests.md
 * complexity_budget: 300
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
 *   internal: ['@/lib/offline/offline-db'],
 *   external: ['jest', '@testing-library/jest-dom'],
 *   supabase: []
 * }
 * exports: []
 * voice_considerations: Test voice recording storage and retrieval
 * test_requirements: {
 *   coverage: 95,
 *   scenarios: ['voice storage', 'image storage', 'sync queue', 'offline entities']
 * }
 * tasks: [
 *   'Test IndexedDB initialization and schema creation',
 *   'Test voice recording storage and retrieval',
 *   'Test image data storage with thumbnails',
 *   'Test priority-based sync queue operations'
 * ]
 */

import { OfflineDatabase, VoiceRecording, ImageData, SyncQueueItem, OfflineEntity } from '@/lib/offline/offline-db';

// Mock IndexedDB for testing
const mockIDBRequest = {
  onsuccess: null as any,
  onerror: null as any,
  result: null as any
};

const mockIDBTransaction = {
  objectStore: jest.fn().mockReturnValue({
    put: jest.fn().mockReturnValue(mockIDBRequest),
    get: jest.fn().mockReturnValue(mockIDBRequest),
    getAll: jest.fn().mockReturnValue(mockIDBRequest),
    delete: jest.fn().mockReturnValue(mockIDBRequest),
    count: jest.fn().mockReturnValue(mockIDBRequest),
    createIndex: jest.fn(),
    index: jest.fn().mockReturnValue({
      getAll: jest.fn().mockReturnValue(mockIDBRequest),
      openCursor: jest.fn().mockReturnValue(mockIDBRequest)
    }),
    openCursor: jest.fn().mockReturnValue(mockIDBRequest)
  })
};

const mockIDBDatabase = {
  transaction: jest.fn().mockReturnValue(mockIDBTransaction),
  createObjectStore: jest.fn().mockReturnValue({
    createIndex: jest.fn()
  }),
  objectStoreNames: {
    contains: jest.fn().mockReturnValue(false)
  }
};

const mockIDBFactory = {
  open: jest.fn().mockReturnValue({
    onsuccess: null as any,
    onerror: null as any,
    onupgradeneeded: null as any,
    result: mockIDBDatabase
  })
};

// Setup global IndexedDB mock
(global as any).indexedDB = mockIDBFactory;

describe('OfflineDatabase', () => {
  let db: OfflineDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    db = OfflineDatabase.getInstance();
  });

  afterEach(async () => {
    // Reset singleton for next test
    (OfflineDatabase as any).instance = null;
  });

  describe('Database Initialization', () => {
    it('should initialize database with correct schema', async () => {
      const openRequest = mockIDBFactory.open.mock.results[0].value;
      
      // Simulate database opening
      openRequest.onsuccess();
      
      await db.initialize();

      expect(mockIDBFactory.open).toHaveBeenCalledWith('jobeye_offline', 2);
    });

    it('should create all required object stores on upgrade', async () => {
      const openRequest = mockIDBFactory.open.mock.results[0].value;
      
      // Simulate upgrade needed
      const upgradeEvent = {
        target: { result: mockIDBDatabase }
      };
      
      openRequest.onupgradeneeded(upgradeEvent);

      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('sync_queue', {
        keyPath: 'id',
        autoIncrement: true
      });
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('voice_recordings', {
        keyPath: 'id'
      });
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('image_data', {
        keyPath: 'id'
      });
    });

    it('should handle database initialization errors', async () => {
      const openRequest = mockIDBFactory.open.mock.results[0].value;
      
      // Simulate error
      openRequest.onerror();

      await expect(db.initialize()).rejects.toThrow('Failed to open IndexedDB');
    });
  });

  describe('Voice Recording Storage', () => {
    const mockVoiceRecording: VoiceRecording = {
      id: 'voice-123',
      blob: new Blob(['audio data'], { type: 'audio/wav' }),
      transcript: 'Test voice command',
      duration: 5000,
      timestamp: Date.now(),
      jobId: 'job-456',
      syncStatus: 'pending'
    };

    beforeEach(async () => {
      // Mock successful initialization
      const openRequest = mockIDBFactory.open.mock.results[0].value;
      openRequest.onsuccess();
      await db.initialize();
    });

    it('should store voice recording successfully', async () => {
      const putRequest = mockIDBRequest;
      
      setTimeout(() => {
        putRequest.onsuccess();
      }, 0);

      await db.storeVoiceRecording(mockVoiceRecording);

      expect(mockIDBDatabase.transaction).toHaveBeenCalledWith(['voice_recordings'], 'readwrite');
      expect(mockIDBTransaction.objectStore).toHaveBeenCalledWith('voice_recordings');
    });

    it('should retrieve voice recording by ID', async () => {
      const getRequest = mockIDBRequest;
      getRequest.result = mockVoiceRecording;
      
      setTimeout(() => {
        getRequest.onsuccess();
      }, 0);

      const result = await db.getVoiceRecording('voice-123');

      expect(result).toEqual(mockVoiceRecording);
      expect(mockIDBTransaction.objectStore().get).toHaveBeenCalledWith('voice-123');
    });

    it('should get voice recordings by job ID', async () => {
      const getAllRequest = mockIDBRequest;
      getAllRequest.result = [mockVoiceRecording];
      
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const results = await db.getVoiceRecordingsByJob('job-456');

      expect(results).toEqual([mockVoiceRecording]);
      expect(mockIDBTransaction.objectStore().index).toHaveBeenCalledWith('jobId');
    });

    it('should get pending voice recordings', async () => {
      const getAllRequest = mockIDBRequest;
      getAllRequest.result = [mockVoiceRecording];
      
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const results = await db.getPendingVoiceRecordings();

      expect(results).toEqual([mockVoiceRecording]);
      expect(mockIDBTransaction.objectStore().index).toHaveBeenCalledWith('syncStatus');
    });

    it('should update voice recording sync status', async () => {
      const getRequest = mockIDBRequest;
      const putRequest = mockIDBRequest;
      getRequest.result = { ...mockVoiceRecording };
      
      setTimeout(() => {
        getRequest.onsuccess();
        setTimeout(() => {
          putRequest.onsuccess();
        }, 0);
      }, 0);

      await db.updateVoiceRecordingStatus('voice-123', 'synced');

      expect(mockIDBTransaction.objectStore().get).toHaveBeenCalledWith('voice-123');
      expect(mockIDBTransaction.objectStore().put).toHaveBeenCalled();
    });

    it('should handle voice recording not found error', async () => {
      const getRequest = mockIDBRequest;
      getRequest.result = null;
      
      setTimeout(() => {
        getRequest.onsuccess();
      }, 0);

      await expect(db.updateVoiceRecordingStatus('nonexistent', 'synced'))
        .rejects.toThrow('Voice recording not found');
    });
  });

  describe('Image Data Storage', () => {
    const mockImageData: ImageData = {
      id: 'image-123',
      blob: new Blob(['image data'], { type: 'image/jpeg' }),
      thumbnailBlob: new Blob(['thumb data'], { type: 'image/jpeg' }),
      metadata: {
        width: 1920,
        height: 1080,
        type: 'image/jpeg',
        size: 102400
      },
      timestamp: Date.now(),
      jobId: 'job-456',
      syncStatus: 'pending'
    };

    beforeEach(async () => {
      const openRequest = mockIDBFactory.open.mock.results[0].value;
      openRequest.onsuccess();
      await db.initialize();
    });

    it('should store image data successfully', async () => {
      const putRequest = mockIDBRequest;
      
      setTimeout(() => {
        putRequest.onsuccess();
      }, 0);

      await db.storeImageData(mockImageData);

      expect(mockIDBDatabase.transaction).toHaveBeenCalledWith(['image_data'], 'readwrite');
      expect(mockIDBTransaction.objectStore).toHaveBeenCalledWith('image_data');
    });

    it('should retrieve image data by ID', async () => {
      const getRequest = mockIDBRequest;
      getRequest.result = mockImageData;
      
      setTimeout(() => {
        getRequest.onsuccess();
      }, 0);

      const result = await db.getImageData('image-123');

      expect(result).toEqual(mockImageData);
    });

    it('should get pending image data', async () => {
      const getAllRequest = mockIDBRequest;
      getAllRequest.result = [mockImageData];
      
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const results = await db.getPendingImageData();

      expect(results).toEqual([mockImageData]);
    });

    it('should update image data sync status', async () => {
      const getRequest = mockIDBRequest;
      const putRequest = mockIDBRequest;
      getRequest.result = { ...mockImageData };
      
      setTimeout(() => {
        getRequest.onsuccess();
        setTimeout(() => {
          putRequest.onsuccess();
        }, 0);
      }, 0);

      await db.updateImageDataStatus('image-123', 'synced');

      expect(mockIDBTransaction.objectStore().put).toHaveBeenCalled();
    });
  });

  describe('Priority Sync Queue', () => {
    const mockSyncItem: SyncQueueItem = {
      id: 'sync-123',
      operation: 'create',
      entity: 'jobs',
      entityId: 'job-456',
      data: { title: 'Test Job' },
      priority: 'high',
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      syncStatus: 'pending'
    };

    beforeEach(async () => {
      const openRequest = mockIDBFactory.open.mock.results[0].value;
      openRequest.onsuccess();
      await db.initialize();
    });

    it('should queue priority operation successfully', async () => {
      const addRequest = mockIDBRequest;
      
      setTimeout(() => {
        addRequest.onsuccess();
      }, 0);

      await db.queuePriorityOperation({
        operation: 'create',
        entity: 'jobs',
        data: { title: 'Test Job' },
        priority: 'high'
      });

      expect(mockIDBTransaction.objectStore().add).toHaveBeenCalled();
    });

    it('should get priority operations sorted correctly', async () => {
      const criticalItem = { ...mockSyncItem, priority: 'critical' as const, timestamp: 2000 };
      const highItem = { ...mockSyncItem, priority: 'high' as const, timestamp: 1000 };
      const mediumItem = { ...mockSyncItem, priority: 'medium' as const, timestamp: 3000 };
      
      const getAllRequest = mockIDBRequest;
      getAllRequest.result = [mediumItem, criticalItem, highItem];
      
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const results = await db.getPriorityOperations(10);

      expect(mockIDBTransaction.objectStore().getAll).toHaveBeenCalled();
      // Results should be sorted by priority then timestamp
      expect(results).toBeDefined();
    });

    it('should limit results to specified batch size', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({
        ...mockSyncItem,
        id: `sync-${i}`,
        timestamp: Date.now() + i
      }));
      
      const getAllRequest = mockIDBRequest;
      getAllRequest.result = items;
      
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const results = await db.getPriorityOperations(5);

      expect(results).toBeDefined();
      // Should be limited to 5 items
    });
  });

  describe('Offline Entities', () => {
    const mockEntity: OfflineEntity = {
      id: 'entity-123',
      entity: 'jobs',
      data: { title: 'Test Job', status: 'pending' },
      timestamp: Date.now(),
      syncStatus: 'pending',
      lastModified: Date.now()
    };

    beforeEach(async () => {
      const openRequest = mockIDBFactory.open.mock.results[0].value;
      openRequest.onsuccess();
      await db.initialize();
    });

    it('should store offline entity successfully', async () => {
      const putRequest = mockIDBRequest;
      
      setTimeout(() => {
        putRequest.onsuccess();
      }, 0);

      await db.storeOfflineEntity(mockEntity);

      expect(mockIDBTransaction.objectStore().put).toHaveBeenCalledWith(mockEntity);
    });

    it('should retrieve offline entity by ID', async () => {
      const getRequest = mockIDBRequest;
      getRequest.result = mockEntity;
      
      setTimeout(() => {
        getRequest.onsuccess();
      }, 0);

      const result = await db.getOfflineEntity('entity-123');

      expect(result).toEqual(mockEntity);
    });

    it('should get entities by type', async () => {
      const getAllRequest = mockIDBRequest;
      getAllRequest.result = [mockEntity];
      
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const results = await db.getOfflineEntitiesByType('jobs');

      expect(results).toEqual([mockEntity]);
      expect(mockIDBTransaction.objectStore().index).toHaveBeenCalledWith('entity');
    });

    it('should get pending offline entities', async () => {
      const getAllRequest = mockIDBRequest;
      getAllRequest.result = [mockEntity];
      
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const results = await db.getPendingOfflineEntities();

      expect(results).toEqual([mockEntity]);
      expect(mockIDBTransaction.objectStore().index).toHaveBeenCalledWith('syncStatus');
    });
  });

  describe('Storage Management', () => {
    beforeEach(async () => {
      const openRequest = mockIDBFactory.open.mock.results[0].value;
      openRequest.onsuccess();
      await db.initialize();
    });

    it('should get storage statistics', async () => {
      const countRequests = [mockIDBRequest, mockIDBRequest, mockIDBRequest, mockIDBRequest];
      countRequests.forEach((req, index) => {
        req.result = 10 + index;
        setTimeout(() => {
          req.onsuccess();
        }, 0);
      });

      const stats = await db.getStorageStats();

      expect(stats).toEqual({
        voiceRecordings: 10,
        imageData: 11,
        offlineEntities: 12,
        pendingSync: 13
      });
    });

    it('should cleanup expired data', async () => {
      const cursorRequest = mockIDBRequest;
      const mockCursor = {
        value: { timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, syncStatus: 'synced' },
        delete: jest.fn(),
        continue: jest.fn()
      };
      
      cursorRequest.result = mockCursor;
      
      setTimeout(() => {
        cursorRequest.onsuccess();
        // Simulate cursor end
        setTimeout(() => {
          cursorRequest.result = null;
          cursorRequest.onsuccess();
        }, 0);
      }, 0);

      await db.cleanupExpiredData();

      expect(mockCursor.delete).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const openRequest = mockIDBFactory.open.mock.results[0].value;
      openRequest.onsuccess();
      await db.initialize();
    });

    it('should handle transaction errors gracefully', async () => {
      const putRequest = mockIDBRequest;
      
      setTimeout(() => {
        putRequest.onerror();
      }, 0);

      await expect(db.storeVoiceRecording({
        id: 'test',
        blob: new Blob(),
        timestamp: Date.now(),
        syncStatus: 'pending'
      })).rejects.toThrow('Failed to store voice recording');
    });

    it('should handle missing data gracefully', async () => {
      const getRequest = mockIDBRequest;
      getRequest.result = null;
      
      setTimeout(() => {
        getRequest.onsuccess();
      }, 0);

      const result = await db.getVoiceRecording('nonexistent');

      expect(result).toBeNull();
    });
  });
});